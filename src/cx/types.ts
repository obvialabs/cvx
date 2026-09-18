/**
 * Class value accepted by `cx`, `cn`, and generated `cv` components.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | ClassDictionary
  | readonly ClassValue[]

/**
 * Conditional class dictionary.
 */
export type ClassDictionary = Readonly<Record<string, unknown>>

/**
 * Nested list of class values.
 */
export type ClassArray = readonly ClassValue[]

/**
 * allable class composer shared by `cx` and `cn`.
 */
export interface ClassComposer {
  (...inputs: ClassValue[]): string
}
