/**
 * Serializes compiled conflict data into a standalone ESM/TypeScript module.
 *
 * Source emission is internal tooling; the default published runtime imports
 * checked-in generated tables and never executes this path.
 *
 * @internal
 */

import type { CnConfig } from "./config.js"
import { compileModel } from "./model.js"

const PACK = 0x30
const packStr = (arr: ArrayLike<number>): string => {
  const a = Array.from(arr as ArrayLike<number>)
  for (const v of a)
    if (v + PACK >= 0xd800 || v < 0)
      throw new Error("cn compiler: unpackable value " + v)
  let s = ""
  for (let i = 0; i < a.length; i += 4096) {
    s += String.fromCharCode(...a.slice(i, i + 4096).map((v) => v + PACK))
  }
  return JSON.stringify(s)
}
const plus1 = (arr: ArrayLike<number>) =>
  Array.from(arr as ArrayLike<number>, (v) => v + 1)
const zig = (arr: ArrayLike<number>) =>
  Array.from(arr as ArrayLike<number>, (v) => (v << 1) ^ (v >> 31))
const deltas = (arr: ArrayLike<number>) => {
  let prev = 0
  return Array.from(arr as ArrayLike<number>, (v) => {
    const d = v - prev
    prev = v
    return d
  })
}

export interface EmitOptions {
  /** 'ts' annotates decoder helpers; 'js' emits plain JS (default 'js') */
  lang?: "ts" | "js"
  banner?: string
}

