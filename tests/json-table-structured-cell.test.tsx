// @vitest-environment jsdom

import { cleanup, screen } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

import {
  baseSession,
  renderStructuredCell,
} from "./json-table-cell-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

function objectField(schema: JSONSchema7): FieldMetadata {
  return {
    fieldPath: "profile_far_details",
    rawSchema: schema,
    schema,
    effectiveSchema: schema,
    isNullable: false,
    kind: "object",
    enumValues: [],
  }
}

describe("json table structured cell", () => {
  it("preserves typed dynamic object properties in the editor schema", () => {
    const fieldSchema: JSONSchema7 = {
      type: "object",
      patternProperties: {
        "^priority$": { type: "number" },
      },
      additionalProperties: { type: "string" },
    }

    renderStructuredCell("object", {
      effectiveValue: {
        reviewer: "reviewer-0",
        priority: 1,
      },
      fieldMetadata: objectField(fieldSchema),
      fieldPath: "profile_far_details",
      structuredEditSession: baseSession({
        fieldPath: "profile_far_details",
        isOverlayOpen: true,
      }),
    })

    const reviewer = screen.getByLabelText("reviewer") as HTMLInputElement
    const priority = screen.getByLabelText("priority") as HTMLInputElement

    expect(reviewer.value).toBe("reviewer-0")
    expect(reviewer.type).toBe("text")
    expect(priority.value).toBe("1")
    expect(priority.type).toBe("number")
  })
})
