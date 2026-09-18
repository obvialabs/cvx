/**
 * One implementation participating in a benchmark case
 */
export interface BenchmarkCandidate {
  /**
   * Human-readable implementation name shown in benchmark output
   */
  name: string

  /**
   * Operation executed by the benchmark harness
   */
  run: () => unknown

  /**
   * Mark the CVX implementation used as the relative comparison baseline
   */
  current?: boolean
}

/**
 * One equivalent workload compared across multiple implementations
 */
export interface BenchmarkCase {
  /**
   * Benchmark domain used to group related workloads
   */
  group: "cx" | "cv" | "cn" | "integration"

  /**
   * Human-readable workload name
   */
  name: string

  /**
   * Optional methodology note printed with the workload
   */
  note?: string

  /**
   * Equivalent implementations measured for this workload
   */
  candidates: readonly BenchmarkCandidate[]
}

/**
 * Sampling configuration shared by every benchmark candidate
 */
export interface BenchmarkOptions {
  /**
   * Number of measured samples collected per implementation
   *
   * @default 9
   */
  samples?: number

  /**
   * Approximate duration targeted for each measured sample
   *
   * @default 75
   */
  sampleDurationMs?: number

  /**
   * Minimum warmup duration executed before measurement
   *
   * @default 75
   */
  warmupDurationMs?: number

  /**
   * Minimum number of operations executed in one measured sample
   *
   * @default 1000
   */
  minimumIterations?: number

  /**
   * Maximum number of operations executed in one measured sample
   *
   * @default 5000000
   */
  maximumIterations?: number
}

/**
 * Statistical summary for one measured implementation
 */
export interface BenchmarkMeasurement {
  /**
   * Implementation name
   */
  name: string

  /**
   * Operations executed in each measured sample
   */
  iterations: number

  /**
   * Raw nanoseconds-per-operation samples
   */
  samples: number[]

  /**
   * Median nanoseconds per operation
   */
  p50: number

  /**
   * 95th percentile nanoseconds per operation
   */
  p95: number

  /**
   * Minimum nanoseconds per operation observed
   */
  minimum: number

  /**
   * Maximum nanoseconds per operation observed
   */
  maximum: number

  /**
   * Relative standard deviation across measured samples
   */
  relativeStdDev: number

  /**
   * Throughput derived from the median sample
   */
  operationsPerSecond: number

  /**
   * Median time divided by the CVX median for the same workload
   */
  relativeToCurrent: number
}

/**
 * Complete measured result for one benchmark workload
 */
export interface BenchmarkCaseResult {
  /**
   * Benchmark domain
   */
  group: BenchmarkCase["group"]

  /**
   * Workload name
   */
  name: string

  /**
   * Optional methodology note
   */
  note?: string

  /**
   * Measurements collected for every implementation
   */
  measurements: BenchmarkMeasurement[]
}

/**
 * Complete benchmark report suitable for text and JSON output
 */
export interface BenchmarkReport {
  /**
   * Report schema version
   */
  version: 1

  /**
   * ISO timestamp recorded after the suite completes
   */
  generatedAt: string

  /**
   * Runtime metadata available to the benchmark process
   */
  runtime: {
    bun?: string
    platform: string
    arch: string
  }

  /**
   * Effective sampling configuration
   */
  options: Required<BenchmarkOptions>

  /**
   * Measured workload results
   */
  results: BenchmarkCaseResult[]
}

interface PreparedCandidate {
  candidate: BenchmarkCandidate
  iterations: number
  samples: number[]
}

const DEFAULT_OPTIONS: Required<BenchmarkOptions> = {
  samples: 9,
  sampleDurationMs: 75,
  warmupDurationMs: 75,
  minimumIterations: 1_000,
  maximumIterations: 5_000_000,
}

let benchmarkSink: unknown

/**
 * Clamp a numeric value to an inclusive range
 *
 * **Parameters**
 * - `value` – Numeric value to constrain
 * - `minimum` – Inclusive lower bound
 * - `maximum` – Inclusive upper bound
 *
 * **Returns**
 * - `number` – Value constrained to the requested range
 */
const clamp = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.min(maximum, Math.max(minimum, value))

/**
 * Execute one benchmark operation repeatedly while keeping its result observable
 *
 * **Parameters**
 * - `run` – Operation to execute
 * - `iterations` – Number of calls to perform
 *
 * **Returns**
 * - `void` – Stores the last operation result in the benchmark sink
 */
const execute = (
  run: () => unknown,
  iterations: number,
): void => {
  for (let index = 0; index < iterations; index++) {
    benchmarkSink = run()
  }
}

/**
 * Measure one fixed-size operation batch
 *
 * **Parameters**
 * - `run` – Operation to measure
 * - `iterations` – Number of calls executed inside the timed region
 *
 * **Returns**
 * - `number` – Nanoseconds per operation for the measured batch
 */
