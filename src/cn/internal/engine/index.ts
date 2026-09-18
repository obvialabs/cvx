/**
 * Packed conflict-resolution runtime for the `cn` domain.
 *
 * The engine owns utility parsing, modifier normalization, conflict claims,
 * and whole-string caching. Input composition lives in `compose.ts` so this
 * module can stay focused on the merge state machine and its hot data paths.
 *
 * @internal
 */

import { joinMergeInputs } from "./compose"
import { hashSampledSpan, hashSpan } from "./hash"

import type { Engine, EngineOptions, Tables, ValidatorImpls } from "../types"

const IS_JSC = "line" in new Error()

const EXTERNAL = -1
const DEAD = -1

/**
 * Create a conflict-resolution engine from compiled Tailwind lookup tables
 *
 * The engine prepares conflict adjacency, validator dispatch, literal lookup,
 * modifier handling, and whole-string caches once. Individual merge calls then
 * operate against compact typed-array state.
 *
 * **Parameters**
 * - `tables` – Compiled conflict lookup tables
 * - `validatorImpls` – Runtime implementations for custom validators referenced by the tables
 * - `options` – Internal cache and Tailwind prefix options
 *    - `cacheSize` – Maximum whole-string cache size
 *    - `prefix` – Tailwind v4 utility prefix overriding the compiled table prefix
 *
 * **Returns**
 * An executable conflict engine used by `cn` and internal verification tools
 *
 * @internal
 */
