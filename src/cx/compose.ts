import type { ClassComposer, ClassValue } from "./types"

const hasOwn = Object.prototype.hasOwnProperty

/**
 * Append a class value to an existing class string
 *
 * **Parameters**
 * - `output` – Existing space-delimited class string
 * - `value` – Class value to append
 *
 * **Returns**
 * - `string` - Updated class string
 *
 * @internal
 */
export function appendClassValue(output: string, value: ClassValue): string {
  // Ignore falsy values and the boolean sentinel used by conditional expressions
  if (!value || value === true) return output

  const type = typeof value

  // String and numeric class values can be appended without additional normalization
  if (type === "string" || type === "number") {
    const text = String(value)
    if (!text) return output
    return output ? `${output} ${text}` : text
  }

  // Flatten nested arrays recursively without creating a temporary array
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      output = appendClassValue(output, value[index])
    }
    return output
  }

  // Emit own dictionary keys whose values evaluate to true
  if (type === "object") {
    const dictionary = value as Readonly<Record<string, unknown>>
    for (const key in dictionary) {
      if (hasOwn.call(dictionary, key) && Boolean(dictionary[key])) {
        output = output ? `${output} ${key}` : key
      }
    }
  }

  return output
}

/**
 * Compose class values into a normalized space-delimited string
 *
 * **Parameters**
 * - `inputs` – Class values to normalize and concatenate
 *
 * **Usage**
 * ```ts
 * // "button active"
 * cx("button", active && "active", { disabled: false })
 * ```
 */
export const cx: ClassComposer = (...inputs): string => {
  let output = ""

  // Append each input directly to keep the hot path allocation-light
  for (let index = 0; index < inputs.length; index++) {
    output = appendClassValue(output, inputs[index])
  }

  return output
}
