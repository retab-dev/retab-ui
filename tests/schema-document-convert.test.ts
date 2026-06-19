import type { JSONSchema7 } from "json-schema";
import { describe, expect, it } from "vitest";

import {
  fromJsonSchema,
  toJsonSchema,
} from "@/components/schema-editor/document/convert";

/** Semantic round-trip: content is preserved (key order ignored). */
function semantic(schema: JSONSchema7) {
  return toJsonSchema(fromJsonSchema(schema));
}

/** Byte round-trip: exact JSON, including key order. */
function byteExact(schema: JSONSchema7): boolean {
  return JSON.stringify(schema) === JSON.stringify(semantic(schema));
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
        properties: {
          a: { type: "string", title: "A", description: "field a" },
        },
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
      "enum of numbers",
      {
        type: "object",
        properties: { c: { type: "number", enum: [1, 2, 3] } },
      },
    ],
    [
      "nested objects",
      {
        type: "object",
        properties: {
          o: {
            type: "object",
            properties: {
              inner: {
                type: "object",
                properties: { deep: { type: "string" } },
              },
            },
            required: ["inner"],
          },
        },
      },
    ],
    [
      "array of scalars",
      {
        type: "object",
        properties: { a: { type: "array", items: { type: "string" } } },
      },
    ],
    [
      "array of objects",
      {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: { x: { type: "string" } },
              required: ["x"],
            },
          },
        },
      },
    ],
    [
      "$defs + $ref",
      {
        type: "object",
        $defs: {
          Money: { type: "object", properties: { amount: { type: "number" } } },
        },
        properties: { total: { $ref: "#/$defs/Money" } },
      },
    ],
    [
      "legacy definitions keyword",
      {
        type: "object",
        definitions: {
          Foo: { type: "object", properties: { a: { type: "string" } } },
        },
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
          b: {
            allOf: [
              { type: "object" },
              { properties: { x: { type: "string" } } },
            ],
          },
        },
      },
    ],
    [
      "boolean schema as property value",
      {
        type: "object",
        properties: { anything: true, never: false },
      } as JSONSchema7,
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
          pair: {
            type: "array",
            items: [{ type: "string" }, { type: "number" }],
          } as JSONSchema7,
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
      "required names without properties are preserved",
      { type: "object", required: ["external"] },
    ],
    [
      "required names outside properties are preserved in source order",
      {
        type: "object",
        properties: { a: { type: "string" } },
        required: ["external", "a"],
      },
    ],
    [
      "property names with leading/trailing spaces",
      {
        type: "object",
        properties: { " a ": { type: "string" }, " ": { type: "number" } },
        required: [" a ", " "],
      },
    ],
    [
      "empty string property names imported from a schema",
      {
        type: "object",
        properties: { "": { type: "string" }, named: { type: "number" } },
        required: ["", "named"],
      },
    ],
    [
      "property names that collide with object prototype keys",
      JSON.parse(
        '{"type":"object","properties":{"__proto__":{"type":"string"},"constructor":{"type":"number"}},"required":["__proto__","constructor"]}',
      ) as JSONSchema7,
    ],
    [
      "definition names that collide with object prototype keys",
      JSON.parse(
        '{"type":"object","$defs":{"__proto__":{"type":"string"},"constructor":{"type":"number"}},"properties":{"a":{"$ref":"#/$defs/__proto__"},"b":{"$ref":"#/$defs/constructor"}}}',
      ) as JSONSchema7,
    ],
    [
      "unmodeled keywords that collide with object prototype keys",
      JSON.parse(
        '{"type":"object","__proto__":{"safe":true},"constructor":{"safe":true},"toString":{"safe":true},"properties":{"field":{"type":"string","__proto__":{"nested":true},"constructor":{"nested":true},"toString":{"nested":true}}}}',
      ) as JSONSchema7,
    ],
    [
      "deeply nested mixed",
      {
        type: "object",
        $defs: {
          Addr: { type: "object", properties: { city: { type: "string" } } },
        },
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
  ];

  for (const [name, schema] of cases) {
    it(`preserves content: ${name}`, () => {
      expect(semantic(schema)).toEqual(schema);
    });
  }
});

describe("convert: extension keywords", () => {
  it("preserves x-enumDescriptions on projection", () => {
    const input: JSONSchema7 = {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "paid"],
          "x-enumDescriptions": {
            draft: "Draft status",
            paid: "Paid status",
          },
        } as JSONSchema7,
      },
    };

    expect(semantic(input)).toEqual(input);
  });
});

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
          x: {
            description: "d",
            type: "string",
            pattern: "^x",
            title: "X",
          } as JSONSchema7,
        },
      },
    ],
  ];
  for (const [name, schema] of cases) {
    it(`byte-exact: ${name}`, () => {
      expect(byteExact(schema)).toBe(true);
    });
  }
});
