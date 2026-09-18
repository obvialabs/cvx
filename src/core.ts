/**
 * Portions of this file are derived from Class Variance Authority / cva.
 * Copyright 2022-present Joe Bell and contributors. Licensed under Apache-2.0.
 * Modifications Copyright 2026 Selçuk Çukur / Obvia.
 */

import { appendClassValue, cx } from "./cx/compose";
import { cn as defaultCn } from "./cn/index";

import type {
  AnyCX,
  ClassProp,
  ClassValue,
  Configure,
  ConfigureOptions,
  CV,
  CVComponentShape,
  CVConfig,
  CX,
  VariantShape,
} from "./types";

const EMPTY_OBJECT: Record<string, any> = Object.freeze({});
const EMPTY_ARRAY: readonly never[] = Object.freeze([]);
const DEFAULT_COMPILE_LIMIT = 512;

const normalizeVariantKey = (value: unknown): unknown => {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === 0) return "0";
  return value;
};

const toPropValue = (key: string): unknown => {
  if (key === "true") return true;
  if (key === "false") return false;
  const number = Number(key);
  return Number.isFinite(number) && String(number) === key ? number : key;
};

type Selector =
  | { kind: 0; value: unknown }
  | { kind: 1; values: readonly unknown[] }
  | { kind: 2; values: ReadonlySet<unknown> };

interface PreparedCompound {
  indexes: readonly number[];
  selectors: readonly Selector[];
  classValue: ClassValue;
  classNameValue: ClassValue;
}

interface DenseDimension {
  key: string;
  slots: ReadonlyMap<unknown, number>;
  values: readonly unknown[];
  stride: number;
}

interface DenseTable {
  dimensions: readonly DenseDimension[];
  outputs: (string | undefined)[];
  lastValues: unknown[];
  lastIndex: number;
  hasLast: boolean;
}

interface Program {
  engine: Engine;
  children: readonly Program[];
  foreignChildren: readonly CVComponentShape[];
  base: ClassValue;
  localVariantKeys: readonly string[];
  localVariantMaps: readonly Record<string, ClassValue>[];
  readKeys: readonly string[];
  compounds: readonly PreparedCompound[];
  defaults: Readonly<Record<string, unknown>>;
  mergedVariants: VariantShape;
  dense?: DenseTable | null;
  staticOutput?: string;
  render(
    props: Record<string, unknown>,
    inheritedDefaults?: Readonly<Record<string, unknown>>,
    includeClassProps?: boolean,
  ): string;
}

interface Engine {
  join: AnyCX;
  internalJoin: boolean;
  compileLimit: number;
}

const programs = new WeakMap<Function, Program>();

function copyDataObject(
  source: Record<string, any> | undefined,
): Record<string, any> {
  const out: Record<string, any> = {};
  if (!source) return out;
  for (const key of Object.keys(source)) out[key] = source[key];
  return out;
}

function mergeConfig(
  childComponents: readonly CVComponentShape[],
  definition: Record<string, any>,
): { variants: VariantShape; defaults: Record<string, unknown> } {
  const variants: VariantShape = {};
  let defaults: Record<string, unknown> = {};

  const mergeOne = (source: Record<string, any> | undefined) => {
    if (!source) return;
    const sourceVariants = source.variants as VariantShape | undefined;
    if (sourceVariants) {
      for (const key of Object.keys(sourceVariants)) {
        const previous = variants[key];
        variants[key] = {
          ...(previous || EMPTY_OBJECT),
          ...sourceVariants[key],
        };
      }
    }
    if (source.defaultVariants) {
      defaults = { ...defaults, ...source.defaultVariants };
    }
  };

  for (let i = 0; i < childComponents.length; i++) {
    mergeOne(childComponents[i].config as Record<string, any>);
  }
  mergeOne(definition);
  return { variants, defaults };
}