const measureBatch = (
  run: () => unknown,
  iterations: number,
): number => {
  const startedAt = performance.now()

  execute(run, iterations)

  const elapsedMs = performance.now() - startedAt

  return (elapsedMs * 1e6) / iterations
}

/**
 * Warm one implementation for at least the requested wall-clock duration
 *
 * **Parameters**
 * - `run` – Operation to warm
 * - `durationMs` – Minimum warmup duration
 *
 * **Returns**
 * - `void` – Executes warmup operations without returning benchmark data
 */
const warmup = (
  run: () => unknown,
  durationMs: number,
): void => {
  const startedAt = performance.now()
  let batch = 1_000

  do {
    execute(run, batch)
    batch = Math.min(batch * 2, 100_000)
  } while (performance.now() - startedAt < durationMs)
}

/**
 * Calibrate a sample size so measured batches run long enough to reduce timer noise
 *
 * **Parameters**
 * - `run` – Operation whose sample size should be calibrated
 * - `options` – Effective benchmark sampling configuration
 *
 * **Returns**
 * - `number` – Iteration count used for each measured sample
 */
const calibrateIterations = (
  run: () => unknown,
  options: Required<BenchmarkOptions>,
): number => {
  let probeIterations = options.minimumIterations
  let elapsedMs = 0

  // Increase the probe until timer resolution becomes insignificant
  while (
    probeIterations < options.maximumIterations &&
    elapsedMs < 10
  ) {
    const startedAt = performance.now()
    execute(run, probeIterations)
    elapsedMs = performance.now() - startedAt

    if (elapsedMs < 10) {
      probeIterations = Math.min(
        probeIterations * 2,
        options.maximumIterations,
      )
    }
  }

  const nanosecondsPerOperation =
    elapsedMs > 0
      ? (elapsedMs * 1e6) / probeIterations
      : 1

  const targetIterations = Math.ceil(
    (options.sampleDurationMs * 1e6) / nanosecondsPerOperation,
  )

  return clamp(
    targetIterations,
    options.minimumIterations,
    options.maximumIterations,
  )
}

/**
 * Return one percentile from an ordered numeric sample set
 *
 * **Parameters**
 * - `ordered` – Ascending numeric samples
 * - `percentile` – Percentile expressed in the inclusive range `[0, 1]`
 *
 * **Returns**
 * - `number` – Sample selected for the requested percentile
 */
const percentile = (
  ordered: readonly number[],
  percentile: number,
): number => {
  const index = Math.min(
    ordered.length - 1,
    Math.max(0, Math.ceil(ordered.length * percentile) - 1),
  )

  return ordered[index]!
}

/**
 * Summarize raw nanosecond samples for one implementation
 *
 * **Parameters**
 * - `prepared` – Candidate metadata and collected samples
 * - `currentP50` – Median CVX time for the same workload
 *
 * **Returns**
 * - `BenchmarkMeasurement` – Statistical summary and raw measured samples
 */
const summarize = (
  prepared: PreparedCandidate,
  currentP50: number,
): BenchmarkMeasurement => {
  const ordered = [...prepared.samples].sort((left, right) => left - right)
  const p50 = percentile(ordered, 0.5)
  const p95 = percentile(ordered, 0.95)
  const mean = ordered.reduce((total, value) => total + value, 0) / ordered.length
  const variance =
    ordered.reduce((total, value) => {
      const delta = value - mean
      return total + delta * delta
    }, 0) / ordered.length

  return {
    name: prepared.candidate.name,
    iterations: prepared.iterations,
    samples: prepared.samples,
    p50,
    p95,
    minimum: ordered[0]!,
    maximum: ordered[ordered.length - 1]!,
    relativeStdDev: mean === 0 ? 0 : (Math.sqrt(variance) / mean) * 100,
    operationsPerSecond: p50 === 0 ? Number.POSITIVE_INFINITY : 1e9 / p50,
    relativeToCurrent: currentP50 === 0 ? 1 : p50 / currentP50,
  }
}

/**
 * Measure one equivalent workload across all participating implementations
 *
 * Candidate samples are interleaved in rotating order so thermal drift or
 * scheduler changes do not consistently favor the implementation measured
 * first.
 *
 * **Parameters**
 * - `benchmark` – Equivalent workload and participating implementations
 * - `options` – Effective benchmark sampling configuration
 *
 * **Returns**
 * - `BenchmarkCaseResult` – Statistical measurements for the complete workload
 */
