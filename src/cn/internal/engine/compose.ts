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

import type { ClassInput, ClassResolver, ClassValue } from "../../../cx/types"
import type { CnFunction, FreshMergeEngine, MergeInput } from "../types"

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

/**
 * Join low-level merge inputs without expanding dictionary-style class values
 *
 * **Parameters**
 * - `inputs` – Strings, nested arrays, and falsy values accepted by the conflict engine
 *
 * **Returns**
 * A normalized space-delimited class string ready for conflict resolution
 *
 * @internal
 */
export const joinMergeInputs = function (): string {
  return joinArgs(arguments, false)
} as (...inputs: MergeInput[]) => string

/**
 * Normalize the complete CVX class-value grammar without resolving conflicts
 *
 * **Parameters**
 * - `inputs` – Class values using the same grammar accepted by public `cx` and `cn`
 *
 * **Returns**
 * A normalized space-delimited class string
 *
 * @internal
 */
export const composeClassValues = function (): string {
  return joinArgs(arguments, true)
} as (...inputs: ClassValue[]) => string

/**
 * Cached argument tuple used by the class-value composition front end
 *
 * @internal
 */
interface ArgEntry {
  /**
   * Conflict-resolved class string for this argument tuple
   */
  r: string
  /**
   * Number of truthy arguments represented by the entry
   */
  t: number
  /**
   * First truthy argument stored directly for the unrolled hot-path probes
   */
  a0: string

  /**
   * Second truthy argument stored directly for the unrolled hot-path probes
   */
  a1: string

  /**
   * Third truthy argument stored directly for the unrolled hot-path probes
   */
  a2: string
  /**
   * Truthy string arguments retained for generic-arity identity comparisons
   */
  a: string[]
  /**
   * Entry that followed this tuple during the previous render sequence
   */
  n: ArgEntry | null
}

/**
 * Wrap a normalized-string merge function with CVX class-value composition and argument caching
 *
 * Stable string arguments are compared by identity before the wrapper allocates
 * a joined string. Repeated render sequences retain their most likely next
 * tuple so common component call patterns can bypass bucket lookups entirely.
 *
 * **Parameters**
 * - `mergeString` – Conflict resolver for one normalized class string
 * - `fresh` – Optional first-sighting hooks used to avoid caching one-shot joined strings
 *
 * **Returns**
 * A `cn`-compatible class composer accepting the complete CVX class-value grammar
 *
 * @internal
 */
