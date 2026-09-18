import { describe, expect, test } from "bun:test";

import * as validators from "../../src/merge/validators";

describe("merge validators", () => {
  test("recognizes scalar numeric forms", () => {
    expect(validators.isNumber("1.5")).toBe(true);
    expect(validators.isNumber("-2")).toBe(true);
    expect(validators.isNumber("")).toBe(false);
    expect(validators.isInteger("3")).toBe(true);
    expect(validators.isInteger("3.1")).toBe(false);
    expect(validators.isPercent("25%")).toBe(true);
    expect(validators.isPercent("25")).toBe(false);
  });

  test("recognizes fractions and tshirt sizes", () => {
    expect(validators.isFraction("1/2")).toBe(true);
    expect(validators.isFraction("1.5/3")).toBe(true);
    expect(validators.isFraction("1/zero")).toBe(false);
    expect(validators.isTshirtSize("2xl")).toBe(true);
    expect(validators.isTshirtSize("medium")).toBe(false);
  });

  test("recognizes arbitrary values and variables", () => {
    expect(validators.isArbitraryValue("[10px]")).toBe(true);
    expect(validators.isArbitraryValue("plain")).toBe(false);
    expect(validators.isArbitraryVariable("(--spacing)")).toBe(true);
    expect(validators.isArbitraryVariable("var(--spacing)")).toBe(false);
  });

  test("recognizes labeled arbitrary values", () => {
    expect(validators.isArbitraryLength("[length:10px]")).toBe(true);
    expect(validators.isArbitraryNumber("[number:2]")).toBe(true);
    expect(validators.isArbitraryWeight("[weight:700]")).toBe(true);
    expect(validators.isArbitraryImage("[image:url(test.png)]")).toBe(true);
    expect(validators.isArbitraryShadow("[shadow:0_1px_2px_black]")).toBe(true);
  });

  test("recognizes labeled arbitrary variables", () => {
    expect(validators.isArbitraryVariableLength("(length:--space)")).toBe(true);
    expect(validators.isArbitraryVariableFamilyName("(family-name:--font)")).toBe(
      true,
    );
    expect(validators.isArbitraryVariableWeight("(weight:--weight)")).toBe(true);
  });

  test("named container query detection stays narrow", () => {
    expect(validators.isNamedContainerQuery("@container/sidebar")).toBe(true);
    expect(validators.isNamedContainerQuery("@container-size/sidebar")).toBe(
      true,
    );
    expect(validators.isNamedContainerQuery("@container-normal/sidebar")).toBe(
      true,
    );
    expect(validators.isNamedContainerQuery("@container")).toBe(false);
  });
});
