/**
 * Match Tailwind arbitrary values using square-bracket syntax
 */
const arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i

/**
 * Match Tailwind arbitrary variables using parenthesized syntax
 */
const arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i

/**
 * Match numeric fraction values such as `1/2`, `2.5/4`, or `12/24`
 */
const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/

/**
 * Match Tailwind t-shirt size tokens such as `sm`, `2xl`, or `1.5xl`
 */
const tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/

/**
 * Match CSS length values, supported viewport/container units, and
 * length-producing CSS functions such as `calc()`, `min()`, and `clamp()`
 */
const lengthUnitRegex =
    /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/

/**
 * Match CSS color functions that could otherwise resemble generic functions
 */
const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/

/**
 * Match tailwind-compatible box-shadow expressions
 */
const shadowRegex =
    /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/

/**
 * Match CSS image-producing functions supported by arbitrary image utilities
 */
const imageRegex =
    /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/

/**
 * Return whether a token represents a numeric fraction such as `1/2`
 */
export const isFraction = (v: string) => fractionRegex.test(v)

/**
 * Return whether a token can be parsed as a numeric value
 */
export const isNumber = (v: string) => !!v && !Number.isNaN(Number(v))

/**
 * Return whether a token represents an integer value
 */
export const isInteger = (v: string) => !!v && Number.isInteger(Number(v))

/**
 * Return whether a token represents a numeric percentage
 */
export const isPercent = (v: string) =>
    v.endsWith("%") && isNumber(v.slice(0, -1))

/**
 * Return whether a token matches Tailwind-style t-shirt sizing syntax
 */
export const isTshirtSize = (v: string) => tshirtUnitRegex.test(v)

/**
 * Accept every validator value
 */
export const isAny = () => true

/**
 * Return whether a token represents a CSS length without also matching
 * a supported CSS color function
 */
const isLengthOnly = (v: string) =>
    lengthUnitRegex.test(v) && !colorFunctionRegex.test(v)

/**
 * Reject every validator value
 */
const isNever = () => false

/**
 * Return whether a token resembles a CSS shadow expression
 */
const isShadow = (v: string) => shadowRegex.test(v)

/**
 * Return whether a token represents a CSS image-producing function
 */
const isImage = (v: string) => imageRegex.test(v)

/**
 * Return whether a token is neither an arbitrary value nor an arbitrary variable
 */
export const isAnyNonArbitrary = (v: string) =>
    !isArbitraryValue(v) && !isArbitraryVariable(v)

/**
 * Return whether a token represents a named container-query utility
 */
export const isNamedContainerQuery = (v: string) =>
    v.startsWith("@container") &&
    ((v[10] === "/" && v[11] !== undefined) ||
        (v[11] === "s" && v[16] !== undefined && v.startsWith("-size/", 10)) ||
        (v[11] === "n" && v[18] !== undefined && v.startsWith("-normal/", 10)))

/**
 * Predicate used to validate an explicit arbitrary-value or variable label
 */
type LabelTest = (label: string) => boolean

/**
 * Predicate used to validate the content of an arbitrary value
 */
type ValueTest = (value: string) => boolean

/**
 * Parse and validate a square-bracket arbitrary value
 *
 * **Parameters**
 * - `value` – Arbitrary value token to inspect
 * - `testLabel` – Predicate used when the token declares an explicit label
 * - `testValue` – Predicate used when the token has no explicit label
 */
const getIsArbitraryValue = (
    value: string,
    testLabel: LabelTest,
    testValue: ValueTest
) => {
  const result = arbitraryValueRegex.exec(value)

  if (result) {
    if (result[1]) return testLabel(result[1])

    return testValue(result[2]!)
  }

  return false
}

/**
 * Parse and validate a parenthesized arbitrary variable
 *
 * **Parameters**
 * - `value` – Arbitrary variable token to inspect
 * - `testLabel` – Predicate used to validate an explicit variable label
 * - `shouldMatchNoLabel` – Accept variables that omit an explicit label
 */
const getIsArbitraryVariable = (
    value: string,
    testLabel: LabelTest,
    shouldMatchNoLabel = false
) => {
  const result = arbitraryVariableRegex.exec(value)

  if (result) {
    if (result[1]) return testLabel(result[1])

    return shouldMatchNoLabel
  }

  return false
}

