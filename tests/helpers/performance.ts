import { expect } from "bun:test";

export interface MeasureOptions {
  iterations?: number;
  samples?: number;
  warmup?: number;
}

export interface PerformanceBudgetOptions extends MeasureOptions {
  label: string;
  maximumRatio: number;
  baseline: () => void;
  current: () => void;
}

export interface PerformanceResult {
  baseline: number;
  current: number;
  ratio: number;
}

/** Returns the median of a numeric sample set. */
export function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)]!;
}

/** Measures median nanoseconds per operation after a configurable warmup. */
export function measureNanoseconds(
  fn: () => void,
  options: MeasureOptions = {},
): number {
  const iterations = options.iterations ?? 100_000;
  const samples = options.samples ?? 5;
  const warmup = options.warmup ?? Math.min(iterations, 50_000);

  for (let index = 0; index < warmup; index++) fn();

  const values: number[] = [];
  for (let sample = 0; sample < samples; sample++) {
    const start = performance.now();
    for (let index = 0; index < iterations; index++) fn();
    values.push(((performance.now() - start) * 1e6) / iterations);
  }

  return median(values);
}

/**
 * Measures a current implementation against a baseline and enforces a broad
 * regression budget suitable for CI microbenchmarks.
 */
export function expectPerformanceBudget(
  options: PerformanceBudgetOptions,
): PerformanceResult {
  const measureOptions: MeasureOptions = {
    iterations: options.iterations,
    samples: options.samples,
    warmup: options.warmup,
  };
  const baseline = measureNanoseconds(options.baseline, measureOptions);
  const current = measureNanoseconds(options.current, measureOptions);
  const ratio = current / baseline;

  console.log(
    `${options.label}: current=${current.toFixed(2)}ns baseline=${baseline.toFixed(2)}ns ratio=${ratio.toFixed(3)}`,
  );

  expect(Number.isFinite(ratio)).toBe(true);
  expect(ratio).toBeLessThanOrEqual(options.maximumRatio);

  return { baseline, current, ratio };
}
