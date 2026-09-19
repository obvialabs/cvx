import { describe, expect, test } from "bun:test"

import { cn, cx } from "../src"

interface ButtonState {
  disabled: boolean
  focusVisible: boolean
  pressed: boolean
}

describe("state-aware class composition", () => {
  test("cx keeps static calls as strings and evaluates resolver inputs with state", () => {
    const staticResult = cx("button", ["rounded", { active: true }])
    const statefulResult = cx(
      "button",
      (state: ButtonState) =>
        state.disabled && ["opacity-50", { "cursor-not-allowed": true }],
      (state: ButtonState) => state.pressed && "translate-y-px",
    )

    expect(typeof staticResult).toBe("string")
    expect(staticResult).toBe("button rounded active")
    expect(typeof statefulResult).toBe("function")
    expect(
      statefulResult({ disabled: true, focusVisible: false, pressed: true }),
    ).toBe("button opacity-50 cursor-not-allowed translate-y-px")
    expect(
      statefulResult({ disabled: false, focusVisible: false, pressed: false }),
    ).toBe("button")
  })

  test("cn resolves Tailwind conflicts after state-aware inputs are evaluated", () => {
    const className = (state: ButtonState) =>
      state.disabled ? "px-4 opacity-50" : "px-3"

    const composed = cn(
      "button px-2",
      className,
      (state: ButtonState) => state.focusVisible && "ring-2",
    )

    expect(typeof composed).toBe("function")
    expect(
      composed({ disabled: true, focusVisible: false, pressed: false }),
    ).toBe("button px-4 opacity-50")
    expect(
      composed({ disabled: false, focusVisible: true, pressed: false }),
    ).toBe("button px-3 ring-2")
  })

  test("cn preserves authored order between resolver and static inputs", () => {
    const dynamicFirst = cn(
      (state: ButtonState) => (state.pressed ? "px-6" : "px-4"),
      "px-2",
    )
    const dynamicLast = cn(
      "px-2",
      (state: ButtonState) => (state.pressed ? "px-6" : "px-4"),
    )
    const state = { disabled: false, focusVisible: false, pressed: true }

    // Later utilities keep the same precedence they have in ordinary cn calls.
    expect(dynamicFirst(state)).toBe("px-2")
    expect(dynamicLast(state)).toBe("px-6")
  })

  test("supports the string-or-resolver className contract used by headless UI libraries", () => {
    type BaseClassName =
      | string
      | ((state: ButtonState) => string | undefined)
      | undefined

    const composeClassName = (className: BaseClassName) =>
      cn("button px-2", className)

    const staticClassName = composeClassName("px-4")
    const statefulClassName = composeClassName((state) =>
      state.disabled ? "px-6 opacity-50" : undefined,
    )

    expect(staticClassName).toBe("button px-4")
    expect(typeof statefulClassName).toBe("function")

    if (typeof statefulClassName === "function") {
      expect(
        statefulClassName({
          disabled: true,
          focusVisible: false,
          pressed: false,
        }),
      ).toBe("button px-6 opacity-50")
      expect(
        statefulClassName({
          disabled: false,
          focusVisible: false,
          pressed: false,
        }),
      ).toBe("button px-2")
    }
  })
})