/**
 * Return whether an arbitrary label describes a position-like value
 */
const isLabelPosition = (label: string) =>
    label === "position" || label === "percentage"

/**
 * Return whether an arbitrary label describes an image-like value
 */
const isLabelImage = (label: string) =>
    label === "image" || label === "url"

/**
 * Return whether an arbitrary label describes a size-like value
 */
const isLabelSize = (label: string) =>
    label === "length" || label === "size" || label === "bg-size"

/**
 * Return whether an arbitrary label explicitly describes a length
 */
const isLabelLength = (label: string) => label === "length"

/**
 * Return whether an arbitrary label explicitly describes a number
 */
const isLabelNumber = (label: string) => label === "number"

/**
 * Return whether an arbitrary label describes a font family name
 */
const isLabelFamilyName = (label: string) => label === "family-name"

/**
 * Return whether an arbitrary label describes a numeric or named font weight
 */
const isLabelWeight = (label: string) =>
    label === "number" || label === "weight"

/**
 * Return whether an arbitrary label describes a shadow value
 */
const isLabelShadow = (label: string) => label === "shadow"

/**
 * Return whether an arbitrary value declares a supported size label
 */
export const isArbitrarySize = (v: string) =>
    getIsArbitraryValue(v, isLabelSize, isNever)

/**
 * Return whether a token uses square-bracket arbitrary-value syntax
 */
export const isArbitraryValue = (v: string) => arbitraryValueRegex.test(v)

/**
 * Return whether an arbitrary value represents a length
 */
export const isArbitraryLength = (v: string) =>
    getIsArbitraryValue(v, isLabelLength, isLengthOnly)

/**
 * Return whether an arbitrary value represents a number
 */
export const isArbitraryNumber = (v: string) =>
    getIsArbitraryValue(v, isLabelNumber, isNumber)

/**
 * Return whether an arbitrary value represents a font weight
 */
export const isArbitraryWeight = (v: string) =>
    getIsArbitraryValue(v, isLabelWeight, isAny)

/**
 * Return whether an arbitrary value represents a font family name
 */
export const isArbitraryFamilyName = (v: string) =>
    getIsArbitraryValue(v, isLabelFamilyName, isNever)

/**
 * Return whether an arbitrary value represents a position
 */
export const isArbitraryPosition = (v: string) =>
    getIsArbitraryValue(v, isLabelPosition, isNever)

/**
 * Return whether an arbitrary value represents an image expression
 */
export const isArbitraryImage = (v: string) =>
    getIsArbitraryValue(v, isLabelImage, isImage)

/**
 * Return whether an arbitrary value represents a shadow expression
 */
export const isArbitraryShadow = (v: string) =>
    getIsArbitraryValue(v, isLabelShadow, isShadow)

/**
 * Return whether a token uses parenthesized arbitrary-variable syntax
 */
export const isArbitraryVariable = (v: string) =>
    arbitraryVariableRegex.test(v)

/**
 * Return whether an arbitrary variable declares a length label
 */
export const isArbitraryVariableLength = (v: string) =>
    getIsArbitraryVariable(v, isLabelLength)

/**
 * Return whether an arbitrary variable declares a font-family label
 */
export const isArbitraryVariableFamilyName = (v: string) =>
    getIsArbitraryVariable(v, isLabelFamilyName)

/**
 * Return whether an arbitrary variable declares a position label
 */
export const isArbitraryVariablePosition = (v: string) =>
    getIsArbitraryVariable(v, isLabelPosition)

/**
 * Return whether an arbitrary variable declares a size label
 */
export const isArbitraryVariableSize = (v: string) =>
    getIsArbitraryVariable(v, isLabelSize)

/**
 * Return whether an arbitrary variable declares an image label
 */
export const isArbitraryVariableImage = (v: string) =>
    getIsArbitraryVariable(v, isLabelImage)

/**
 * Return whether an arbitrary variable declares a shadow label
 */
export const isArbitraryVariableShadow = (v: string) =>
    getIsArbitraryVariable(v, isLabelShadow, true)

/**
 * Return whether an arbitrary variable declares a font-weight label
 */
export const isArbitraryVariableWeight = (v: string) =>
    getIsArbitraryVariable(v, isLabelWeight, true)