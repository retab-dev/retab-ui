import { describe, expect, it } from "vitest"

import {
  getEffectiveNode,
  validateName,
} from "@/components/schema-editor/lib/json-schema-utils"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

describe("validateName: syntax", () => {
  it("accepts valid identifiers", () => {
    expect(validateName("foo")).toBeNull()
    expect(validateName("_private")).toBeNull()
    expect(validateName("Foo_Bar_123")).toBeNull()
  })

  it("rejects names not starting with a letter or underscore", () => {
    expect(validateName("1foo")).not.toBeNull()
    expect(validateName("-foo")).not.toBeNull()
    expect(validateName("")).not.toBeNull()
  })

  it("rejects names with disallowed characters", () => {
    expect(validateName("foo bar")).not.toBeNull()
    expect(validateName("foo-bar")).not.toBeNull()
    expect(validateName("foo.bar")).not.toBeNull()
    expect(validateName("café")).not.toBeNull()
  })

  it("enforces the 64-character maximum at the boundary", () => {
    const sixtyFour = "a".repeat(64)
    const sixtyFive = "a".repeat(65)
    expect(validateName(sixtyFour)).toBeNull()
    expect(validateName(sixtyFive)).not.toBeNull()
  })

  it("rejects Pydantic reserved names", () => {
    expect(validateName("model_config")).toContain("reserved")
    expect(validateName("__root__")).toContain("reserved")
  })
})

describe("validateName: uniqueness", () => {
  it("rejects a case-insensitive duplicate", () => {
    expect(validateName("foo", ["FOO"])).not.toBeNull()
    expect(validateName("Bar", ["bar", "baz"])).not.toBeNull()
  })

  it("allows a name absent from the sibling list", () => {
    expect(validateName("unique", ["foo", "bar"])).toBeNull()
  })

  it("allows keeping the current name (including case-only edits)", () => {
    // Renaming "Foo" -> "foo" must be allowed even though "Foo" is in the list.
    expect(validateName("foo", ["Foo", "bar"], "Foo")).toBeNull()
    expect(validateName("Foo", ["Foo", "bar"], "Foo")).toBeNull()
  })

  it("still rejects collisions with a *different* sibling while renaming", () => {
    expect(validateName("bar", ["Foo", "bar"], "Foo")).not.toBeNull()
  })
})

describe("getEffectiveNode", () => {
  it("returns the non-null branch of a nullable anyOf", () => {
    const node: ExtendedJSONSchema7 = {
      anyOf: [{ type: "string" }, { type: "null" }],
    }
    expect(getEffectiveNode(node)).toEqual({ type: "string" })
  })

  it("returns the non-null branch regardless of position", () => {
    const node: ExtendedJSONSchema7 = {
      anyOf: [{ type: "null" }, { type: "integer" }],
    }
    expect(getEffectiveNode(node)).toEqual({ type: "integer" })
  })

  it("treats a $ref branch as non-null even if it carries type null", () => {
    const ref = { $ref: "#/$defs/Foo", type: "null" as const }
    const node: ExtendedJSONSchema7 = { anyOf: [ref] }
    expect(getEffectiveNode(node)).toBe(ref)
  })

  it("returns the node itself when there is no anyOf", () => {
    const node: ExtendedJSONSchema7 = { type: "string" }
    expect(getEffectiveNode(node)).toBe(node)
  })

  it("falls back to the node when every branch is null", () => {
    const node: ExtendedJSONSchema7 = {
      anyOf: [{ type: "null" }, { type: "null" }],
    }
    expect(getEffectiveNode(node)).toBe(node)
  })
})
