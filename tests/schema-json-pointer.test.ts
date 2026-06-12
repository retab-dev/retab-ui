import { describe, expect, it } from "vitest"

import {
  decodeJsonPointerSegment,
  definitionNameFromRef,
  definitionRef,
  definitionRefAliases,
  escapeJsonPointerSegment,
  unescapeJsonPointerSegment,
} from "@/components/schema-editor/document/json-pointer"

describe("json-pointer segment escaping (RFC 6901)", () => {
  const cases: Array<[string, string]> = [
    ["plain", "plain"],
    ["a/b", "a~1b"],
    ["a~b", "a~0b"],
    ["~/", "~0~1"],
    ["a~1b", "a~01b"], // a literal "~1" must not be confused with an escaped "/"
    ["", ""],
  ]

  it.each(cases)("escape/unescape round-trips %j", (raw, escaped) => {
    expect(escapeJsonPointerSegment(raw)).toBe(escaped)
    expect(unescapeJsonPointerSegment(escaped)).toBe(raw)
  })

  it("escapes ~ before / so the order is unambiguous", () => {
    // "/" -> "~1"; if "~" were escaped after "/", "~1" would round-trip to "/".
    expect(escapeJsonPointerSegment("/")).toBe("~1")
    expect(unescapeJsonPointerSegment("~1")).toBe("/")
  })
})

describe("definitionRef / definitionNameFromRef round-trip", () => {
  const names = [
    "Address",
    "Company_Address",
    "a/b",
    "a~b",
    "First Name",
    "Über", // non-ASCII
    "100",
  ]

  it.each(names)("round-trips the name %j through $defs", (name) => {
    const ref = definitionRef("$defs", name)
    expect(ref.startsWith("#/$defs/")).toBe(true)
    expect(definitionNameFromRef(ref)).toBe(name)
  })

  it.each(names)("round-trips the name %j through definitions", (name) => {
    const ref = definitionRef("definitions", name)
    expect(ref.startsWith("#/definitions/")).toBe(true)
    expect(definitionNameFromRef(ref)).toBe(name)
  })

  it("returns the input verbatim for a non-definition ref", () => {
    expect(definitionNameFromRef("#/properties/foo")).toBe("#/properties/foo")
    expect(definitionNameFromRef("https://example.com/x")).toBe(
      "https://example.com/x"
    )
  })

  it("decodes a percent-encoded segment safely", () => {
    expect(decodeJsonPointerSegment("a%20b")).toBe("a b")
    // A lone, malformed percent escape must not throw.
    expect(decodeJsonPointerSegment("100%")).toBe("100%")
  })
})

describe("definitionRefAliases", () => {
  it("always includes the canonical definitionRef", () => {
    for (const name of ["Address", "a/b", "First Name"]) {
      const aliases = definitionRefAliases("$defs", name)
      expect(aliases).toContain(definitionRef("$defs", name))
    }
  })

  it("returns a deduplicated list", () => {
    const aliases = definitionRefAliases("$defs", "Address")
    expect(new Set(aliases).size).toBe(aliases.length)
  })

  it("covers the percent-encoded slash variant for names with '/'", () => {
    const aliases = definitionRefAliases("$defs", "a/b")
    // The escaped JSON-pointer form and the URL-encoded "/" (%2F, both cases)
    // should all be matchable so refs from any source resolve.
    expect(aliases).toContain("#/$defs/a~1b")
    expect(aliases).toContain("#/$defs/a%2Fb")
    expect(aliases).toContain("#/$defs/a%2fb")
  })

  it("uses the requested keyword for every alias", () => {
    const aliases = definitionRefAliases("definitions", "a/b")
    expect(aliases.every((a) => a.startsWith("#/definitions/"))).toBe(true)
  })
})
