import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { gunzipSync } from "node:zlib"

import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

import { cn } from "../../src"

/**
 * One captured class-composition call from a real repository corpus
 */
export type CorpusCall = readonly string[]

/**
 * Metadata retained for one repository corpus snapshot
 */
export interface CorpusEntry {
  /**
   * Stable fixture name used by benchmark output and filenames
   */
  name: string

  /**
   * Public source repository from which call shapes were captured
   */
  repository: string

  /**
   * Number of captured class-composition calls
   */
  calls: number

  /**
   * SHA-256 digest of the canonical uncompressed JSON payload
   */
  sha256: string

  /**
   * Compressed fixture size in bytes
   */
  compressedBytes: number

  /**
   * Source revision when retained by the capture process
   */
  revision: string | null
}

/**
 * Manifest describing every checked-in repository corpus
 */
export interface CorpusManifest {
  /**
   * Manifest schema version
   */
  version: 1

  /**
   * Serialized call shape stored by every corpus fixture
   */
  format: "string[][]"

  /**
   * Repository corpus snapshots available for replay
   */
  entries: CorpusEntry[]
}

/**
 * Measurement emitted by one isolated corpus worker
 */
export interface CorpusWorkerMeasurement {
  /**
   * Compared implementation identifier
   */
  implementation: "baseline" | "cvx"

  /**
   * Repository corpus name
   */
  corpus: string

  /**
   * Calls executed by one complete corpus replay
   */
  calls: number

  /**
   * Raw nanoseconds-per-call samples collected from isolated timed blocks
   */
  samples: number[]

  /**
   * Median nanoseconds per call
   */
  p50: number

  /**
   * 95th percentile nanoseconds per call
   */
  p95: number
}

/**
 * Comparable replay result for one repository corpus
 */
export interface CorpusReplayResult {
  /**
   * Repository corpus name
   */
  name: string

  /**
   * Public source repository URL
   */
  repository: string

  /**
   * Number of captured calls replayed in order
   */
  calls: number

  /**
   * Parity mismatches observed before measurement
   */
  mismatches: number

  /**
   * Isolated `clsx + tailwind-merge` measurement
   */
  baseline: CorpusWorkerMeasurement

  /**
   * Isolated CVX `cn` measurement
   */
  current: CorpusWorkerMeasurement

  /**
   * Baseline median divided by the CVX median
   */
  relativeToCurrent: number
}

/**
 * Complete real-repository corpus replay report
 */
export interface CorpusReplayReport {
  /**
   * Report schema version
   */
  version: 1

  /**
   * Number of repository snapshots replayed
   */
  repositories: number

  /**
   * Total number of captured calls across selected repositories
   */
  calls: number

  /**
   * Number of repositories where CVX measured faster than the baseline
   */
  currentWins: number

  /**
   * Geometric mean of per-repository baseline-to-CVX ratios
   */
  geometricMeanSpeedup: number

  /**
   * Corpus worker sampling method
   */
  method: {
    warmupMs: number
    blockMs: number
    blocks: number
  }

  /**
   * Per-repository measurements
   */
  results: CorpusReplayResult[]
}

/**
 * Directory containing benchmark-only corpus fixtures
 */
const CORPORA_DIRECTORY = fileURLToPath(
  new URL("../fixtures/corpora/", import.meta.url),
)

/**
 * Manifest describing the checked-in corpus snapshots
 */
const MANIFEST_PATH = fileURLToPath(
  new URL("../fixtures/corpora/manifest.json", import.meta.url),
)

/**
 * Isolated worker used for one implementation and repository pair
 */
const WORKER_PATH = fileURLToPath(
  new URL("./corpus-worker.ts", import.meta.url),
)

/**
 * Sampling configuration shared with the isolated worker
 */
export const CORPUS_BENCHMARK_METHOD = Object.freeze({
  warmupMs: 300,
  blockMs: 200,
  blocks: 5,
})

/**
 * Read the checked-in corpus manifest
 *
 * **Returns**
 * - `CorpusManifest` – Parsed metadata for every available repository corpus
 */
export const loadCorpusManifest = (): CorpusManifest => {
  const manifest = JSON.parse(
    readFileSync(MANIFEST_PATH, "utf8"),
  ) as CorpusManifest

  if (
    manifest.version !== 1 ||
    manifest.format !== "string[][]" ||
    !Array.isArray(manifest.entries)
  ) {
    throw new Error("benchmark corpus: unsupported manifest")
  }

  return manifest
}

/**
 * Return the compressed fixture path for one corpus entry
 *
 * **Parameters**
 * - `entry` – Corpus manifest entry to resolve
 *
 * **Returns**
 * - `string` – Absolute path to the gzip-compressed corpus fixture
 */