export const wrapComposer = (
  mergeString: (input: string) => string,
  fresh?: FreshMergeEngine,
): CnFunction => {
  // Treat every joined value as previously seen when no doorkeeper is available
  const seenBefore = fresh === undefined ? () => true : fresh.seenBefore
  const mergeUncached = fresh === undefined ? mergeString : fresh.mergeUncached
  // Cache argument identities so stable JSX literals can skip both re-composition and hashing
  // Mutable arrays and objects still take the normalization path before they become cacheable.
  // Each cache entry also remembers the tuple that followed it so repeated render sequences can
  // bypass bucket lookup when the call order is predictable.
  let argCache = new Map<string, ArgEntry[]>()
  let prevArgCache = new Map<string, ArgEntry[]>()
  let argCount = 0
  let lastHit: ArgEntry | null = null

  // Probe up to three truthy arguments through monomorphic fields before using the generic array path
  // Falsy padding lets the same probe cover smaller arities without allocating a temporary list.
  const match3 = (
    e: ArgEntry,
    v0: ClassInput<any>,
    v1: ClassInput<any>,
    v2: ClassInput<any>
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

  // Use the generic identity path for larger arities and values that require normalization
  const matchN = (e: ArgEntry, vals: ClassInput<any>[]): boolean => {
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

  /**
   * Prepare one state-aware class composer without changing the static hot path
   *
   * Static inputs are normalized once when the resolver is created. Resolver
   * inputs remain callable and are evaluated for each state supplied by the
   * consuming component library.
   *
   * @internal
   */
  const createStatefulComposer = (
    vals: ClassInput<any>[],
  ): ((state: any) => string) => {
    const prepared: Array<string | ClassResolver<any>> = new Array(vals.length)

    for (let index = 0; index < vals.length; index++) {
      const value = vals[index]
      prepared[index] =
        typeof value === "function"
          ? value
          : typeof value === "string"
            ? value
            : resolveValue(value, true)
    }

    return (state: any): string => {
      const resolved: ClassValue[] = new Array(prepared.length)

      for (let index = 0; index < prepared.length; index++) {
        const value = prepared[index]
        resolved[index] = typeof value === "function" ? value(state) : value
      }

      // Resolver return values are ClassValue-only, so this path cannot create
      // another state callback and always resolves to the final merged string.
      return resolveArgs(resolved, false) as string
    }
  }

  const resolveArgs = (
    vals: ClassInput<any>[],
    probed: boolean,
  ): string | ((state: any) => string) => {
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
        // Resolver inputs turn the whole composition into a state-aware callback.
        // This branch lives behind the existing non-string check so all-string
        // benchmark paths keep the same control flow as before.
        if (typeof v === "function") return createStatefulComposer(vals)

        // Normalize structured class values once and keep the result available for later cache probes
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
    if (truthy === 1) return mergeString(first) // Preserve the prediction chain for the single-value fast path
    if (hasResolvedValue) {
      // Retry the prediction probes after normalization before scanning an argument bucket
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
      if (bucket !== undefined) argCache.set(first, bucket) // Promote a previous-generation bucket on reuse
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
      // Keep a first-seen joined string out of the whole-string cache
      // A repeated value pays the lookup once on its second sighting and then follows the normal cache path.
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
      // Keep enough tuples per base class for realistic component call sites
      // Large call sites can produce dozens of variants for one leading class, so a tight cap would evict
      // tuples faster than the sequence predictor can learn them.
      if (bucket.length >= 256) bucket.shift()
      bucket.push(hit)
      // Rotate cache generations instead of clearing all tuples at once
      // Reused buckets are promoted into the current generation so hot render sequences stay warm.
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

  // Route a lone array through the same identity-cache path as variadic input
  // Stable element identities can then hit the same tuple cache instead of forcing whole-array treatment.
  const mergeSingleValue = (
    value: ClassInput<any>,
  ): string | ((state: any) => string) =>
    typeof value === "function"
      ? createStatefulComposer([value])
      : Array.isArray(value)
        ? resolveArgs(value.slice(), false)
        : mergeString(resolveValue(value, true))

  // Keep the first three values as named parameters so the common path uses direct register reads
  // `arguments` remains available for arity detection and the uncommon 4+ path. Two arguments share the
  // three-argument probe because an absent third value behaves like the other falsy padding values.
  return function (
    v0?: ClassInput<any>,
    v1?: ClassInput<any>,
    v2?: ClassInput<any>,
  ): string | ((state: any) => string) {
    const nArgs = arguments.length
    if ((nArgs | 1) === 3) {
      // Handle the dominant two- and three-argument forms without materializing an argument array
      const lh = lastHit
      if (lh !== null) {
        // Probe the tuple that followed the previous hit before scanning the full bucket
        const pred = lh.n
        if (pred !== null && match3(pred, v0, v1, v2)) {
          lastHit = pred
          return pred.r
        }
        // Detect immediate self-repeats without replacing the learned successor link
        // Keeping the repeat as a probe instead of a self-link preserves sequences such as A, A, B:
        // the repeated A resolves here while A can still predict B through its successor pointer.
        if (lh !== pred && match3(lh, v0, v1, v2)) return lh.r
      }
      return resolveArgs([v0, v1, v2], true)
    }
    if (nArgs === 1)
      return typeof v0 === "string" ? mergeString(v0) : mergeSingleValue(v0)
    // Probe four-or-more-argument predictions directly from `arguments` before allocating an array
    // A predicted render-loop call therefore remains allocation-free; only a genuine miss copies values.
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
    const vals: ClassInput<any>[] = []
    for (let i = 0; i < nArgs; i++) vals.push(arguments[i])
    return resolveArgs(vals, true)
  } as CnFunction
}

