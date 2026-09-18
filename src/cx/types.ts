/**
 * Values accepted by CVX class composition functions.
 *
 * The grammar covers strings, numeric values, nested arrays, and conditional
 * dictionaries while also accepting bigint values. Falsy values are ignored, arrays are flattened,
 * and object keys are emitted when their values are truthy.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassDictionary
  | readonly ClassValue[];

/** A conditional class-name dictionary. */
export type ClassDictionary = Readonly<Record<string, unknown>>;

/** A nested list of class values. */
export type ClassArray = readonly ClassValue[];

/** Callable shape shared by `cx` and `cn`. */
export interface ClassComposer {
  (...inputs: ClassValue[]): string;
}