export const corpusPathFor = (
  entry: CorpusEntry,
): string => `${CORPORA_DIRECTORY}${entry.name}.json.gz`

/**
 * Load and validate one compressed repository corpus
 *
 * **Parameters**
 * - `entry` – Corpus metadata describing the fixture to load
 * - `verifyIntegrity` – Whether to verify the canonical payload digest
 *
 * **Returns**
 * - `CorpusCall[]` – Captured class-composition calls in repository order
 */
export const loadCorpus = (
  entry: CorpusEntry,
  verifyIntegrity = false,
): CorpusCall[] => {
  const compressed = readFileSync(
    corpusPathFor(entry),
  )
  const payload = gunzipSync(compressed)

  if (verifyIntegrity) {
    const digest = createHash("sha256")
      .update(payload)
      .digest("hex")

    if (digest !== entry.sha256) {
      throw new Error(
        `benchmark corpus: checksum mismatch for ${entry.name}`,
      )
    }
  }

  const calls = JSON.parse(
    payload.toString("utf8"),
  ) as unknown

  if (!Array.isArray(calls)) {
    throw new Error(
      `benchmark corpus: ${entry.name} is not an array`,
    )
  }

  if (calls.length !== entry.calls) {
    throw new Error(
      `benchmark corpus: ${entry.name} expected ${entry.calls} calls, received ${calls.length}`,
    )
  }

  for (let index = 0; index < calls.length; index++) {
    const call = calls[index]

    if (
      !Array.isArray(call) ||
      call.some((value) => typeof value !== "string")
    ) {
      throw new Error(
        `benchmark corpus: ${entry.name} contains an invalid call at index ${index}`,
      )
    }
  }

  return calls as CorpusCall[]
}

/**
 * Count observable output differences between CVX and the reference merge pair
 *
 * **Parameters**
 * - `calls` – Repository corpus calls to compare
 *
 * **Returns**
 * - `number` – Number of calls whose CVX output differs from `clsx + tailwind-merge`
 */
export const countCorpusMismatches = (
  calls: readonly CorpusCall[],
): number => {
  let mismatches = 0

  for (const call of calls) {
    if (
      cn(...call) !==
      twMerge(clsx(...call))
    ) {
      mismatches++
    }
  }

  return mismatches
}

/**
 * Parse an optional repository filter from the benchmark environment
 *
 * `CVX_BENCHMARK_CORPORA` accepts a comma-separated repository list. The
 * default and the explicit value `all` replay every checked-in corpus.
 *
 * **Parameters**
 * - `entries` – Complete manifest entry collection
 *
 * **Returns**
 * - `CorpusEntry[]` – Repository entries selected for the current benchmark run
 */
const selectCorpusEntries = (
  entries: readonly CorpusEntry[],
): CorpusEntry[] => {
  const requested =
    process.env.CVX_BENCHMARK_CORPORA?.trim()

  if (
    !requested ||
    requested === "all"
  ) {
    return [...entries]
  }

  const names = new Set(
    requested
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  )

  const selected = entries.filter(
    (entry) => names.has(entry.name),
  )

  if (selected.length !== names.size) {
    const found = new Set(
      selected.map((entry) => entry.name),
    )
    const missing = [...names].filter(
      (name) => !found.has(name),
    )

    throw new Error(
      `benchmark corpus: unknown repositories ${missing.join(", ")}`,
    )
  }

  return selected
}

/**
 * Run one implementation against one corpus in a fresh Bun process
 *
 * **Parameters**
 * - `implementation` – Reference pair or CVX implementation to measure
 * - `entry` – Repository corpus to replay
 *
 * **Returns**
 * - `CorpusWorkerMeasurement` – Isolated median and raw timing samples
 */
const measureCorpusImplementation = (
  implementation: "baseline" | "cvx",
  entry: CorpusEntry,
): CorpusWorkerMeasurement => {
  const child = spawnSync(
    process.execPath,
    [
      WORKER_PATH,
      implementation,
      entry.name,
      corpusPathFor(entry),
      String(CORPUS_BENCHMARK_METHOD.warmupMs),
      String(CORPUS_BENCHMARK_METHOD.blockMs),
      String(CORPUS_BENCHMARK_METHOD.blocks),
    ],
    {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
    },
  )

  if (
    child.status !== 0 ||
    !child.stdout
  ) {
    throw new Error(
      `benchmark corpus: ${implementation}/${entry.name} worker failed\n${child.stderr || child.stdout}`,
    )
  }

  const line = child.stdout
    .trim()
    .split(/\r?\n/)
    .at(-1)

  if (!line) {
    throw new Error(
      `benchmark corpus: ${implementation}/${entry.name} worker returned no measurement`,
    )
  }

  return JSON.parse(line) as CorpusWorkerMeasurement
}