export const compileToSource = (
  config: CnConfig,
  options: EmitOptions = {}
): string => {
  const m = compileModel(config)
  if (m.customNames.length > 0) {
    throw new Error(
      "cn compiler: configs with custom validator functions cannot be emitted as a module " +
        `(functions are not serializable): ${m.customNames.join(", ")}. ` +
        "Use the internal configured composer factory at runtime instead."
    )
  }
  const ts = options.lang === "ts"
  const sig = {
    u: ts ? "(s: string, o = 0): Int32Array" : "(s, o = 0)",
    ps: ts ? "(counts: Int32Array): Int32Array" : "(counts)",
    dz: ts ? "(s: string): Int32Array" : "(s)",
  }
  // Sorted literal sets store their common prefix once.
  const setsText = m.sets
    .map((tails) => {
      const first = tails[0]!
      const last = tails[tails.length - 1]!
      let length = 0
      while (length < first.length && first[length] === last[length]) {
        length++
      }
      return [
        first.slice(0, length),
        ...tails.map((tail) => tail.slice(length)),
      ].join(" ")
    })
    .join("|")
  const attAnchorDelta: number[] = []
  const attGid: number[] = []
  const attSet: number[] = []
  {
    let prev = 0
    for (const a of m.attachments) {
      attAnchorDelta.push(a.anchor - prev)
      prev = a.anchor
      attGid.push(a.gid)
      attSet.push(a.set)
    }
  }
  const nodeVlistAnchors: number[] = []
  const nodeVlistValues: number[] = []
  for (let i = 0; i < m.nodeVlist.length; i++) {
    if (m.nodeVlist[i]! >= 0) {
      nodeVlistAnchors.push(i)
      nodeVlistValues.push(m.nodeVlist[i]!)
    }
  }
  const banner =
    options.banner ?? "// Generated CVX conflict tables. Do not edit by hand."
  return `${banner}
const P = ${PACK}
const U = ${sig.u} => {
    const out = new Int32Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) - P - o
    return out
}
const PS = ${sig.ps} => {
    const out = new Int32Array(counts.length + 1)
    for (let i = 0; i < counts.length; i++) out[i + 1] = out[i] + counts[i]
    return out
}
// zigzag-delta stream → running values
const DZ = ${sig.dz} => {
    const out = new Int32Array(s.length)
    let a = 0
    for (let i = 0; i < s.length; i++) {
        const z = s.charCodeAt(i) - P
        a += (z >>> 1) ^ -(z & 1)
        out[i] = a
    }
    return out
}
const GROUP_COUNT = ${m.G}
const customValidatorNames${ts ? ": string[]" : ""} = ${JSON.stringify(m.customNames)}
const edgeStart = PS(U(${packStr(m.edgeCounts)}))
const labelStart = PS(U(${packStr(m.edgeLabelLen)}))
const labelText = ${JSON.stringify(m.labelText)}
// pre-order tree: targets derived from edge counts via subtree sizes
const edgeTarget = (() => {
    const N = edgeStart.length - 1
    const sizes = new Int32Array(N)
    for (let i = N - 1; i >= 0; i--) {
        let s = 1
        let c = i + 1
        for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) { s += sizes[c]; c += sizes[c] }
        sizes[i] = s
    }
    const out = new Int32Array(edgeStart[N])
    let e = 0
    for (let i = 0; i < N; i++) {
        let c = i + 1
        for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) { out[e++] = c; c += sizes[c] }
    }
    return out
})()
const nodeGroup = U(${packStr(plus1(m.nodeGroup))}, 1)
// vlists = op-pattern pool + per-list refs; the engine indexes these directly
const vlistPat = PS(U(${packStr(m.patCounts)}))
const vlistOps = U(${packStr(m.patOps)})
const vlistRef = U(${packStr(m.listPat)})
const vlistGroup = DZ(${packStr(zig(deltas(m.vlistGroup)))})
// nodeVlist rebuilt sparse: (anchor deltas, vlist ids)
const nodeVlist = (() => {
    const out = new Int32Array(${m.nodeCount}).fill(-1)
    const A = DZ(${packStr(zig(deltas(nodeVlistAnchors)))})
    const V = DZ(${packStr(zig(deltas(nodeVlistValues)))})
    for (let i = 0; i < A.length; i++) out[A[i]] = V[i]
    return out
})()
const SETS = ${JSON.stringify(setsText)}.split('|').map((s) => {
    const tails = s.split(' ')
    const prefix = tails.shift()${ts ? "!" : ""}
    for (let i = 0; i < tails.length; i++) {
        tails[i] = prefix + tails[i]
    }
    return tails
})
const AA = DZ(${packStr(zig(attAnchorDelta))})
const AG = DZ(${packStr(zig(deltas(attGid)))})
const AS = DZ(${packStr(zig(deltas(attSet)))})
const litAnchor = new Int32Array(${m.litEntries.length})
const litGroup = new Int32Array(${m.litEntries.length})
const litPool = new Int32Array(${m.litEntries.length})
let poolText = ''
const poolOffsets = new Int32Array(${m.uniqueTailCount * 2})
{
    const tailRef = new Map()
    let nextRef = 0
    let e = 0
    for (let i = 0; i < AA.length; i++) {
        for (const tail of SETS[AS[i]]) {
            let r = tailRef.get(tail)
            if (r === undefined) {
                r = nextRef++
                tailRef.set(tail, r)
                poolOffsets[r * 2] = poolText.length
                poolOffsets[r * 2 + 1] = tail.length
                poolText += tail
            }
            litAnchor[e] = AA[i]
            litGroup[e] = AG[i]
            litPool[e] = r
            e++
        }
    }
}
// conflict adjacency (engine builds claim bitmask CSR at init)
const adjGid = DZ(${packStr(zig(deltas(m.adjGid)))})
const adjStart = PS(U(${packStr(m.adjCnt)}))
const adjTgt = DZ(${packStr(zig(deltas(m.adjTgt)))})
const patGid = U(${packStr(m.patGid)})
const patTgt = U(${packStr(m.patTgt)})
const postfixLookupGroups = U(${packStr(m.postfixLookup)})
const orderSensitiveModifiers = ${JSON.stringify(m.orderSensitiveModifiers)}
export default {
    GROUP_COUNT, customValidatorNames, edgeStart, labelStart, labelText,
    edgeTarget, nodeGroup, nodeVlist, vlistPat, vlistOps, vlistRef, vlistGroup,
    litAnchor, litGroup, litPool, poolOffsets, poolText,
    adjGid, adjStart, adjTgt, patGid, patTgt, postfixLookupGroups,
    orderSensitiveModifiers,${m.prefix ? " prefix: " + JSON.stringify(m.prefix) + "," : ""}
}
`
}