function prepareCompounds(
  compounds: readonly (ClassProp & Record<string, unknown>)[] | undefined,
  readKeys: string[],
): readonly PreparedCompound[] {
  if (!compounds?.length) return EMPTY_ARRAY;
  const prepared: PreparedCompound[] = new Array(compounds.length);
  const keyIndex = new Map<string, number>();
  for (let i = 0; i < readKeys.length; i++) keyIndex.set(readKeys[i], i);

  for (let i = 0; i < compounds.length; i++) {
    const compound = compounds[i];
    const indexes: number[] = [];
    const selectors: Selector[] = [];

    for (const key of Object.keys(compound)) {
      if (key === "class" || key === "className") continue;
      let index = keyIndex.get(key);
      if (index === undefined) {
        index = readKeys.length;
        readKeys.push(key);
        keyIndex.set(key, index);
      }
      indexes.push(index);
      const value = compound[key];
      if (Array.isArray(value)) {
        selectors.push(
          value.length >= 5
            ? { kind: 2, values: new Set(value) }
            : { kind: 1, values: value.slice() },
        );
      } else {
        selectors.push({ kind: 0, value });
      }
    }

    prepared[i] = {
      indexes,
      selectors,
      classValue: compound.class as ClassValue,
      classNameValue: compound.className as ClassValue,
    };
  }

  return prepared;
}

function selectorMatches(selector: Selector, value: unknown): boolean {
  if (selector.kind === 0) return selector.value === value;
  if (selector.kind === 2) return selector.values.has(value);
  const values = selector.values;
  for (let i = 0; i < values.length; i++) if (values[i] === value) return true;
  return false;
}

function classFromVariant(
  map: Record<string, ClassValue>,
  raw: unknown,
  fallback: unknown,
): ClassValue {
  const value = raw === undefined ? fallback : raw;
  const key = normalizeVariantKey(value);
  // Match cva's useful falsy behavior: false/0 are normalized, null/"" use default.
  if (key === null || key === "" || key === undefined) {
    const fallbackKey = normalizeVariantKey(fallback);
    return fallbackKey == null || fallbackKey === ""
      ? undefined
      : map[String(fallbackKey)];
  }
  return map[String(key)];
}

function joinPrepared(engine: Engine, values: readonly ClassValue[]): string {
  if (engine.internalJoin) {
    let out = "";
    for (let i = 0; i < values.length; i++) out = appendClassValue(out, values[i]);
    return out;
  }
  return Reflect.apply(engine.join, undefined, values);
}

function renderUncached(
  program: Program,
  props: Record<string, unknown>,
  defaults: Readonly<Record<string, unknown>>,
): string {
  const out: ClassValue[] = [];

  for (let i = 0; i < program.children.length; i++) {
    const child = program.children[i];
    const rendered = child.render(props, defaults, false);
    if (rendered) out.push(rendered);
  }

  if (program.foreignChildren.length) {
    const forwarded: Record<string, unknown> = { ...defaults };
    for (const key of Object.keys(props)) {
      if (key !== "class" && key !== "className" && props[key] !== undefined) {
        forwarded[key] = props[key];
      }
    }
    for (let i = 0; i < program.foreignChildren.length; i++) {
      const rendered = program.foreignChildren[i]({ ...forwarded });
      if (rendered) out.push(rendered);
    }
  }

  if (program.base !== undefined) out.push(program.base);

  for (let i = 0; i < program.localVariantKeys.length; i++) {
    const key = program.localVariantKeys[i];
    const value = classFromVariant(
      program.localVariantMaps[i],
      props[key],
      defaults[key],
    );
    if (value !== undefined) out.push(value);
  }

  if (program.compounds.length) {
    const resolved = new Array<unknown>(program.readKeys.length);
    for (let i = 0; i < program.readKeys.length; i++) {
      const key = program.readKeys[i];
      const value = props[key];
      resolved[i] = value === undefined ? defaults[key] : value;
    }

    compoundLoop: for (let i = 0; i < program.compounds.length; i++) {
      const compound = program.compounds[i];
      for (let j = 0; j < compound.indexes.length; j++) {
        if (!selectorMatches(compound.selectors[j], resolved[compound.indexes[j]])) {
          continue compoundLoop;
        }
      }
      if (compound.classValue !== undefined) out.push(compound.classValue);
      if (compound.classNameValue !== undefined) out.push(compound.classNameValue);
    }
  }

  return joinPrepared(program.engine, out);
}

