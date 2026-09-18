export interface MeasureOptions {
  iterations?: number;
  samples?: number;
  warmup?: number;
}

export function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)]!;
}

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
