export interface Random {
  next(): number;
  int(maxExclusive: number): number;
  bool(): boolean;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  const next = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    int(maxExclusive) {
      return Math.floor(next() * maxExclusive);
    },
    bool() {
      return next() >= 0.5;
    },
  };
}

export function pick<T>(random: Random, values: readonly T[]): T {
  return values[random.int(values.length)]!;
}