function buildDenseTable(program: Program): DenseTable | undefined {
  const { engine } = program;
  if (!engine.internalJoin || engine.compileLimit <= 0 || program.foreignChildren.length) {
    return undefined;
  }

  const required = new Set<string>(program.readKeys);
  for (let i = 0; i < program.children.length; i++) {
    for (const key of program.children[i].readKeys) required.add(key);
  }

  const keys = [...required];
  if (!keys.length) return undefined;

  const dimensions: DenseDimension[] = [];
  let combinations = 1;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const variant = program.mergedVariants[key];
    if (!variant) return undefined;

    const values: unknown[] = [];
    const slots = new Map<unknown, number>();
    for (const variantKey of Object.keys(variant)) {
      const value = toPropValue(variantKey);
      if (!slots.has(value)) {
        slots.set(value, values.length);
        values.push(value);
      }
    }

    const defaultValue = program.defaults[key];
    if (!slots.has(defaultValue)) {
      slots.set(defaultValue, values.length);
      values.push(defaultValue);
    }

    if (!values.length) return undefined;
    combinations *= values.length;
    if (combinations > engine.compileLimit) return undefined;
    dimensions.push({ key, slots, values, stride: 1 });
  }

  let stride = 1;
  for (let i = dimensions.length - 1; i >= 0; i--) {
    dimensions[i] = { ...dimensions[i], stride };
    stride *= dimensions[i].values.length;
  }

  return {
    dimensions,
    outputs: new Array<string | undefined>(combinations),
    lastValues: new Array<unknown>(dimensions.length),
    lastIndex: 0,
    hasLast: false,
  };
}

function denseIndex(
  dense: DenseTable,
  props: Record<string, unknown>,
  defaults: Readonly<Record<string, unknown>>,
): number {
  let same = dense.hasLast;

  for (let i = 0; i < dense.dimensions.length; i++) {
    const dimension = dense.dimensions[i];
    const raw = props[dimension.key];
    const value = raw === undefined ? defaults[dimension.key] : raw;
    if (same && dense.lastValues[i] !== value) same = false;
    dense.lastValues[i] = value;
  }

  if (same) return dense.lastIndex;

  let index = 0;
  for (let i = 0; i < dense.dimensions.length; i++) {
    const dimension = dense.dimensions[i];
    const slot = dimension.slots.get(dense.lastValues[i]);
    if (slot === undefined) {
      dense.hasLast = false;
      return -1;
    }
    index += slot * dimension.stride;
  }

  dense.hasLast = true;
  dense.lastIndex = index;
  return index;
}

