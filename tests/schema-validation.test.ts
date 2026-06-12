import type { JSONSchema7 } from "json-schema"
import { describe, expect, it } from "vitest"

import {
  countSchemaProperties,
  validateProjectedSchema,
} from "@/components/schema-editor/validation"

describe("schema validation property counting", () => {
  it("does not recurse forever on self-referential local refs", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        Node: {
          type: "object",
          properties: {
            children: {
              type: "array",
              items: { $ref: "#/$defs/Node" },
            },
          },
        },
      },
      properties: {
        root: { $ref: "#/$defs/Node" },
      },
    }

    expect(countSchemaProperties(schema)).toBe(2)
    expect(() => validateProjectedSchema(schema)).not.toThrow()
  })

  it("does not over-count recursive refs that use encoded aliases", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        "Node X": {
          type: "object",
          properties: {
            children: {
              type: "array",
              items: { $ref: "#/$defs/Node%20X" },
            },
          },
        },
      },
      properties: {
        root: { $ref: "#/$defs/Node X" },
      },
    }

    expect(countSchemaProperties(schema)).toBe(2)
    expect(() => validateProjectedSchema(schema)).not.toThrow()
  })

  it("does not recurse forever on mutually recursive local refs", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        A: {
          type: "object",
          properties: {
            b: { $ref: "#/$defs/B" },
          },
        },
        B: {
          type: "object",
          properties: {
            a: { $ref: "#/$defs/A" },
          },
        },
      },
      properties: {
        entry: { $ref: "#/$defs/A" },
      },
    }

    expect(countSchemaProperties(schema)).toBe(3)
    expect(() => validateProjectedSchema(schema)).not.toThrow()
  })

  it("counts local refs with escaped JSON Pointer segments", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        "A/B~C": {
          type: "object",
          properties: {
            value: { type: "string" },
          },
        },
      },
      properties: {
        escaped: { $ref: "#/$defs/A~1B~0C" },
      },
    }

    expect(countSchemaProperties(schema)).toBe(2)
  })

  it("counts local refs with URI-encoded JSON Pointer segments", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        "Line Item": {
          type: "object",
          properties: {
            sku: { type: "string" },
          },
        },
      },
      properties: {
        item: { $ref: "#/$defs/Line%20Item" },
      },
    }

    expect(countSchemaProperties(schema)).toBe(2)
  })

  it("counts ambiguous refs using JSON Pointer semantics before encoded-name tolerance", () => {
    const schema: JSONSchema7 = {
      type: "object",
      $defs: {
        "A/B": {
          type: "object",
          properties: { slash: { type: "string" } },
        },
        "A~1B": {
          type: "object",
          properties: { tilde_one: { type: "string" } },
        },
      },
      properties: {
        item: { $ref: "#/$defs/A~1B" },
      },
    }

    expect(countSchemaProperties(schema)).toBe(2)
  })

  it("does not resolve local refs through inherited object properties", () => {
    Object.defineProperty(Object.prototype, "__schemaEditorLeakedSchema", {
      value: {
        type: "object",
        properties: { leaked: { type: "string" } },
      },
      configurable: true,
    })

    try {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          ref: { $ref: "#/__schemaEditorLeakedSchema" },
        },
      }

      expect(countSchemaProperties(schema)).toBe(1)
    } finally {
      delete (Object.prototype as Record<string, unknown>)
        .__schemaEditorLeakedSchema
    }
  })

  it("counts properties inside schema-bearing object keywords", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        bag: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: { x: { type: "string" } },
          },
          patternProperties: {
            "^meta_": {
              type: "object",
              properties: { y: { type: "string" } },
            },
          },
          dependencies: {
            tag: {
              type: "object",
              properties: { z: { type: "string" } },
            },
            code: ["tag"],
          },
        },
      },
    }

    expect(countSchemaProperties(schema)).toBe(4)
  })

  it("counts properties inside items even when type is omitted", () => {
    const schema: JSONSchema7 = {
      items: {
        type: "object",
        properties: { row_id: { type: "string" } },
      },
    } as JSONSchema7

    expect(countSchemaProperties(schema)).toBe(1)
  })

  it("counts properties inside conditional schemas", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        mode: { type: "string" },
      },
      if: {
        type: "object",
        properties: { flag: { type: "boolean" } },
      },
      then: {
        type: "object",
        properties: { approver: { type: "string" } },
      },
      else: {
        type: "object",
        properties: { reason: { type: "string" } },
      },
    }

    expect(countSchemaProperties(schema)).toBe(4)
  })
})
