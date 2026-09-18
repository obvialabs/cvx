/**
 * Portions of this file are derived from Class Variance Authority / cva.
 * Copyright 2022-present Joe Bell and contributors. Licensed under Apache-2.0.
 * Modifications Copyright 2026 Selçuk Çukur / Obvia.
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

export type ClassDictionary = Readonly<Record<string, unknown>>;
export type ClassArray = readonly ClassValue[];

export type AnyCX = (...inputs: any[]) => string;

type InputsOf<T extends AnyCX> = T extends (
  ...inputs: readonly [...infer Inputs]
) => string
  ? Inputs
  : never;

type InputOf<T extends AnyCX> = InputsOf<T>[number];

export type CXInput<T extends AnyCX> = InputOf<T> extends infer P
  ? 0 extends 1 & P
    ? ClassValue
    : [P] extends [never]
      ? ClassValue
      : [P] extends [ClassValue]
        ? P
        : [Extract<P, ClassValue>] extends [never]
          ? ClassValue
          : Extract<P, ClassValue>
  : ClassValue;

export interface CX<T extends ClassValue = ClassValue> {
  (...inputs: T[]): string;
}

export type VariantShape<T extends ClassValue = ClassValue> = Record<
  string,
  Record<string, T>
>;

export type InternalVariantKey = `_${string}`;
export type StringToBoolean<T> = T extends "true" | "false" ? boolean : T;

type OmitUndefined<T> = T extends undefined ? never : T;
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never;

type RightMerge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never;
};

export type VariantSelection<V> = {
  [K in keyof V]?: StringToBoolean<keyof V[K]> | undefined;
};

export type ClassProp<T extends ClassValue = ClassValue> =
  | { class?: T; className?: never }
  | { class?: never; className?: T };

type CompoundSelection<V> = {
  [K in keyof V]?:
    | StringToBoolean<keyof V[K]>
    | readonly StringToBoolean<keyof V[K]>[]
    | undefined;
};

export type CompoundVariant<
  V,
  T extends ClassValue = ClassValue,
> = CompoundSelection<V> & ClassProp<T>;

export interface CVComponent<
  Config,
  Variants,
  T extends ClassValue = ClassValue,
> {
  (
    props?: Variants extends VariantShape
      ? VariantSelection<Variants> & ClassProp<T>
      : ClassProp<T>,
  ): string;
  readonly config: Config;
}

export type CVComponentShape = CVComponent<any, any, any>;

type ComposedTuple<
  Single extends CVComponentShape | undefined,
  List extends readonly CVComponentShape[],
> = [Single] extends [CVComponentShape] ? [Single] : List;

type MergedVariants<T extends readonly unknown[]> = UnionToIntersection<
  {
    [K in keyof T]: T[K] extends {
      config: { variants?: infer V extends VariantShape };
    }
      ? V
      : never;
  }[number]
>;

type DefaultsOf<Component> = Component extends {
  config: { defaultVariants?: infer D };
}
  ? D extends undefined
    ? {}
    : D
  : {};

type MergedDefaults<T extends readonly unknown[]> = T extends readonly [
  infer Head,
  ...infer Rest,
]
  ? RightMerge<DefaultsOf<Head>, MergedDefaults<Rest>>
  : {};

type AllVariants<
  Variants,
  Single extends CVComponentShape | undefined,
  List extends readonly CVComponentShape[],
> = [Single] extends [undefined]
  ? [List] extends [readonly []]
    ? Variants
    : Variants & MergedVariants<List>
  : Variants & MergedVariants<ComposedTuple<Single, List>>;

type DefaultsFrom<Config> = Config extends { defaultVariants?: infer D }
  ? D
  : {};

export type CVConfig<
  Config,
  Variants,
  Single extends CVComponentShape | undefined = undefined,
  List extends readonly CVComponentShape[] = [],
  T extends ClassValue = ClassValue,
  Merged = AllVariants<Variants, Single, List>,
> = Config & {
  base?: T;
  variants?: Variants extends Record<string, Record<string, T>>
    ? Variants & { __proto__?: never }
    : never;
  composes?: Single | readonly [...List];
} & ([keyof Merged] extends [never]
    ? { defaultVariants?: never; compoundVariants?: never }
    : {
        defaultVariants?: VariantSelection<Merged>;
        compoundVariants?: readonly CompoundVariant<Merged, T>[];
      });

export interface CV<T extends ClassValue = ClassValue> {
  <
    Config,
    Variants,
    Single extends CVComponentShape | undefined = undefined,
    List extends readonly CVComponentShape[] = [],
  >(
    config: CVConfig<Config, Variants, Single, List, T>,
  ): CVComponent<
    Omit<Config, "defaultVariants"> & {
      variants: AllVariants<Variants, Single, List>;
      defaultVariants: Omit<
        MergedDefaults<ComposedTuple<Single, List>>,
        keyof DefaultsFrom<Config>
      > &
        DefaultsFrom<Config>;
    },
    AllVariants<Variants, Single, List>,
    T
  >;
}

export type VariantProps<Component extends (...args: any) => any> = Omit<
  OmitUndefined<Parameters<Component>[0]>,
  "class" | "className" | InternalVariantKey
>;

export interface ConfigureOptions<
  TCX extends AnyCX = CX,
  TCN extends AnyCX = CX,
> {
  /** Class-value composer used by `cv` and returned as `cx`. */
  cx?: TCX;
  /** Conflict-aware merger returned as `cn`. Defaults to the built-in `cn`. */
  cn?: TCN;
  /**
   * Maximum number of dense variant combinations compiled lazily.
   * Set to 0 to disable dense tables for this configured engine.
   */
  compileLimit?: number;
}

export interface Configure {
  <TCX extends AnyCX = CX, TCN extends AnyCX = CX>(
    options?: ConfigureOptions<TCX, TCN>,
  ): {
    cv: CV<CXInput<TCX>>;
    cn: CX<CXInput<TCN>>;
    cx: CX<CXInput<TCX>>;
  };
}
