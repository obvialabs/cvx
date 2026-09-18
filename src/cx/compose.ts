import type { ClassComposer, ClassValue } from "./types";

const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Appends a class value without allocating intermediate arrays.
 * This is shared by `cx` and the compiled `cv` runtime.
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

export const cx: ClassComposer = (...inputs): string => {
  let output = "";
  for (let index = 0; index < inputs.length; index++) {
    output = appendClassValue(output, inputs[index]);
  }
  return output;
};
