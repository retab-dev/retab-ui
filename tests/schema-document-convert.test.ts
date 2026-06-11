import { describe, expect, it } from "vitest"
import type { JSONSchema7 } from "json-schema"

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document"

/** Semantic round-trip: content is preserved (key order ignored). */
function semantic(schema: JSONSchema7) {
  return toJsonSchema(fromJsonSchema(schema))
}

/** Byte round-trip: exact JSON, including key order. */
function byteExact(schema: JSONSchema7): boolean {
  return JSON.stringify(schema) === JSON.stringify(semantic(schema))
}

describe("convert: semantic round-trip", () => {
  const cases: Array<[string, JSONSchema7]> = [
    ["empty object", { type: "object", properties: {} }],
    [
      "scalars",
      {
        type: "object",
        properties: {
          s: { type: "string" },
          n: { type: "number" },
          i: { type: "integer" },
          b: { type: "boolean" },
          nul: { type: "null" },
        },
      },
    ],
    [
      "descriptions + titles",
      {
        type: "object",
        title: "T",
        description: "D",
        properties: { a: { type: "string", title: "A", description: "field a" } },
      },
    ],
    [
      "required array",
      {
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        required: ["a", "b"],
      },
    ],
    [
      "nullable via anyOf (editor convention)",
      {
        type: "object",
        properties: {
          x: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
      },
    ],
    [
      "nullable via type array",
      { type: "object", properties: { x: { type: ["string", "null"] } } },
    ],
    [
      "enum of strings + descriptions",
      {
        type: "object",
        properties: {
          c: {
            type: "string",
            enum: ["a", "b"],
            "x-enumDescriptions": { a: "first" },
          } as JSONSchema7,
        },
      },
    ],
    [
      "enum of numbers",
      { type: "object", properties: { c: { type: "number", enum: [1, 2, 3] } } },
    ],
    [
      "nested objects",
      {
        type: "object",
        properties: {
          o: {
            type: "object",
            properties: { inner: { type: "object", properties: { deep: { type: "string" } } } },
            required: ["inner"],
          },
        },
      },
    ],
    [
      "array of scalars",
      { type: "object", properties: { a: { type: "array", items: { type: "string" } } } },
    ],
    [
      "array of objects",
      {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: { type: "object", properties: { x: { type: "string" } }, required: ["x"] },
          },
        },
      },
    ],
    [
      "$defs + $ref",
      {
        type: "object",
        $defs: { Money: { type: "object", properties: { amount: { type: "number" } } } },
        properties: { total: { $ref: "#/$defs/Money" } },
      },
    ],
    [
      "legacy definitions keyword",
      {
        type: "object",
        definitions: { Foo: { type: "object", properties: { a: { type: "string" } } } },
        properties: { f: { $ref: "#/definitions/Foo" } },
      } as JSONSchema7,
    ],
    [
      "ref reused by multiple properties",
      {
        type: "object",
        $defs: { M: { type: "object", properties: { a: { type: "number" } } } },
        properties: { x: { $ref: "#/$defs/M" }, y: { $ref: "#/$defs/M" } },
      },
    ],
    [
      "unknown keywords carried (pattern/format/minLength/const/default/examples/x-*)",
      {
        type: "object",
        properties: {
          s: {
            type: "string",
            pattern: "^a",
            format: "email",
            minLength: 2,
            maxLength: 8,
            default: "x",
            examples: ["a@b.com"],
            "x-custom": { foo: 1 },
          } as JSONSchema7,
          c: { const: 42 } as JSONSchema7,
        },
      },
    ],
    [
      "oneOf / allOf",
      {
        type: "object",
        properties: {
          a: { oneOf: [{ type: "string" }, { type: "number" }] },
          b: { allOf: [{ type: "object" }, { properties: { x: { type: "string" } } }] },
        },
      },
    ],
    [
      "boolean schema as property value",
      { type: "object", properties: { anything: true, never: false } } as JSONSchema7,
    ],
    [
      "additionalProperties false + object",
      {
        type: "object",
        additionalProperties: false,
        properties: { a: { type: "string" } },
      } as JSONSchema7,
    ],
    [
      "tuple items (array-form)",
      {
        type: "object",
        properties: {
          pair: { type: "array", items: [{ type: "string" }, { type: "number" }] } as JSONSchema7,
        },
      },
    ],
    [
      "ref to non-defs location",
      {
        type: "object",
        properties: { a: { type: "string" }, b: { $ref: "#/properties/a" } },
      },
    ],
    [
      "nested $defs inside a subschema",
      {
        type: "object",
        properties: {
          sub: {
            type: "object",
            $defs: { Local: { type: "string" } },
            properties: { x: { $ref: "#/properties/sub/$defs/Local" } },
          } as JSONSchema7,
        },
      },
    ],
    [
      "empty required array preserved",
      { type: "object", properties: { a: { type: "string" } }, required: [] },
    ],
    [
      "deeply nested mixed",
      {
        type: "object",
        $defs: { Addr: { type: "object", properties: { city: { type: "string" } } } },
        properties: {
          person: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: { $ref: "#/$defs/Addr" },
              aliases: { type: "array", items: { type: "string" } },
              contacts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    kind: { type: "string", enum: ["email", "phone"] },
                    value: { anyOf: [{ type: "string" }, { type: "null" }] },
                  },
                },
              },
            },
            required: ["name"],
          },
        },
        required: ["person"],
      },
    ],
  ]

  for (const [name, schema] of cases) {
    it(`preserves content: ${name}`, () => {
      expect(semantic(schema)).toEqual(schema)
    })
  }
})

describe("convert: byte-exact round-trip (key order preserved)", () => {
  const cases: Array<[string, JSONSchema7]> = [
    [
      "$defs positioned before properties",
      {
        type: "object",
        title: "Invoice",
        $defs: { M: { type: "object", properties: { a: { type: "number" } } } },
        properties: { inv: { type: "string" }, total: { $ref: "#/$defs/M" } },
        required: ["inv"],
      },
    ],
    [
      "keyword order within a node",
      {
        type: "object",
        properties: {
          x: { description: "d", type: "string", pattern: "^x", title: "X" } as JSONSchema7,
        },
      },
    ],
  ]
  for (const [name, schema] of cases) {
    it(`byte-exact: ${name}`, () => {
      expect(byteExact(schema)).toBe(true)
    })
  }
})