function createProgram(
  engine: Engine,
  config: Record<string, any>,
): Program {
  const composes = config.composes;
  const childComponents: readonly CVComponentShape[] =
    composes == null
      ? EMPTY_ARRAY
      : Array.isArray(composes)
        ? composes.slice()
        : [composes];

  const children: Program[] = [];
  const foreignChildren: CVComponentShape[] = [];
  for (let i = 0; i < childComponents.length; i++) {
    const child = childComponents[i];
    const program = programs.get(child);
    if (program) children.push(program);
    else foreignChildren.push(child);
  }

  const merged = mergeConfig(childComponents, config);
  const localVariants = config.variants as VariantShape | undefined;
  const localVariantKeys = localVariants ? Object.keys(localVariants) : [];
  const localVariantMaps = localVariantKeys.map((key) =>
    copyDataObject(localVariants![key]),
  );
  const readKeys = localVariantKeys.slice();
  const compounds = prepareCompounds(config.compoundVariants, readKeys);
  for (let i = 0; i < children.length; i++) {
    for (const key of children[i].readKeys) {
      if (!readKeys.includes(key)) readKeys.push(key);
    }
  }
  const program: Program = {
    engine,
    children,
    foreignChildren,
    base: config.base as ClassValue,
    localVariantKeys,
    localVariantMaps,
    readKeys,
    compounds,
    defaults: Object.freeze({ ...merged.defaults }),
    mergedVariants: merged.variants,
    render: undefined as any,
  };

  if (
    engine.internalJoin &&
    !readKeys.length &&
    !foreignChildren.length &&
    !children.length
  ) {
    program.staticOutput = joinPrepared(engine, [program.base]);
    program.dense = null;
  }

  program.render = (
    props: Record<string, unknown>,
    inheritedDefaults = program.defaults,
    includeClassProps = true,
  ): string => {
    let core: string;

    if (program.staticOutput !== undefined) {
      core = program.staticOutput;
    } else {
      let dense = program.dense;
      if (dense === undefined) {
        dense = buildDenseTable(program) ?? null;
        program.dense = dense;
      }

      if (dense) {
        const index = denseIndex(dense, props, inheritedDefaults);
        if (index >= 0) {
          const cached = dense.outputs[index];
          if (cached !== undefined) {
            core = cached;
          } else {
            core = renderUncached(program, props, inheritedDefaults);
            dense.outputs[index] = core;
          }
        } else {
          core = renderUncached(program, props, inheritedDefaults);
        }
      } else {
        core = renderUncached(program, props, inheritedDefaults);
      }
    }

    if (!includeClassProps) return core;
    const classValue = props.class as ClassValue;
    const classNameValue = props.className as ClassValue;
    if (classValue === undefined && classNameValue === undefined) return core;

    if (engine.internalJoin) return cx(core, classValue, classNameValue);
    const values: ClassValue[] = [core];
    if (classValue !== undefined) values.push(classValue);
    if (classNameValue !== undefined) values.push(classNameValue);
    return joinPrepared(engine, values);
  };

  return program;
}

function createEngine(options: ConfigureOptions = {}): {
  cv: CV;
  cn: CX;
  cx: CX;
} {
  const join = options.cx ?? cx;
  const merge = options.cn ?? defaultCn;
  const internalJoin = join === cx;
  const engine: Engine = {
    join,
    internalJoin,
    compileLimit:
      options.compileLimit === undefined
        ? DEFAULT_COMPILE_LIMIT
        : Math.max(0, options.compileLimit | 0),
  };

  const publicCx: CX = internalJoin
    ? cx
    : (...inputs) => Reflect.apply(join, undefined, inputs);
  const publicCn: CX = merge === defaultCn
    ? defaultCn
    : (...inputs) => Reflect.apply(merge, undefined, inputs);
  const cv = (<
    Config,
    Variants,
    Single extends CVComponentShape | undefined = undefined,
    List extends readonly CVComponentShape[] = [],
  >(
    authored: CVConfig<Config, Variants, Single, List>,
  ) => {
    const definition = (authored || EMPTY_OBJECT) as Record<string, any>;
    const program = createProgram(engine, definition);

    const component = (
      program.staticOutput !== undefined && engine.internalJoin
        ? (input?: Record<string, unknown> | null) => {
            if (!input || typeof input !== "object") return program.staticOutput!;
            const classValue = input.class as ClassValue;
            const classNameValue = input.className as ClassValue;
            return classValue === undefined && classNameValue === undefined
              ? program.staticOutput!
              : cx(program.staticOutput!, classValue, classNameValue);
          }
        : (input?: Record<string, unknown> | null) =>
            program.render(
              input && typeof input === "object" ? input : EMPTY_OBJECT,
            )
    ) as CVComponentShape;

    Object.defineProperty(component, "config", {
      enumerable: true,
      configurable: false,
      writable: false,
      value: Object.freeze({
        ...definition,
        variants: Object.freeze({ ...program.mergedVariants }),
        defaultVariants: program.defaults,
      }),
    });
    programs.set(component, program);
    return component;
  }) as CV;

  return { cv, cn: publicCn, cx: publicCx };
}

export const configure: Configure = ((options: ConfigureOptions) =>
  createEngine(options)) as Configure;

const defaultEngine = createEngine();

export const cv: CV = defaultEngine.cv;