/**
 * Return the geometric mean for positive numeric values
 *
 * **Parameters**
 * - `values` – Positive values whose geometric mean should be calculated
 *
 * **Returns**
 * - `number` – Geometric mean of the supplied values
 */
const geometricMean = (
  values: readonly number[],
): number => {
  if (values.length === 0) {
    return 1
  }

  return Math.exp(
    values.reduce(
      (sum, value) =>
        sum + Math.log(value),
      0,
    ) / values.length,
  )
}

/**
 * Replay real repository corpora through isolated reference and CVX processes
 *
 * Parity is verified before timing so aggregate performance measurements never
 * include repositories where the compared implementations produce different
 * observable output.
 *
 * **Returns**
 * - `CorpusReplayReport` – Per-repository timings and aggregate replay metrics
 */
export const runCorpusReplayBenchmarks = (): CorpusReplayReport => {
  const manifest = loadCorpusManifest()
  const entries = selectCorpusEntries(
    manifest.entries,
  )
  const results: CorpusReplayResult[] = []

  for (
    let index = 0;
    index < entries.length;
    index++
  ) {
    const entry = entries[index]!
    const calls = loadCorpus(entry)
    const mismatches = countCorpusMismatches(calls)

    if (mismatches > 0) {
      throw new Error(
        `benchmark corpus: ${entry.name} differs from clsx + tailwind-merge on ${mismatches} calls`,
      )
    }

    // Alternate process order so repository position does not systematically
    // favor the same implementation through thermal or scheduler drift.
    const currentFirst = index % 2 === 1
    const first = measureCorpusImplementation(
      currentFirst ? "cvx" : "baseline",
      entry,
    )
    const second = measureCorpusImplementation(
      currentFirst ? "baseline" : "cvx",
      entry,
    )
    const baseline =
      first.implementation === "baseline"
        ? first
        : second
    const current =
      first.implementation === "cvx"
        ? first
        : second

    results.push({
      name: entry.name,
      repository: entry.repository,
      calls: entry.calls,
      mismatches,
      baseline,
      current,
      relativeToCurrent:
        baseline.p50 / current.p50,
    })
  }

  return {
    version: 1,
    repositories: results.length,
    calls: results.reduce(
      (total, result) =>
        total + result.calls,
      0,
    ),
    currentWins: results.filter(
      (result) =>
        result.current.p50 <
        result.baseline.p50,
    ).length,
    geometricMeanSpeedup: geometricMean(
      results.map(
        (result) =>
          result.relativeToCurrent,
      ),
    ),
    method: {
      ...CORPUS_BENCHMARK_METHOD,
    },
    results,
  }
}

/**
 * Format one duration using nanoseconds or microseconds
 *
 * **Parameters**
 * - `nanoseconds` – Duration to format
 *
 * **Returns**
 * - `string` – Compact human-readable duration
 */
const formatDuration = (
  nanoseconds: number,
): string =>
  nanoseconds >= 1_000
    ? `${(nanoseconds / 1_000).toFixed(2)} µs`
    : `${nanoseconds.toFixed(2)} ns`

/**
 * Format a real-repository corpus replay report for terminal and CI output
 *
 * **Parameters**
 * - `report` – Completed corpus replay report
 *
 * **Returns**
 * - `string` – Multi-line benchmark summary including every repository result
 */
export const formatCorpusReplayReport = (
  report: CorpusReplayReport,
): string => {
  const lines = [
    "@obvia/cvx real-world corpus replay",
    `corpora: ${report.repositories} repositories · ${report.calls.toLocaleString("en-US")} captured calls`,
    `method: isolated process per implementation/repository · ${report.method.blocks} blocks × ${report.method.blockMs}ms · ${report.method.warmupMs}ms warmup · p50`,
    `parity: every measured call matches clsx + tailwind-merge`,
    `summary: CVX faster on ${report.currentWins}/${report.repositories} repositories · ${report.geometricMeanSpeedup.toFixed(2)}x geomean vs baseline`,
    "",
  ]

  for (const result of report.results) {
    lines.push(
      `  ${result.name.padEnd(20)} ${String(result.calls).padStart(7)} calls  baseline ${formatDuration(result.baseline.p50).padStart(10)}  CVX ${formatDuration(result.current.p50).padStart(10)}  ${result.relativeToCurrent.toFixed(2).padStart(6)}x`,
    )
  }

  return lines.join("\n")
}
