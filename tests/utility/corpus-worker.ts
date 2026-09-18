import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"

/**
 * Return one percentile from an ascending numeric sample collection
 *
 * **Parameters**
 * - `ordered` – Ascending timing samples
 * - `fraction` – Percentile expressed in the inclusive range `[0, 1]`
 *
 * **Returns**
 * - `number` – Sample selected for the requested percentile
 */
const percentile = (
  ordered: readonly number[],
  fraction: number,
): number => {
  const index = Math.min(
    ordered.length - 1,
    Math.max(
      0,
      Math.ceil(
        ordered.length * fraction,
      ) - 1,
    ),
  )

  return ordered[index]!
}

const implementation = process.argv[2]
const corpusName = process.argv[3]
const corpusPath = process.argv[4]
const warmupMs = Number(process.argv[5])
const blockMs = Number(process.argv[6])
const blocks = Number(process.argv[7])

if (
  implementation !== "baseline" &&
  implementation !== "cvx"
) {
  throw new Error(
    `benchmark corpus worker: unknown implementation ${implementation}`,
  )
}

if (
  !corpusName ||
  !corpusPath
) {
  throw new Error(
    "benchmark corpus worker: missing corpus metadata",
  )
}

if (
  !Number.isFinite(warmupMs) ||
  !Number.isFinite(blockMs) ||
  !Number.isInteger(blocks) ||
  warmupMs < 0 ||
  blockMs <= 0 ||
  blocks <= 0
) {
  throw new Error(
    "benchmark corpus worker: invalid sampling configuration",
  )
}

// Load and decode the selected corpus before any timed region begins
const calls = JSON.parse(
  gunzipSync(
    readFileSync(corpusPath),
  ).toString("utf8"),
) as string[][]

let merge: (...values: string[]) => string

// Load only the implementation being measured so every worker owns an isolated heap
if (implementation === "baseline") {
  const { clsx } = await import("clsx")
  const { twMerge } = await import("tailwind-merge")

  merge = (...values) =>
    twMerge(clsx(...values))
} else {
  const { cn } = await import("../../src")

  merge = cn
}

let sink = 0

/**
 * Replay every captured call once in repository order
 *
 * **Returns**
 * - `number` – Sum of produced string lengths used to keep results observable
 */
const replay = (): number => {
  let length = 0

  for (const call of calls) {
    length += merge(...call).length
  }

  return length
}

// Warm at least two complete replays before honoring the wall-clock target
const warmupStartedAt = performance.now()
sink += replay()
sink += replay()

while (
  performance.now() - warmupStartedAt <
  warmupMs
) {
  sink += replay()
}

const samples: number[] = []

// Measure complete repository replays so call ordering and cache locality remain intact
for (
  let block = 0;
  block < blocks;
  block++
) {
  const startedAt = performance.now()
  let replays = 0

  do {
    sink += replay()
    replays++
  } while (
    performance.now() - startedAt <
    blockMs
  )

  const elapsedMs =
    performance.now() - startedAt
  const totalCalls =
    replays * calls.length

  samples.push(
    (elapsedMs * 1e6) / totalCalls,
  )
}

const ordered = [...samples].sort(
  (left, right) => left - right,
)

// Keep the accumulated output observable without polluting the JSON protocol
if (sink === Number.MIN_SAFE_INTEGER) {
  process.stderr.write("\n")
}

console.log(
  JSON.stringify({
    implementation,
    corpus: corpusName,
    calls: calls.length,
    samples,
    p50: percentile(ordered, 0.5),
    p95: percentile(ordered, 0.95),
  }),
)
