/**
 * Allocation-free hashing helpers used by the Tailwind conflict engine
 *
 * Both helpers operate on string spans so the merge hot path can classify and
 * cache utilities without allocating substrings.
 *
 * @internal
 */

/**
 * Hash a complete string span with an FNV-style rolling hash
 *
 * **Parameters**
 * - `value` – Source string containing the span
 * - `start` – Inclusive start offset
 * - `end` – Exclusive end offset
 *
 * **Returns**
 * A deterministic 32-bit hash for the selected span
 *
 * @internal
 */
export const hashSpan = (value: string, start: number, end: number): number => {
  let hash = 0x811c9dc5

  for (let index = start; index < end; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }

  return hash
}

/**
 * Hash representative positions from a string span in constant time
 *
 * This hash is used only by the cache doorkeeper. The full-hash cache tag
 * still protects correctness, so a sampled-hash collision can at worst cause
 * one unnecessary cache admission rather than an incorrect merge result.
 *
 * **Parameters**
 * - `value` – Source string containing the span
 * - `start` – Inclusive start offset
 * - `end` – Exclusive end offset
 *
 * **Returns**
 * A sampled 32-bit hash suitable for admission filtering
 *
 * @internal
 */
export const hashSampledSpan = (
  value: string,
  start: number,
  end: number,
): number => {
  const length = end - start
  let hash = Math.imul(length, 0x9e3779b1) ^ value.charCodeAt(start)

  if (length > 3) {
    const quarter = length >> 2
    const middle = length >> 1

    hash = Math.imul(
      hash ^
        (value.charCodeAt(start + 1) << 8) ^
        (value.charCodeAt(start + 2) << 16) ^
        value.charCodeAt(start + quarter),
      0x85ebca6b,
    )

    hash = Math.imul(
      hash ^
        (value.charCodeAt(start + middle) << 8) ^
        (value.charCodeAt(start + middle + quarter) << 16) ^
        value.charCodeAt(end - 3),
      0xc2b2ae35,
    )

    hash ^=
      (value.charCodeAt(end - 2) << 8) ^
      (value.charCodeAt(end - 1) << 16)

    // Fold additional characters from both ends so arbitrary values with different payloads do not collapse onto the same sampled hash
    for (let left = start + 3, right = end - 4; left < start + 8 && left < right; left++, right--) {
      hash = Math.imul(
        hash ^ value.charCodeAt(left) ^ (value.charCodeAt(right) << 8),
        0x01000193,
      )
    }
  }

  return (hash ^ (hash >>> 15)) | 0
}