const measureCase = (
  benchmark: BenchmarkCase,
  options: Required<BenchmarkOptions>,
): BenchmarkCaseResult => {
  const currentIndex = benchmark.candidates.findIndex(
    (candidate) => candidate.current === true,
  )

  if (currentIndex === -1) {
    throw new Error(`benchmark: ${benchmark.name} has no current CVX candidate`)
  }

  const prepared: PreparedCandidate[] = benchmark.candidates.map(
    (candidate): PreparedCandidate => {
      warmup(candidate.run, options.warmupDurationMs)

      return {
        candidate,
        iterations: calibrateIterations(candidate.run, options),
        samples: [],
      }
    },
  )

  // Rotate candidate order for every sample to avoid persistent first-run bias
  for (let sample = 0; sample < options.samples; sample++) {
    for (let offset = 0; offset < prepared.length; offset++) {
      const index = (sample + offset) % prepared.length
      const candidate = prepared[index]!

      candidate.samples.push(
        measureBatch(
          candidate.candidate.run,
          candidate.iterations,
        ),
      )
    }
  }

  const currentSamples = [...prepared[currentIndex]!.samples].sort(
    (left, right) => left - right,
  )
  const currentP50 = percentile(currentSamples, 0.5)

  return {
    group: benchmark.group,
    name: benchmark.name,
    note: benchmark.note,
    measurements: prepared.map((candidate) => summarize(candidate, currentP50)),
  }
}

/**
 * Run a complete benchmark suite with interleaved statistical sampling
 *
 * **Parameters**
 * - `cases` – Equivalent workloads to benchmark
 * - `options` – Optional sampling configuration overrides
 *
 * **Returns**
 * - `BenchmarkReport` – Runtime metadata and measured workload results
 */
export const runBenchmarks = (
  cases: readonly BenchmarkCase[],
  options: BenchmarkOptions = {},
): BenchmarkReport => {
  const effectiveOptions: Required<BenchmarkOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  const results = cases.map((benchmark) => measureCase(benchmark, effectiveOptions))

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    runtime: {
      bun: process.versions.bun,
      platform: process.platform,
      arch: process.arch,
    },
    options: effectiveOptions,
    results,
  }
}

/**
 * Format one operation rate using compact human-readable units
 *
 * **Parameters**
 * - `operationsPerSecond` – Throughput to format
 *
 * **Returns**
 * - `string` – Human-readable operations-per-second value
 */
const formatRate = (
  operationsPerSecond: number,
): string => {
  if (operationsPerSecond >= 1e6) {
    return `${(operationsPerSecond / 1e6).toFixed(2)}M ops/s`
  }

  if (operationsPerSecond >= 1e3) {
    return `${(operationsPerSecond / 1e3).toFixed(2)}K ops/s`
  }

  return `${operationsPerSecond.toFixed(2)} ops/s`
}

/**
 * Format a benchmark report for terminal and GitHub Actions output
 *
 * **Parameters**
 * - `report` – Measured benchmark report
 *
 * **Returns**
 * - `string` – Multi-line human-readable benchmark report
 */
export const formatBenchmarkReport = (
  report: BenchmarkReport,
): string => {
  const lines = [
    "@obvia/cvx benchmark",
    `runtime: Bun ${report.runtime.bun ?? "unknown"} · ${report.runtime.platform}/${report.runtime.arch}`,
    `method: ${report.options.samples} interleaved samples · ~${report.options.sampleDurationMs}ms/sample · p50 used for relative ratios`,
    "note: ratios are workload-specific measurements; cache behavior is labelled explicitly and no aggregate speedup is inferred",
  ]

  for (const result of report.results) {
    lines.push("", `[${result.group}] ${result.name}`)

    if (result.note) {
      lines.push(`  ${result.note}`)
    }

    for (const measurement of result.measurements) {
      lines.push(
        `  ${measurement.name.padEnd(30)} ${measurement.p50.toFixed(2).padStart(10)} ns/op  p95 ${measurement.p95.toFixed(2).padStart(10)}  ${formatRate(measurement.operationsPerSecond).padStart(14)}  vs CVX ${measurement.relativeToCurrent.toFixed(2)}x  rsd ${measurement.relativeStdDev.toFixed(2)}%`,
      )
    }
  }

  // Keep the sink observable after the complete suite has finished
  if (benchmarkSink === undefined) {
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Create an operation that rotates deterministically through a fixed input set
 *
 * **Parameters**
 * - `values` – Non-empty workload corpus
 * - `run` – Operation executed for the selected corpus value
 *
 * **Returns**
 * - `() => Output` – Stateful benchmark operation with an independent cursor
 */
export const createRotatingOperation = <Value, Output>(
  values: readonly Value[],
  run: (value: Value) => Output,
): (() => Output) => {
  if (values.length === 0) {
    throw new Error("benchmark: rotating corpus must not be empty")
  }

  let cursor = 0

  return () => {
    const value = values[cursor]!
    cursor = (cursor + 1) % values.length
    return run(value)
  }
}
