import { describe, expect, test } from "bun:test"

import {
  isAny,
  isAnyNonArbitrary,
  isArbitraryFamilyName,
  isArbitraryImage,
  isArbitraryLength,
  isArbitraryNumber,
  isArbitraryPosition,
  isArbitraryShadow,
  isArbitrarySize,
  isArbitraryValue,
  isArbitraryVariable,
  isArbitraryVariableFamilyName,
  isArbitraryVariableImage,
  isArbitraryVariableLength,
  isArbitraryVariablePosition,
  isArbitraryVariableShadow,
  isArbitraryVariableSize,
  isArbitraryVariableWeight,
  isArbitraryWeight,
  isFraction,
  isInteger,
  isNamedContainerQuery,
  isNumber,
  isPercent,
  isTshirtSize,
} from "../src/cn/internal/validators"

describe("cn validators", () => {
  test("classifies primitive numeric and sizing tokens", () => {
    expect(isFraction("1/2")).toBe(true)
    expect(isFraction("2.5/4")).toBe(true)
    expect(isFraction("1")).toBe(false)

    expect(isNumber("1.5")).toBe(true)
    expect(isNumber("-2")).toBe(true)
    expect(isNumber("")).toBe(false)
    expect(isNumber("value")).toBe(false)

    expect(isInteger("2")).toBe(true)
    expect(isInteger("2.5")).toBe(false)
    expect(isInteger("")).toBe(false)

    expect(isPercent("50%")).toBe(true)
    expect(isPercent("12.5%")).toBe(true)
    expect(isPercent("value%")).toBe(false)
    expect(isPercent("50")).toBe(false)

    expect(isTshirtSize("sm")).toBe(true)
    expect(isTshirtSize("2xl")).toBe(true)
    expect(isTshirtSize("1.5xl")).toBe(true)
    expect(isTshirtSize("base")).toBe(false)
    expect(isAny()).toBe(true)
  })

  test("distinguishes ordinary, arbitrary, and named container-query tokens", () => {
    expect(isAnyNonArbitrary("p-4")).toBe(true)
    expect(isAnyNonArbitrary("[color:red]")).toBe(false)
    expect(isAnyNonArbitrary("(--spacing)")).toBe(false)

    expect(isArbitraryValue("[1rem]")).toBe(true)
    expect(isArbitraryValue("[length:1rem]")).toBe(true)
    expect(isArbitraryValue("1rem")).toBe(false)

    expect(isArbitraryVariable("(--spacing)")).toBe(true)
    expect(isArbitraryVariable("(length:--spacing)")).toBe(true)
    expect(isArbitraryVariable("--spacing")).toBe(false)

    expect(isNamedContainerQuery("@container/sidebar")).toBe(true)
    expect(isNamedContainerQuery("@container-size/sidebar")).toBe(true)
    expect(isNamedContainerQuery("@container-normal/sidebar")).toBe(true)
    expect(isNamedContainerQuery("@container")).toBe(false)
    expect(isNamedContainerQuery("container/sidebar")).toBe(false)
  })

  test("validates square-bracket arbitrary values by explicit labels and fallback syntax", () => {
    expect(isArbitrarySize("[length:1rem]")).toBe(true)
    expect(isArbitrarySize("[size:cover]")).toBe(true)
    expect(isArbitrarySize("[bg-size:cover]")).toBe(true)
    expect(isArbitrarySize("[1rem]")).toBe(false)

    expect(isArbitraryLength("[length:1rem]")).toBe(true)
    expect(isArbitraryLength("[calc(100%-1rem)]")).toBe(true)
    expect(isArbitraryLength("[rgba(0,0,0,0.5)]")).toBe(false)
    expect(isArbitraryLength("[color:red]")).toBe(false)

    expect(isArbitraryNumber("[number:2.5]")).toBe(true)
    expect(isArbitraryNumber("[2.5]")).toBe(true)
    expect(isArbitraryNumber("[value]")).toBe(false)
    expect(isArbitraryNumber("[length:2.5]")).toBe(false)

    expect(isArbitraryWeight("[weight:bold]")).toBe(true)
    expect(isArbitraryWeight("[number:700]")).toBe(true)
    expect(isArbitraryWeight("[700]")).toBe(true)
    expect(isArbitraryWeight("weight-bold")).toBe(false)

    expect(isArbitraryFamilyName("[family-name:Inter]")).toBe(true)
    expect(isArbitraryFamilyName("[Inter]")).toBe(false)

    expect(isArbitraryPosition("[position:center]")).toBe(true)
    expect(isArbitraryPosition("[percentage:50%]")).toBe(true)
    expect(isArbitraryPosition("[center]")).toBe(false)

    expect(isArbitraryImage("[image:linear-gradient(red,blue)]")).toBe(true)
    expect(isArbitraryImage("[url:https://example.com/image.png]")).toBe(true)
    expect(isArbitraryImage("[linear-gradient(red,blue)]")).toBe(true)
    expect(isArbitraryImage("[plain-value]")).toBe(false)

    expect(isArbitraryShadow("[shadow:0_1px_2px_black]")).toBe(true)
    expect(isArbitraryShadow("[0_1px_2px_black]")).toBe(true)
    expect(isArbitraryShadow("[plain-value]")).toBe(false)
  })

  test("validates parenthesized arbitrary variables with the same label rules", () => {
    expect(isArbitraryVariableLength("(length:--spacing)")).toBe(true)
    expect(isArbitraryVariableLength("(--spacing)")).toBe(false)
    expect(isArbitraryVariableLength("(number:--spacing)")).toBe(false)

    expect(isArbitraryVariableFamilyName("(family-name:--font)")).toBe(true)
    expect(isArbitraryVariableFamilyName("(--font)")).toBe(false)

    expect(isArbitraryVariablePosition("(position:--position)")).toBe(true)
    expect(isArbitraryVariablePosition("(percentage:--position)")).toBe(true)
    expect(isArbitraryVariablePosition("(--position)")).toBe(false)

    expect(isArbitraryVariableSize("(length:--size)")).toBe(true)
    expect(isArbitraryVariableSize("(size:--size)")).toBe(true)
    expect(isArbitraryVariableSize("(bg-size:--size)")).toBe(true)
    expect(isArbitraryVariableSize("(--size)")).toBe(false)

    expect(isArbitraryVariableImage("(image:--image)")).toBe(true)
    expect(isArbitraryVariableImage("(url:--image)")).toBe(true)
    expect(isArbitraryVariableImage("(--image)")).toBe(false)

    // Shadow and weight variables intentionally accept an omitted label.
    expect(isArbitraryVariableShadow("(shadow:--shadow)")).toBe(true)
    expect(isArbitraryVariableShadow("(--shadow)")).toBe(true)
    expect(isArbitraryVariableShadow("(length:--shadow)")).toBe(false)

    expect(isArbitraryVariableWeight("(weight:--weight)")).toBe(true)
    expect(isArbitraryVariableWeight("(number:--weight)")).toBe(true)
    expect(isArbitraryVariableWeight("(--weight)")).toBe(true)
    expect(isArbitraryVariableWeight("(length:--weight)")).toBe(false)
  })
})
