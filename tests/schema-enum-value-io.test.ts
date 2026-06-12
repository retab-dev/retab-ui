import { describe, expect, it } from "vitest"

import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"

describe("parseEnumValueInput", () => {
  it("parses JSON primitives", () => {
    expect(parseEnumValueInput("true")).toBe(true)
    expect(parseEnumValueInput("false")).toBe(false)
    expect(parseEnumValueInput("123")).toBe(123)
    expect(parseEnumValueInput("-4.5")).toBe(-4.5)
    expect(parseEnumValueInput("null")).toBeNull()
  })

  it("parses quoted strings, arrays, and objects", () => {
    expect(parseEnumValueInput('"hello"')).toBe("hello")
    expect(parseEnumValueInput("[1,2,3]")).toEqual([1, 2, 3])
    expect(parseEnumValueInput('{"a":1}')).toEqual({ a: 1 })
  })

  it("falls back to the raw string for plain text", () => {
    expect(parseEnumValueInput("hello")).toBe("hello")
    expect(parseEnumValueInput("North America")).toBe("North America")
  })

  it("falls back to the raw string for malformed JSON", () => {
    expect(parseEnumValueInput("{foo:")).toBe("{foo:")
    expect(parseEnumValueInput("[1,")).toBe("[1,")
  })

  it("preserves number-like strings that are not valid JSON numbers", () => {
    // Leading-zero forms are not valid JSON, so they stay strings.
    expect(parseEnumValueInput("007")).toBe("007")
    expect(parseEnumValueInput("+5")).toBe("+5")
  })

  it("returns an empty string for blank input", () => {
    expect(parseEnumValueInput("")).toBe("")
    expect(parseEnumValueInput("   ")).toBe("")
  })

  it("trims surrounding whitespace before parsing", () => {
    expect(parseEnumValueInput("  42  ")).toBe(42)
    expect(parseEnumValueInput("  text  ")).toBe("text")
  })
})

describe("formatEnumValueInput", () => {
  it("returns strings verbatim", () => {
    expect(formatEnumValueInput("hello")).toBe("hello")
    expect(formatEnumValueInput("")).toBe("")
  })

  it("JSON-stringifies non-strings", () => {
    expect(formatEnumValueInput(42)).toBe("42")
    expect(formatEnumValueInput(true)).toBe("true")
    expect(formatEnumValueInput(null)).toBe("null")
    expect(formatEnumValueInput([1, 2])).toBe("[1,2]")
  })
})

describe("format/parse round-trips", () => {
  // Non-string values survive a format -> parse cycle.
  it.each([42, -4.5, true, false, null, [1, 2, 3]])(
    "round-trips %j",
    (value) => {
      expect(parseEnumValueInput(formatEnumValueInput(value))).toEqual(value)
    }
  )

  it("round-trips ordinary strings", () => {
    for (const text of ["hello", "North America", "a b c"]) {
      expect(parseEnumValueInput(formatEnumValueInput(text))).toBe(text)
    }
  })
})
