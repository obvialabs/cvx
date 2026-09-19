import type {
  ClassComposer,
  ClassInput,
  ClassResolver,
  ClassValue,
} from "./types"

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
 * Create a state-aware composer after the first resolver input is encountered
 *
 * Static values before the first resolver have already been normalized into
 * `prefix`. Remaining static values are snapshotted once while resolver values
 * are evaluated for each state passed by the consuming component library.
 *
 * **Parameters**
 * - `inputs` – Original class inputs containing at least one resolver
 * - `firstResolver` – Index of the first resolver input
 * - `prefix` – Static output prepared before the first resolver
 *
 * **Returns**
 * - `ClassResolver` – State callback producing one normalized class string
 *
 * @internal
 */
const createStatefulComposer = <State>(
  inputs: ArrayLike<ClassInput<State>>,
  firstResolver: number,
  prefix: string,
): ((state: State) => string) => {
  const prepared: Array<string | ClassResolver<State>> = []

  // Snapshot every remaining static value once so repeated state updates only
  // pay for resolver execution and final string assembly.
  for (let index = firstResolver; index < inputs.length; index++) {
    const input = inputs[index]
    if (typeof input === "function") {
      prepared.push(input)
      continue
    }

    prepared.push(appendClassValue("", input))
  }

  return (state: State): string => {
    let output = prefix

    for (let index = 0; index < prepared.length; index++) {
      const input = prepared[index]
      const value = typeof input === "function" ? input(state) : input
      output = appendClassValue(output, value)
    }

    return output
  }
}

/**
 * Compose class values into a normalized space-delimited string
 *
 * State-aware resolver inputs produce a callback that accepts the same state
 * and composes their resolved class values. Static-only calls continue to
 * resolve immediately to a string.
 *
 * **Parameters**
 * - `inputs` – Static class values or state-aware class resolvers
 *
 * **Usage**
 * ```ts
 * // "button active"
 * cx("button", active && "active", { disabled: false })
 *
 * // (state) => "button opacity-50"
 * cx("button", (state: { disabled: boolean }) =>
 *   state.disabled && "opacity-50"
 * )
 * ```
 */
export const cx: ClassComposer = (function (
  v0?: ClassInput<any>,
  v1?: ClassInput<any>,
  v2?: ClassInput<any>,
) {
  const inputCount = arguments.length

  // Keep the dominant all-string forms allocation-light. Besides protecting
  // the existing cx hot path, these branches avoid paying resolver detection
  // overhead for the most common JSX composition calls.
  if (inputCount === 1 && typeof v0 === "string") return v0
  if (
    inputCount === 2 &&
    v0 &&
    v1 &&
    typeof v0 === "string" &&
    typeof v1 === "string"
  ) {
    return `${v0} ${v1}`
  }
  if (
    inputCount === 3 &&
    v0 &&
    v1 &&
    v2 &&
    typeof v0 === "string" &&
    typeof v1 === "string" &&
    typeof v2 === "string"
  ) {
    return `${v0} ${v1} ${v2}`
  }

  let output = ""

  // The generic path preserves the complete class-value grammar and only
  // allocates stateful preparation data when a resolver is actually present.
  for (let index = 0; index < inputCount; index++) {
    const input = arguments[index] as ClassInput<any>

    if (typeof input === "function") {
      return createStatefulComposer(
        arguments as unknown as ArrayLike<ClassInput<any>>,
        index,
        output,
      )
    }

    output = appendClassValue(output, input)
  }

  return output
}) as ClassComposer
