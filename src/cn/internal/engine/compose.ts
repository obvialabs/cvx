/**
 * Class-value composition and argument-level memoization for `cn`.
 *
 * This layer accepts the same public class-value grammar as `cx`, produces a
 * normalized class string, and delegates conflict resolution to a merge
 * function. Keeping this concern separate from the conflict parser makes the
 * public grammar reusable without coupling it to Tailwind classification.
 *
 * @internal
 */

import type { ClassValue } from "../../../cx/types.js"
import type { CnFunction, FreshMergeEngine, MergeInput } from "../types.js"

const resolveValue = (v: ClassValue, fullGrammar: boolean): string => {
  if (!v) return ""
  if (typeof v === "string") return v
  let out = ""
  if (
    typeof (v as { length?: unknown }).length === "number" &&
    (fullGrammar ? Array.isArray(v) : true)
  ) {
    const arr = v as ArrayLike<ClassValue>
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (!item) continue
      const r = typeof item === "string" ? item : resolveValue(item, fullGrammar)
      if (r) {
        if (out) out += " "
        out += r
      }
    }
    return out
  }
  if (fullGrammar) {
    if (typeof v === "object") {
      for (const k in v)
        if ((v as Record<string, unknown>)[k]) {
          if (out) out += " "
          out += k
        }
      return out
    }
    if (typeof v === "number" || typeof v === "bigint") return "" + v
  }
  return out
}

const joinArgs = (args: IArguments, fullGrammar: boolean): string => {
  let s = ""
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a) continue
    const r =
      typeof a === "string" ? a : resolveValue(a as ClassValue, fullGrammar)
    if (r) {
      if (s) s += " "
      s += r
    }
  }
  return s
}

/** Joins string/array merge inputs without object-grammar expansion. */
export const joinMergeInputs = function (): string {
  return joinArgs(arguments, false)
} as (...inputs: MergeInput[]) => string

/** Normalizes the complete CVX class-value grammar without conflict merging. */
export const composeClassValues = function (): string {
  return joinArgs(arguments, true)
} as (...inputs: ClassValue[]) => string

// Wraps a merge function with CVX class-value normalization and argument caching.
interface ArgEntry {
  /** merged result */
  r: string
  /** truthy arg count (=== a.length, denormalized for the unrolled probes) */
  t: number
  /** first three truthy args, '' padded — monomorphic fields so the arity
   *  fronts verify without an array indirection */
  a0: string
  a1: string
  a2: string
  /** the truthy string args, in order (identity-compared; generic paths) */
  a: string[]
  /** the entry that followed this one last time (sequence prediction) */
  n: ArgEntry | null
}

