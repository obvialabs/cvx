import type { ClassComposer, ClassValue } from "./types";

const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Appends one class value to an existing output string without allocating an
 * intermediate flattening array. Shared by `cx` and the `cv` render engine.
 *
 * @internal
 */
export function appendClassValue(output: string, value: ClassValue): string {
  if (!value || value === true) return output;

  const type = typeof value;
  if (type === "string" || type === "number" || type === "bigint") {
    const text = String(value);
    if (!text) return output;
    return output ? `${output} ${text}` : text;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      output = appendClassValue(output, value[index]);
    }
    return output;
  }

  if (type === "object") {
    const dictionary = value as Readonly<Record<string, unknown>>;
    for (const key in dictionary) {
      if (hasOwn.call(dictionary, key) && Boolean(dictionary[key])) {
        output = output ? `${output} ${key}` : key;
      }
    }
  }

  return output;
}

/**
 * Composes class values into a normalized space-delimited string.
 *
 * Arrays are recursively flattened, object keys are emitted for truthy
 * values, and falsy inputs are ignored. No Tailwind conflict resolution is
 * performed; use `cn` when conflict-aware merging is required.
 *
 * @example
 * ```ts
 * cx("button", active && "active", { disabled: false })
 * // => "button active"
 * ```
 */
export const cx: ClassComposer = (...inputs): string => {
  let output = "";
  for (let index = 0; index < inputs.length; index++) {
    output = appendClassValue(output, inputs[index]);
  }
  return output;
};
