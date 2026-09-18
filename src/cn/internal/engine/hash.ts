/**
 * Allocation-free hashing helpers used by the conflict engine.
 *
 * These functions operate on string spans so the hot path does not allocate
 * substrings merely to classify or cache Tailwind utilities.
 *
 * @internal
 */

export const hashSpan = (str: string, s: number, e: number): number => {
  let h = 0x811c9dc5
  for (let p = s; p < e; p++) h = Math.imul(h ^ str.charCodeAt(p), 0x01000193)
  return h
}

// positional span hash: O(1) regardless of length; samples head, quarter
// points, and tail. Used only by the doorkeeper, whose full-hash tag makes
// a collision cost one wasted cache insert, never a wrong result.
export const hashSampledSpan = (str: string, s: number, e: number): number => {
  const len = e - s
  let h = Math.imul(len, 0x9e3779b1) ^ str.charCodeAt(s)
  if (len > 3) {
    const q = len >> 2
    const m = len >> 1
    h = Math.imul(
      h ^
        (str.charCodeAt(s + 1) << 8) ^
        (str.charCodeAt(s + 2) << 16) ^
        str.charCodeAt(s + q),
      0x85ebca6b
    )
    h = Math.imul(
      h ^
        (str.charCodeAt(s + m) << 8) ^
        (str.charCodeAt(s + m + q) << 16) ^
        str.charCodeAt(e - 3),
      0xc2b2ae35
    )
    h ^= (str.charCodeAt(e - 2) << 8) ^ (str.charCodeAt(e - 1) << 16)
    // arbitrary values keep their digits a few chars from an end
    // (`w-[123px]`, `bg-[#a1b2c3]`), between the samples above: fold five
    // more chars from each end, walking inwards, so those strings stop
    // colliding (one loop, two reads: the fold has to stay small enough
    // for mergeCached to keep inlining into its callers)
    for (let p = s + 3, q = e - 4; p < s + 8 && p < q; p++, q--)
      h = Math.imul(
        h ^ str.charCodeAt(p) ^ (str.charCodeAt(q) << 8),
        0x01000193
      )
  }
  return (h ^ (h >>> 15)) | 0
}