export const createEngine = (
  tables: Tables,
  validatorImpls?: ValidatorImpls,
  options: EngineOptions = {},
): Engine => {
  const T = tables
  const {
    GROUP_COUNT,
    edgeStart,
    labelStart,
    labelText,
    edgeTarget,
    nodeGroup,
    nodeVlist,
    vlistPat,
    vlistOps,
    vlistRef,
    vlistGroup,
    litAnchor,
    litGroup,
    litPool,
    poolOffsets,
    poolText,
    adjGid,
    adjStart,
    adjTgt,
    patGid,
    patTgt,
    postfixLookupGroups,
    customValidatorNames,
    orderSensitiveModifiers,
  } = T

  // Build direct row indexes so conflict groups can resolve their adjacency lists in O(1)
  // Each kept token claims the groups it overrides through the same epoch-stamped claim set,
  // regardless of whether the group came from static tables or a dynamic arbitrary property.
  const adjRow = new Int32Array(GROUP_COUNT).fill(-1)
  for (let i = 0; i < adjGid.length; i++) adjRow[adjGid[i]] = i

  // Size the claim table from the largest configured fan-out so one merge pass cannot
  // saturate the open-addressed table and turn conflict checks into unbounded probes.
  let maxAdj = 0
  for (let r = 0; r + 1 < adjStart.length; r++) {
    const n = adjStart[r + 1] - adjStart[r]
    if (n > maxAdj) maxAdj = n
  }
  let CLAIM_PER_TOKEN = 32
  while (CLAIM_PER_TOKEN < 2 * (1 + maxAdj + patGid.length))
    CLAIM_PER_TOKEN <<= 1

  // Build offsets into the flattened validator-group array because multiple validator
  // lists may reuse the same opcode pattern while targeting different conflict groups.
  const vgStart = new Int32Array(vlistRef.length + 1)
  for (let l = 0; l < vlistRef.length; l++) {
    vgStart[l + 1] =
      vgStart[l] + vlistPat[vlistRef[l] + 1] - vlistPat[vlistRef[l]]
  }

  const postfixLookupSet = new Uint8Array(GROUP_COUNT)
  for (let i = 0; i < postfixLookupGroups.length; i++)
    postfixLookupSet[postfixLookupGroups[i]] = 1

  // Build an open-addressed lookup for literal tails lifted out of compacted trie subtrees
  // The key is `(anchorNode, tailString)`, but probes hash the input span directly so matching
  // never needs to allocate the candidate tail as a substring.
  const nodeCount = edgeStart.length - 1
  const nodeHasLit = new Uint8Array(nodeCount)
  let litMaxLen = 0
  let litNoArb = true // no literal tail starts with '[' or '('
  for (let i = 0; i < litAnchor.length; i++) {
    nodeHasLit[litAnchor[i]] = 1
    const len = poolOffsets[litPool[i] * 2 + 1]
    if (len > litMaxLen) litMaxLen = len
    const c0 = poolText.charCodeAt(poolOffsets[litPool[i] * 2])
    if (c0 === 91 || c0 === 40) litNoArb = false
  }
  let LIT_SIZE = 1
  while (LIT_SIZE < litAnchor.length * 2) LIT_SIZE <<= 1
  const litTable = new Int32Array(LIT_SIZE).fill(-1)
  for (let i = 0; i < litAnchor.length; i++) {
    const off = poolOffsets[litPool[i] * 2]
    let idx =
      ((hashSpan(poolText, off, off + poolOffsets[litPool[i] * 2 + 1]) ^
        Math.imul(litAnchor[i], 0x9e3779b1)) |
        0) &
      (LIT_SIZE - 1)
    while (litTable[idx] !== -1) idx = (idx + 1) & (LIT_SIZE - 1)
    litTable[idx] = i
  }
  const litProbe = (
    anchor: number,
    input: string,
    s: number,
    e: number
  ): number => {
    let idx =
      ((hashSpan(input, s, e) ^ Math.imul(anchor, 0x9e3779b1)) | 0) & (LIT_SIZE - 1)
    const len = e - s
    for (;;) {
      const entry = litTable[idx]
      if (entry === -1) return -1
      if (
        litAnchor[entry] === anchor &&
        poolOffsets[litPool[entry] * 2 + 1] === len
      ) {
        const off = poolOffsets[litPool[entry] * 2]
        let ok = true
        for (let k = 0; k < len; k++) {
          if (poolText.charCodeAt(off + k) !== input.charCodeAt(s + k)) {
            ok = false
            break
          }
        }
        if (ok) return litGroup[entry]
      }
      idx = (idx + 1) & (LIT_SIZE - 1)
    }
  }

  const cacheSize = options.cacheSize ?? 8192

  // Treat the Tailwind v4 prefix like a leading variant, for example `tw:hover:p-4`
  // Tokens outside the configured prefix are preserved as external classes and never merged.
  const RAW_PREFIX = options.prefix ?? T.prefix ?? ""
  const FULL_PREFIX = RAW_PREFIX === "" ? "" : RAW_PREFIX + ":"
  const FPL = FULL_PREFIX.length

  // Prepare span-based validators so common utility checks avoid substring allocation
  // Validator opcodes inspect `(input, start, end)` directly; only uncommon shapes fall back
  // to lazily sliced strings and regular expressions.
  const vCustom = (customValidatorNames ?? []).map((name) => {
    const fn = validatorImpls && validatorImpls[name]
    if (!fn) throw new Error("cn: missing validator " + name)
    return fn
  })

  const lengthUnitRegex =
    /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/
  const colorFunctionRegex =
    /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/
  const shadowRegex =
    /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/
  const imageRegex =
    /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/

  // Reuse one scratch record for arbitrary-value analysis so each token avoids object allocation
  let aKind = 0 // 0 = plain value, 1 = bracket value, 2 = parenthesized variable
  let aLabelS = -1
  let aLabelE = -1
  let aValS = -1
  let aValE = -1

  const isWordCode = (c: number) =>
    (c >= 97 && c <= 122) ||
    (c >= 65 && c <= 90) ||
    (c >= 48 && c <= 57) ||
    c === 95

  // Check the non-ASCII members of JavaScript `\s` only after the fast ASCII path fails
  // This covers U+00A0, U+1680, U+2000–U+200A, U+2028/U+2029, U+202F, U+205F, U+3000, and U+FEFF.
  const isUniWS = (c: number): boolean => /\s/.test(String.fromCharCode(c))

  const analyzeArb = (input: string, s: number, e: number): void => {
    aKind = 0
    aLabelS = -1
    if (e - s < 3) return
    const c0 = input.charCodeAt(s)
    const cl = input.charCodeAt(e - 1)
    if (c0 === 91 && cl === 93) aKind = 1
    else if (c0 === 40 && cl === 41) aKind = 2
    else return
    aValS = s + 1
    aValE = e - 1
    // Recognize an optional `label:value` prefix only when the label is word/hyphen based
    let p = s + 1
    if (isWordCode(input.charCodeAt(p))) {
      p++
      while (p < e - 1) {
        const c = input.charCodeAt(p)
        if (!isWordCode(c) && c !== 45) break
        p++
      }
      if (p < e - 2 && input.charCodeAt(p) === 58) {
        aLabelS = s + 1
        aLabelE = p
        aValS = p + 1
      }
    }
  }

  const spanEq = (
    input: string,
    s: number,
    e: number,
    str: string
  ): boolean => {
    if (e - s !== str.length) return false
    for (let i = 0; i < str.length; i++) {
      if (input.charCodeAt(s + i) !== str.charCodeAt(i)) return false
    }
    return true
  }

  // Keep complex value-shape regular expressions on the memo-miss path only
  // Common arbitrary-value analysis remains span-based through `analyzeArb`.
  const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/
  const tshirtRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/
  const isNumStr = (v: string) => !!v && !Number.isNaN(Number(v))
  const spanIsNamedContainerQuery = (
    input: string,
    s: number,
    e: number
  ): boolean => {
    if (e - s < 11 || !spanEq(input, s, s + 10, "@container")) return false
    if (input.charCodeAt(s + 10) === 47) return e - s >= 12
    const c11 = input.charCodeAt(s + 11)
    return (
      (c11 === 115 && e - s >= 17 && spanEq(input, s + 10, s + 16, "-size/")) ||
      (c11 === 110 && e - s >= 19 && spanEq(input, s + 10, s + 18, "-normal/"))
    )
  }

  // Opcodes 10–24 encode the required arbitrary-value kind, accepted labels, and
  // unlabeled fallback behavior: false, true, length, number, image, or shadow.
  const VKIND = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]
  const VLABELS =
    "length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight"
      .split("|")
      .map((s) => s.split(" "))
  const VFALL = [2, 3, 1, 0, 0, 0, 4, 5, 0, 0, 0, 0, 0, 1, 1]

  const runValidator = (
    op: number,
    input: string,
    s: number,
    e: number
  ): boolean => {
    if (op >= 10) {
      if (op >= 25) return vCustom[op - 25](input.slice(s, e))
      const i = op - 10
      if (aKind !== VKIND[i]) return false
      if (aLabelS >= 0) {
        for (const L of VLABELS[i])
          if (spanEq(input, aLabelS, aLabelE, L)) return true
        return false
      }
      switch (VFALL[i]) {
        case 0:
          return false
        case 1:
          return true
        case 2: {
          const v = input.slice(aValS, aValE)
          return lengthUnitRegex.test(v) && !colorFunctionRegex.test(v)
        }
        case 3:
          return isNumStr(input.slice(aValS, aValE))
        case 4:
          return imageRegex.test(input.slice(aValS, aValE))
        default:
          return shadowRegex.test(input.slice(aValS, aValE))
      }
    }
    switch (op) {
      case 0:
        return true
      case 1:
        return aKind === 0
      case 2:
        return aKind === 1
      case 3:
        return aKind === 2
      case 4:
        return fractionRegex.test(input.slice(s, e))
      case 5:
        return isNumStr(input.slice(s, e))
      case 6: {
        const v = input.slice(s, e)
        return !!v && Number.isInteger(Number(v))
      }
      case 7:
        return (
          e > s &&
          input.charCodeAt(e - 1) === 37 &&
          isNumStr(input.slice(s, e - 1))
        )
      case 8:
        return tshirtRegex.test(input.slice(s, e))
      default:
        return spanIsNamedContainerQuery(input, s, e)
    }
  }

  const orderSensitive = new Set(
    typeof orderSensitiveModifiers === "string"
      ? orderSensitiveModifiers.split(" ")
      : orderSensitiveModifiers
  )

  // Intern modifier contexts and dynamic groups so repeated spans reuse stable numeric IDs
  // Materialized strings are allocated once per unique span, and resets happen only between
  // merge calls so IDs remain consistent throughout a conflict-resolution pass.
  interface InternEntry {
    k: string
    imp: number
    id: number
  }
  const internSpan = (
    map: Map<number, InternEntry[]>,
    input: string,
    s: number,
    e: number,
    imp: number,
    make: (raw: string) => number
  ): number => {
    const h = (hashSpan(input, s, e) ^ (imp ? 0x9e3779b9 : 0)) | 0
    let bucket = map.get(h)
    if (bucket !== undefined) {
      outer: for (let b = 0; b < bucket.length; b++) {
        const en = bucket[b]
        if (en.imp !== imp || en.k.length !== e - s) continue
        for (let i = 0; i < en.k.length; i++) {
          if (en.k.charCodeAt(i) !== input.charCodeAt(s + i)) continue outer
        }
        return en.id
      }
    } else map.set(h, (bucket = []))
    const k = input.slice(s, e)
    const id = make(k)
    bucket.push({ k, imp, id })
    return id
  }

  let ctxByHash = new Map()
  let ctxByCanon = new Map()
  let nextCtxId = 2 // 0 = no variants, 1 = no variants + important
  const MAX_CTX = 4096

  const canonicalizeContext = (raw: string, important: boolean): number => {
    // Split modifiers only at top-level `:` separators, then sort commutative segments while
    // preserving boundaries around order-sensitive modifiers.
    const mods = []
    let dB = 0,
      dP = 0,
      start = 0
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i)
      if (dB === 0 && dP === 0 && c === 58) {
        mods.push(raw.slice(start, i))
        start = i + 1
      } else if (c === 91) dB++
      else if (c === 93) dB--
      else if (c === 40) dP++
      else if (c === 41) dP--
    }
    mods.push(raw.slice(start))

    let canonical = mods[0]
    if (mods.length > 1) {
      const result = []
      let segment = []
      for (const mod of mods) {
        if (mod.charCodeAt(0) === 91 || orderSensitive.has(mod)) {
          if (segment.length) {
            result.push(...segment.sort())
            segment = []
          }
          result.push(mod)
        } else segment.push(mod)
      }
      if (segment.length) result.push(...segment.sort())
      canonical = result.join(":")
    }
    const key = important ? canonical + " !" : canonical
    let id = ctxByCanon.get(key)
    if (id === undefined) ctxByCanon.set(key, (id = nextCtxId++))
    return id
  }

  let dynByHash = new Map()
  let nextDynId = GROUP_COUNT
  const MAX_DYN = GROUP_COUNT + 4096
  const newDynId = () => nextDynId++
  const ID_LIMIT = 2097152 // 2^21: keeps ctx * 2^21 + gid exact in a double

  // Memoize token classification in a small two-way associative cache shared by the engine
  // Cache hits verify the original character span in place, avoiding the substring allocation
  // that a conventional string-keyed cache would require before lookup.
  const TOKEN_TABLE = 8192
  const memoHash = new Int32Array(TOKEN_TABLE)
  const memoStr = new Array(TOKEN_TABLE).fill(null)
  const memoGid = new Int32Array(TOKEN_TABLE)
  const memoCtx = new Int32Array(TOKEN_TABLE)
  const memoFlags = new Uint8Array(TOKEN_TABLE)
  // Give occupied cache ways a second chance and overwrite them only on every fourth collision
  // This keeps one-shot utility strings from immediately evicting frequently reused tokens.
  let memoTick = 0

  const memoPut = (
    way0: number,
    input: string,
    ts: number,
    te: number,
    h: number,
    gid: number,
    ctxId: number,
    flags: number
  ): void => {
    let slot = way0
    if (memoStr[way0] !== null) {
      if (memoStr[way0 | 1] === null) slot = way0 | 1
      else if ((memoTick++ & 3) === 0) slot = way0 | ((memoTick >> 2) & 1)
      else return
    }
    memoStr[slot] = input.slice(ts, te)
    memoHash[slot] = h
    memoGid[slot] = gid
    memoCtx[slot] = ctxId
    memoFlags[slot] = flags
  }
  const memoReset = () => memoStr.fill(null)

  // Reuse merge-state buffers across calls so tokenization and claim tracking stay allocation-light
  let cap = 256
  let tokI32 = [
    new Int32Array(cap),
    new Int32Array(cap),
    new Int32Array(cap),
    new Int32Array(cap),
  ]
  let [tokStart, tokEnd, tokGid, tokCtx] = tokI32
  let tokFlags = new Uint8Array(cap)
  let keep = new Uint8Array(cap)
  const growTokens = () => {
    cap *= 2
    tokI32 = tokI32.map((a) => {
      const n = new Int32Array(cap)
      n.set(a)
      return n
    })
    tokStart = tokI32[0]!
    tokEnd = tokI32[1]!
    tokGid = tokI32[2]!
    tokCtx = tokI32[3]!
    const nf = new Uint8Array(cap)
    nf.set(tokFlags)
    tokFlags = nf
    keep = new Uint8Array(cap)
  }

  let ckptCap = 64
  let ckptNode = new Int32Array(ckptCap)
  let ckptTail = new Int32Array(ckptCap)

  // Resolve the dominant no-variant static-group case through a direct epoch-stamped array
  // One load tests whether the group is claimed and one store records a new claim.
  const claim0 = new Int32Array(GROUP_COUNT)

  // Resolve variant contexts and dynamic groups through one epoch-stamped open-addressed set
  // `(ctxId, gid)` pairs are encoded as exact doubles, with both IDs bounded by `ID_LIMIT`.
  let CLAIM_TABLE = 2048
  let claimShift = 21 // 32 - log2(CLAIM_TABLE)
  let claimKeys = new Float64Array(CLAIM_TABLE)
  let claimEpochs = new Int32Array(CLAIM_TABLE)
  let epoch = 0
  // Test and claim a `(context, group)` pair in one probe
  // Return `1` when the pair was already claimed in this merge, otherwise claim it and return `0`.
  const claimTest = (ctx: number, gid: number): number => {
    if (ctx === 0 && gid < GROUP_COUNT) {
      if (claim0[gid] === epoch) return 1
      claim0[gid] = epoch
      return 0
    }
    const key = ctx * 2097152 + gid + 1
    let idx = Math.imul(key, 0x9e3779b1) >>> claimShift
    for (;;) {
      if (claimEpochs[idx] !== epoch) break // free slot
      if (claimKeys[idx] === key) return 1
      idx = (idx + 1) & (CLAIM_TABLE - 1)
    }
    claimKeys[idx] = key
    claimEpochs[idx] = epoch
    return 0
  }

  // Resolve an uncached utility through prefix parsing, modifier analysis, trie lookup, and validators
  const resolveAt = (
    input: string,
    bs: number,
    endPos: number,
    nodeAt: number,
    ckptAt: number
  ): number => {
    // Map arbitrary properties such as `[color:red]` to dynamic groups keyed by property name
    if (
      endPos - bs >= 2 &&
      input.charCodeAt(bs) === 91 &&
      input.charCodeAt(endPos - 1) === 93
    ) {
      let colon = -1
      for (let p = bs + 1; p < endPos - 1; p++) {
        if (input.charCodeAt(p) === 58) {
          colon = p
          break
        }
      }
      if (colon === -1 || colon === bs + 1) return EXTERNAL
      return internSpan(dynByHash, input, bs + 1, colon, 0, newDynId)
    }
    // Prefer an exact automaton match when the final node already owns a conflict group
    if (nodeAt >= 0 && nodeGroup[nodeAt] >= 0) return nodeGroup[nodeAt]
    // Backtrack from the deepest trie level so lifted literal matches beat validator matches
    // This preserves the same precedence that deeper literal trie paths have over validators.
    for (let k = ckptAt - 1; k >= 0; k--) {
      const tailStart = ckptTail[k]
      if (tailStart > endPos) continue
      const nodeId = ckptNode[k]
      const tlen = endPos - tailStart
      if (nodeHasLit[nodeId] === 1 && tlen > 0 && tlen <= litMaxLen) {
        // Skip literal probing for arbitrary-value tails unless the compiled pool can contain them
        const c0 = input.charCodeAt(tailStart)
        if (litNoArb === false || (c0 !== 91 && c0 !== 40)) {
          const g = litProbe(nodeId, input, tailStart, endPos)
          if (g >= 0) return g
        }
      }
      const vl = nodeVlist[nodeId]
      if (vl < 0) continue
      const pat = vlistRef[vl]
      const vs = vlistPat[pat]
      const ve = vlistPat[pat + 1]
      if (vs === ve) continue
      analyzeArb(input, tailStart, endPos)
      const g0 = vgStart[vl] - vs
      for (let v = vs; v < ve; v++) {
        if (runValidator(vlistOps[v], input, tailStart, endPos)) {
          return vlistGroup[g0 + v]
        }
      }
    }
    return EXTERNAL
  }

  // Merge one normalized class string while preserving surviving token order
  const mergeClassList = (input: string): string => {
    const n = input.length
    let tokenCount = 0
    let totalTokenChars = 0
    let sawNonSpaceWS = false

    // Reset bounded-growth intern tables only between merge calls so in-flight IDs never change
    if (nextCtxId > MAX_CTX || ctxByHash.size > MAX_CTX) {
      ctxByHash = new Map()
      ctxByCanon = new Map()
      nextCtxId = 2
      memoReset()
    }
    if (nextDynId > MAX_DYN) {
      dynByHash = new Map()
      nextDynId = GROUP_COUNT
      memoReset()
    }

    let i = 0
    while (i < n) {
      let c = input.charCodeAt(i)
      if (c === 32 || (c >= 9 && c <= 13) || (c >= 0xa0 && isUniWS(c))) {
        if (c !== 32) sawNonSpaceWS = true
        i++
        continue
      }
      const ts = i
      // Fold the memo hash into token scanning so classification never needs a second pass over characters
      let th = 0
      while (i < n) {
        c = input.charCodeAt(i)
        if (c <= 32) {
          if (c === 32) break
          if (c >= 9 && c <= 13) {
            sawNonSpaceWS = true
            break
          }
          // Preserve control characters outside JavaScript whitespace as ordinary token content
        } else if (c >= 0xa0 && isUniWS(c)) {
          sawNonSpaceWS = true
          break
        }
        th = Math.imul(th ^ c, 0x01000193)
        i++
      }
      const te = i
      const len = te - ts
      if (tokenCount === cap) growTokens()
      const t = tokenCount++
      tokStart[t] = ts
      tokEnd[t] = te
      totalTokenChars += len

      th ^= Math.imul(len, 0x9e3779b1)
      const h = (th ^ (th >>> 15)) | 0

      // Probe both token-memo ways before parsing so a hit completes with zero allocation
      const way0 = h & (TOKEN_TABLE - 1) & ~1
      {
        let hitAt = -1
        if (
          memoHash[way0] === h &&
          memoStr[way0] !== null &&
          memoStr[way0].length === len
        )
          hitAt = way0
        else if (
          memoHash[way0 | 1] === h &&
          memoStr[way0 | 1] !== null &&
          memoStr[way0 | 1].length === len
        )
          hitAt = way0 | 1
        if (hitAt >= 0) {
          const s = memoStr[hitAt]
          // Verify token characters in place because slicing for `===` would allocate on the cache-hit path
          let ok = true
          for (let k = 0; k < len; k++) {
            if (s.charCodeAt(k) !== input.charCodeAt(ts + k)) {
              ok = false
              break
            }
          }
          if (ok) {
            tokGid[t] = memoGid[hitAt]
            tokCtx[t] = memoCtx[hitAt]
            tokFlags[t] = memoFlags[hitAt]
            continue
          }
        }
      }

      // Parse the configured prefix and utility structure only after the token memo misses
      let pts = ts
      if (FPL !== 0) {
        if (te - ts <= FPL || !input.startsWith(FULL_PREFIX, ts)) {
          tokGid[t] = EXTERNAL
          memoPut(way0, input, ts, te, h, EXTERNAL, 0, 0)
          continue
        }
        pts = ts + FPL
      }
      let depthB = 0,
        depthP = 0
      let lastColon = -1,
        lastSlash = -1
      for (let p = pts; p < te; p++) {
        const pc = input.charCodeAt(p)
        if (depthB === 0 && depthP === 0) {
          if (pc === 58) {
            lastColon = p
            continue
          }
          if (pc === 47) {
            lastSlash = p
            continue
          }
        }
        if (pc === 91) depthB++
        else if (pc === 93) depthB--
        else if (pc === 40) depthP++
        else if (pc === 41) depthP--
      }

      const modStart = lastColon >= pts ? lastColon + 1 : pts

      // Recognize the Tailwind v4 `!` suffix first, then fall back to the legacy prefix form
      let bs = modStart
      let be = te
      let important = false
      let prefixShift = 0
      if (be > bs && input.charCodeAt(be - 1) === 33) {
        important = true
        be--
      } else if (be > bs && input.charCodeAt(bs) === 33) {
        important = true
        bs++
        prefixShift = 1
      }

      // Preserve upstream postfix-modifier semantics, including the legacy prefix-`!` index shift
      let postfixEnd = -1
      if (lastSlash > modStart) {
        postfixEnd = lastSlash + prefixShift
        if (postfixEnd >= be) postfixEnd = -1
      }

      // Feed the base utility through the radix automaton after structural parsing completes
      let feedStart = bs
      if (be - bs > 1 && input.charCodeAt(bs) === 45) feedStart = bs + 1 // negative values

      let node = 0
      let lp = 0 // label window: lp < le → mid-edge
      let le = 0
      let pending = -1
      let ckptTop = 0
      if (nodeVlist[0] >= 0 || nodeHasLit[0] === 1) {
        ckptNode[0] = 0
        ckptTail[0] = feedStart
        ckptTop = 1
      }
      let slashNode = DEAD
      let slashCkpt = 0

      for (let p = feedStart; p < be; p++) {
        if (p === postfixEnd) {
          slashNode = lp < le ? DEAD : node
          slashCkpt = ckptTop
        }
        if (node !== DEAD) {
          const cc = input.charCodeAt(p)
          let arrived = -1
          if (lp < le) {
            if (labelText.charCodeAt(lp) === cc) {
              lp++
              if (lp === le) arrived = node = pending
            } else node = DEAD
          } else {
            const es = edgeStart[node]
            const ee = edgeStart[node + 1]
            let next = DEAD
            for (let e = es; e < ee; e++) {
              const ls = labelStart[e]
              if (labelText.charCodeAt(ls) === cc) {
                if (labelStart[e + 1] - ls === 1) arrived = next = edgeTarget[e]
                else {
                  lp = ls + 1
                  le = labelStart[e + 1]
                  pending = edgeTarget[e]
                  next = node
                }
                break
              }
            }
            node = next
          }
          if (
            arrived >= 0 &&
            (nodeVlist[arrived] >= 0 || nodeHasLit[arrived] === 1) &&
            p + 1 < be &&
            input.charCodeAt(p + 1) === 45
          ) {
            if (ckptTop === ckptCap) {
              ckptCap *= 2
              const nv = new Int32Array(ckptCap)
              nv.set(ckptNode)
              ckptNode = nv
              const nt = new Int32Array(ckptCap)
              nt.set(ckptTail)
              ckptTail = nt
            }
            ckptNode[ckptTop] = arrived
            ckptTail[ckptTop] = p + 2
            ckptTop++
          }
        }
      }
      if (postfixEnd === be) {
        slashNode = lp < le ? DEAD : node
        slashCkpt = ckptTop
      }
      const endNode = lp < le ? DEAD : node

      let gid
      let hasPostfix = false
      if (postfixEnd >= 0) {
        hasPostfix = true
        gid = resolveAt(input, bs, postfixEnd, slashNode, slashCkpt)
        if (gid !== EXTERNAL && gid < GROUP_COUNT && postfixLookupSet[gid]) {
          const gidFull = resolveAt(input, bs, be, endNode, ckptTop)
          if (gidFull !== EXTERNAL && gidFull !== gid) {
            gid = gidFull
            hasPostfix = false
          }
        } else if (gid === EXTERNAL) {
          gid = resolveAt(input, bs, be, endNode, ckptTop)
          hasPostfix = false
        }
      } else {
        gid = resolveAt(input, bs, be, endNode, ckptTop)
      }

      let ctxId = 0
      let flags = 0
      if (gid === EXTERNAL) {
        tokGid[t] = EXTERNAL
      } else {
        flags = hasPostfix ? 1 : 0
        ctxId =
          pts >= lastColon
            ? important
              ? 1
              : 0
            : internSpan(
                ctxByHash,
                input,
                pts,
                lastColon,
                important ? 1 : 0,
                (k: string) => canonicalizeContext(k, important)
              )
        tokGid[t] = gid
        tokFlags[t] = flags
        tokCtx[t] = ctxId
      }

      memoPut(way0, input, ts, te, h, gid, ctxId, flags)
    }

    // Return immediately for empty and single-token inputs because no conflict pass is required
    if (tokenCount === 0) return ""
    if (tokenCount === 1) {
      return tokStart[0] === 0 && tokEnd[0] === n
        ? input
        : input.slice(tokStart[0], tokEnd[0])
    }

    // Walk tokens backward so the last conflicting utility wins, matching Tailwind semantics
    // Size the claim table from the compiled maximum fan-out and keep load below 50% so probes
    // stay short and the open-addressed table cannot fill during this merge.
    if (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
      while (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
        CLAIM_TABLE <<= 1
        claimShift--
      }
      claimKeys = new Float64Array(CLAIM_TABLE)
      claimEpochs = new Int32Array(CLAIM_TABLE)
    }
    if (nextCtxId >= ID_LIMIT || nextDynId >= ID_LIMIT)
      throw new Error("cn: too many distinct classes in one merge")
    // Keep the epoch in signed 32-bit form to match the backing arrays
    // When it wraps through zero, clear the arrays so stale slots cannot look claimed.
    epoch = (epoch + 1) | 0
    if (epoch === 0) {
      claim0.fill(0)
      claimEpochs.fill(0)
      epoch = 1
    }
    let didDrop = false
    for (let t = tokenCount - 1; t >= 0; t--) {
      const gid = tokGid[t]
      if (gid === EXTERNAL) {
        keep[t] = 1
        continue
      }
      const ctxId = tokCtx[t]
      if (claimTest(ctxId, gid) === 1) {
        keep[t] = 0
        didDrop = true
        continue
      }
      keep[t] = 1
      if (gid < GROUP_COUNT) {
        // Claim both ordinary conflicts and postfix-specific conflict pairs for the kept group
        const r = adjRow[gid]
        if (r >= 0) {
          for (let k = adjStart[r]; k < adjStart[r + 1]; k++)
            claimTest(ctxId, adjTgt[k])
        }
        if (tokFlags[t] & 1) {
          for (let k = 0; k < patGid.length; k++) {
            if (patGid[k] === gid) claimTest(ctxId, patTgt[k])
          }
        }
      }
    }

    // Emit surviving utilities after the backward conflict pass has finalized the keep mask
    if (!didDrop && !sawNonSpaceWS && n === totalTokenChars + tokenCount - 1) {
      return input // already normalized, nothing dropped
    }
    // Emit contiguous kept runs as single slices to reduce allocations and produce a flat string
    // Flat results are cheaper to hash when they later enter the whole-string cache.
    let out = ""
    let t = 0
    while (t < tokenCount) {
      if (!keep[t]) {
        t++
        continue
      }
      const runStart = tokStart[t]
      let runEnd = tokEnd[t]
      let u = t + 1
      while (
        u < tokenCount &&
        keep[u] &&
        tokStart[u] === runEnd + 1 &&
        input.charCodeAt(runEnd) === 32
      ) {
        runEnd = tokEnd[u]
        u++
      }
      if (out.length > 0) out += " "
      out += input.slice(runStart, runEnd)
      t = u
    }
    return out
  }

  // Admit whole strings to the result cache only after their second sighting
  // A two-generation doorkeeper keeps one-shot SSR traffic out of the cache while allowing
  // recurring working sets to warm without paying a full-string hash on every first sighting.
  // Two 16,384-slot generations use 128 KB and cover the observed p95 corpus working set.
  const DOOR_SIZE = 16384
  const door = new Int32Array(DOOR_SIZE * 2) // two generations, base-flipped
  let doorBase = 0
  let doorEpoch = 1
  let cache = Object.create(null)
  let prevCache = Object.create(null)
  let cacheMap = new Map<string, string>()
  let prevCacheMap = new Map<string, string>()
  let cacheCount = 0
  let doorMarks = 0
  // Rotate two generations instead of clearing sightings so larger recurring working sets can
  // accumulate the two observations required for admission. A full wipe measured 6–15× slower
  // on corpus replays because hot entries repeatedly lost their first sighting.
  // The previous generation always uses `doorEpoch - 1`; a 32-bit epoch wrap can only cause
  // one unnecessary cache insertion, never an incorrect merge result.
  const rotateDoor = () => {
    doorBase ^= DOOR_SIZE
    doorEpoch = (doorEpoch + 1) | 0
    doorMarks = 0
  }
  // Admit a string when its full 32-bit hash was seen in the current or previous generation
  // XORing the stored hash with the epoch self-invalidates older generations and makes false
  // admission from slot collisions extremely unlikely for cache-hostile one-shot streams.
  const mergeCached = (input: string): string => {
    // Check the warm result cache first so stable strings resolve with one property read on V8
    let merged = cache[input]
    if (merged !== undefined) return merged
    const hash = hashSampledSpan(input, 0, input.length)
    const slot = (hash & (DOOR_SIZE - 1)) + doorBase
    const wasSeen =
      door[slot] === (hash ^ doorEpoch) ||
      door[slot ^ DOOR_SIZE] === (hash ^ (doorEpoch - 1))
    if (wasSeen) {
      merged = prevCache[input]
      if (merged !== undefined) {
        cache[input] = merged // promote
        return merged
      }
    }
    merged = mergeClassList(input)
    if (wasSeen) {
      cache[input] = merged
      if (++cacheCount > cacheSize) {
        cacheCount = 0
        prevCache = cache
        cache = Object.create(null)
        rotateDoor()
      }
    } else {
      door[slot] = hash ^ doorEpoch
      if (++doorMarks > DOOR_SIZE) rotateDoor()
    }
    return merged
  }
  // Use a Map-backed copy for JavaScriptCore because its measured string-key lookup profile
  // favors Map over dictionary-mode objects, while V8 favors the object-backed path above.
  // Keeping the hot bodies separate avoids the accessor indirection that regressed V8 hits.
  const mergeCachedMap = (input: string): string => {
    let merged = cacheMap.get(input)
    if (merged !== undefined) return merged
    const hash = hashSampledSpan(input, 0, input.length)
    const slot = (hash & (DOOR_SIZE - 1)) + doorBase
    const wasSeen =
      door[slot] === (hash ^ doorEpoch) ||
      door[slot ^ DOOR_SIZE] === (hash ^ (doorEpoch - 1))
    if (wasSeen) {
      merged = prevCacheMap.get(input)
      if (merged !== undefined) {
        cacheMap.set(input, merged) // promote
        return merged
      }
    }
    merged = mergeClassList(input)
    if (wasSeen) {
      cacheMap.set(input, merged)
      if (++cacheCount > cacheSize) {
        cacheCount = 0
        prevCacheMap = cacheMap
        cacheMap = new Map()
        rotateDoor()
      }
    } else {
      door[slot] = hash ^ doorEpoch
      if (++doorMarks > DOOR_SIZE) rotateDoor()
    }
    return merged
  }
  // Detect first-sighting joined strings before touching the expensive whole-string cache
  // Newly constructed strings cannot benefit from identity reuse, so the doorkeeper lets callers
  // merge one-shot inputs uncached and reserve cache insertion for repeated values.
  const seenBefore = (input: string): boolean => {
    const hash = hashSampledSpan(input, 0, input.length)
    const slot = (hash & (DOOR_SIZE - 1)) + doorBase
    if (
      door[slot] === (hash ^ doorEpoch) ||
      door[slot ^ DOOR_SIZE] === (hash ^ (doorEpoch - 1))
    )
      return true
    door[slot] = hash ^ doorEpoch
    if (++doorMarks > DOOR_SIZE) rotateDoor()
    return false
  }
  // Keep JavaScriptCore's cache-hit front small enough to inline, while V8 uses the full closure
  // directly because outlining the body measured slower for long strings on V8.
  const mergeString =
    cacheSize === 0
      ? mergeClassList
      : IS_JSC
        ? (input: string): string => {
            const merged = cacheMap.get(input)
            return merged !== undefined ? merged : mergeCachedMap(input)
          }
        : mergeCached

  const merge = function (): string {
    return arguments.length === 1 && typeof arguments[0] === "string"
      ? mergeString(arguments[0])
      : mergeString(joinMergeInputs.apply(null, arguments as never))
  } as Engine["merge"]

  return {
    merge,
    mergeString,
    seenBefore: cacheSize === 0 ? () => false : seenBefore,
    mergeUncached: mergeClassList,
  }
}