export const wrapComposer = (
  mergeString: (input: string) => string,
  fresh?: FreshMergeEngine
): CnFunction => {
  // without an engine's doorkeeper every join counts as seen and is cached
  const seenBefore = fresh === undefined ? () => true : fresh.seenBefore
  const mergeUncached = fresh === undefined ? mergeString : fresh.mergeUncached
  // arg-identity cache: repeated calls whose truthy args are the same string
  // *instances* (stable JSX literals — the dominant component shape) skip
  // the re-join and the O(n) hash of the fresh joined string. Only engages
  // when every truthy arg is a string: objects/arrays are mutable at the
  // same identity, so they always take the full resolve path.
  //
  // Render loops replay call *sequences*, not just calls, so each entry also
  // remembers which entry came next last time. When the prediction verifies
  // (pure identity compares), the call skips even the bucket lookup.
  let argCache = new Map<string, ArgEntry[]>()
  let prevArgCache = new Map<string, ArgEntry[]>()
  let argCount = 0
  let lastHit: ArgEntry | null = null

  // unrolled truthy-sequence verify for arity ≤ 3, against the entry's
  // monomorphic fields. Arity-2 calls pass '' as v2: a falsy pad skips the
  // slot, so the same code serves both arities. Non-string truthy args can
  // never strict-equal a string field, so they fail here and take the
  // resolve path below.
  const match3 = (
    e: ArgEntry,
    v0: ClassValue,
    v1: ClassValue,
    v2: ClassValue
  ): boolean => {
    let k = 0
    if (v0) {
      if (v0 !== e.a0) return false
      k = 1
    }
    if (v1) {
      if (v1 !== (k === 0 ? e.a0 : e.a1)) return false
      k++
    }
    if (v2) {
      if (v2 !== (k === 0 ? e.a0 : k === 1 ? e.a1 : e.a2)) return false
      k++
    }
    return k === e.t
  }

  // Generic path for any arity: probe cached argument identities before resolving
  // non-string args, bucket lookup, insert, chain update
  // loop-form verify for any arity (identity compares; non-strings never match)
  const matchN = (e: ArgEntry, vals: ClassValue[]): boolean => {
    const ea = e.a
    let k = 0
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i]
      if (!v) continue
      if (v !== ea[k]) return false
      k++
    }
    return k === e.t
  }

  const resolveArgs = (vals: ClassValue[], probed: boolean): string => {
    const nArgs = vals.length
    const pred = lastHit === null ? null : lastHit.n
    if (!probed) {
      if (pred !== null && matchN(pred, vals)) {
        lastHit = pred
        return pred.r
      }
      if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals))
        return lastHit.r
    }
    let first = ""
    let firstIdx = -1
    let truthy = 0
    let hasResolvedValue = false
    for (let i = 0; i < nArgs; i++) {
      let v = vals[i]
      if (!v) continue
      if (typeof v !== "string") {
        // objects and arrays resolve in place and ride the string path: a
        // one-key object resolves to that key string itself, whose identity
        // is stable across renders, so the arg cache still hits
        v = vals[i] = resolveValue(v as ClassValue, true)
        if (!v) continue
        hasResolvedValue = true
      }
      if (firstIdx < 0) {
        first = v
        firstIdx = i
      }
      truthy++
    }
    if (truthy === 0) return ""
    if (truthy === 1) return mergeString(first) // cheap path; chain untouched
    if (hasResolvedValue) {
      // the probes above saw the raw objects; retry them over the resolved
      // strings before paying for the bucket walk
      if (pred !== null && matchN(pred, vals)) {
        lastHit = pred
        return pred.r
      }
      if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals))
        return lastHit.r
    }
    let bucket = argCache.get(first)
    if (bucket === undefined) {
      bucket = prevArgCache.get(first)
      if (bucket !== undefined) argCache.set(first, bucket) // promote
    }
    let hit: ArgEntry | null = null
    if (bucket !== undefined) {
      outer: for (let b = 0; b < bucket.length; b++) {
        const e = bucket[b]!
        if (e.t !== truthy) continue
        const ea = e.a
        let k = 1
        for (let i = firstIdx + 1; i < nArgs; i++) {
          const v = vals[i]
          if (v && v !== ea[k++]) continue outer
        }
        hit = e
        break
      }
    }
    if (hit === null) {
      let joined = first
      const a: string[] = [first]
      for (let i = firstIdx + 1; i < nArgs; i++) {
        const v = vals[i]
        if (!v) continue
        joined += " " + (v as string)
        a.push(v as string)
      }
      // a first sighting is merged straight through: no dictionary lookup
      // on a fresh key, no cache entry anywhere, chain left untouched. A
      // repeat pays the lookup once and caches like before.
      if (!seenBefore(joined)) return mergeUncached(joined)
      hit = {
        r: mergeString(joined),
        t: a.length,
        a0: a[0]!,
        a1: a[1]!,
        a2: a[2] ?? "",
        a,
        n: null,
      }
      if (bucket === undefined) argCache.set(first, (bucket = []))
      // a component's base string is the first arg at every usage site, so
      // one key can carry dozens of tuples (54 in the largest corpus repo,
      // more once per-site className props count); a tight cap evicts them
      // faster than the sequence chain can learn them, at ~40x per call
      if (bucket.length >= 256) bucket.shift()
      bucket.push(hit)
      // two-generation rotation: a full generation ages out wholesale
      // instead of clearing everything; hot buckets get promoted on use,
      // so replayed sequences survive rotation and the chain stays warm
      if (++argCount > 1000) {
        argCount = 0
        prevArgCache = argCache
        argCache = new Map()
      }
    }
    if (lastHit !== null && lastHit !== hit) lastHit.n = hit
    lastHit = hit
    return hit.r
  }

  // A lone array follows the same flattening semantics as variadic input, so it takes
  // the arg path and its stable element identities hit the cache
  const mergeSingleValue = (value: ClassValue): string =>
    Array.isArray(value)
      ? resolveArgs(value.slice(), false)
      : mergeString(resolveValue(value, true))

  // named params make the hot path three register reads instead of three
  // `arguments` element loads; modules are strict, so params never alias
  // `arguments` (still used for arity and the 4+ overflow copy). Arity 2
  // rides the same branch as 3: an absent v2 is undefined, and a falsy pad
  // behaves identically to '' through the probes and the resolve path.
  return function (v0?: ClassValue, v1?: ClassValue, v2?: ClassValue): string {
    const nArgs = arguments.length
    if ((nArgs | 1) === 3) {
      // arity 2 or 3
      const lh = lastHit
      if (lh !== null) {
        // sequence prediction: does this call repeat what followed
        // last time?
        const pred = lh.n
        if (pred !== null && match3(pred, v0, v1, v2)) {
          lastHit = pred
          return pred.r
        }
        // self-repeat: the same call site firing again immediately.
        // Probed rather than stored as a self-link so an entry's
        // learned successor is never clobbered — a doubled site
        // (A, A, B) predicts all three calls: A→B via .n, the
        // repeat via this probe.
        if (lh !== pred && match3(lh, v0, v1, v2)) return lh.r
      }
      return resolveArgs([v0, v1, v2], true)
    }
    if (nArgs === 1)
      return typeof v0 === "string" ? mergeString(v0) : mergeSingleValue(v0)
    // 4+ arity: probe predictions in place over `arguments` (indexed
    // reads only, so it never materializes) — a predicted render-loop
    // call allocates nothing. Only a genuine miss copies into an array
    // for the resolve path.
    const lh = lastHit
    if (lh !== null) {
      const pred = lh.n
      if (pred !== null) {
        const pa = pred.a
        let k = 0
        let ok = true
        for (let i = 0; i < nArgs; i++) {
          const v = arguments[i]
          if (!v) continue
          if (v !== pa[k]) {
            ok = false
            break
          }
          k++
        }
        if (ok && k === pred.t) {
          lastHit = pred
          return pred.r
        }
      }
      if (lh !== pred) {
        const la = lh.a
        let k = 0
        let ok = true
        for (let i = 0; i < nArgs; i++) {
          const v = arguments[i]
          if (!v) continue
          if (v !== la[k]) {
            ok = false
            break
          }
          k++
        }
        if (ok && k === lh.t) return lh.r
      }
    }
    const vals: ClassValue[] = []
    for (let i = 0; i < nArgs; i++) vals.push(arguments[i])
    return resolveArgs(vals, true)
  } as CnFunction
}

