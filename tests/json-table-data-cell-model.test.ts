import { describe, expect, it } from "vitest"

import { createJsonTableDataCellModel } from "@/components/json-table/json-table-data-cell-model"
import { jsonTableDisplayText } from "@/components/json-table/json-table-display-value"
import type {
  FieldKind,
  FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata"

function fieldMetadata({
  disabledEnumValues,
  enumValues = [],
  isNullable = false,
  kind,
}: {
  disabledEnumValues?: unknown[]
  enumValues?: unknown[]
  isNullable?: boolean
  kind: FieldKind
}): FieldMetadata {
  const rawSchema =
    disabledEnumValues === undefined
      ? {}
      : { "x-disabled-enum-values": disabledEnumValues }

  return {
    effectiveSchema: rawSchema,
    enumValues,
    fieldPath: "field",
    isNullable,
    kind,
    rawSchema,
    schema: {},
  }
}

describe("json table DataCell model", () => {
  it("maps primitive enum values to select options and commits the original JSON value", () => {
    const metadata = fieldMetadata({
      enumValues: ["draft", "approved"],
      kind: "enum",
    })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: "approved",
    })

    expect(model.kind).toBe("select")
    if (model.kind !== "select") throw new Error("Expected select model")
    expect(model.value).toBe("option:1")
    expect(model.selectOptions.map((option) => option.value)).toEqual([
      "option:0",
      "option:1",
    ])
    expect(model.commitValue("option:0")).toBe("draft")
  })

  it("commits object enum values by original object identity", () => {
    const approved = { code: "approved" }
    const rejected = { code: "rejected" }
    const metadata = fieldMetadata({
      enumValues: [approved, rejected],
      kind: "enum",
    })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: { code: "approved" },
    })

    expect(model.kind).toBe("select")
    if (model.kind !== "select") throw new Error("Expected select model")
    expect(model.value).toBe("option:0")
    expect(model.commitValue("option:0")).toBe(approved)
    expect(model.commitValue("option:1")).toBe(rejected)
  })

  it("marks schema-disabled enum values as disabled select options", () => {
    const metadata = fieldMetadata({
      disabledEnumValues: ["archived"],
      enumValues: ["draft", "archived", "approved"],
      kind: "enum",
    })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: "draft",
    })

    expect(model.kind).toBe("select")
    if (model.kind !== "select") throw new Error("Expected select model")
    expect(model.selectOptions.map((option) => option.disabled ?? false)).toEqual([
      false,
      true,
      false,
    ])
  })

  it("maps nullable enum null through a table-local select sentinel", () => {
    const metadata = fieldMetadata({
      enumValues: ["draft"],
      isNullable: true,
      kind: "enum",
    })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: null,
    })

    expect(model.kind).toBe("select")
    if (model.kind !== "select") throw new Error("Expected select model")
    expect(model.value).not.toBeNull()
    expect(model.selectOptions[0]?.label).toBe("No selection")
    expect(model.commitValue(model.value)).toBeNull()
  })

  it("keeps unknown enum values as strings", () => {
    const metadata = fieldMetadata({
      enumValues: ["draft"],
      kind: "enum",
    })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: "archived",
    })

    expect(model.kind).toBe("select")
    if (model.kind !== "select") throw new Error("Expected select model")
    expect(model.value).toBe("archived")
    expect(model.commitValue("archived")).toBe("archived")
  })

  it("uses display date text while committing normalized JSON dates", () => {
    const metadata = fieldMetadata({ kind: "date" })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: "2025-07-18",
    })

    expect(model.kind).toBe("date")
    if (model.kind !== "date") throw new Error("Expected date model")
    expect(
      jsonTableDisplayText({
        fieldMetadata: metadata,
        jsonValue: "2025-07-18",
      })
    ).toBe("Jul 18, 2025")
    expect(model.commitValue("7/18/2025")).toBe("2025-07-18")
  })

  it("adds seconds when committing time values without seconds", () => {
    const metadata = fieldMetadata({ kind: "time" })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: "09:30:00",
    })

    expect(model.kind).toBe("time")
    if (model.kind !== "time") throw new Error("Expected time model")
    expect(model.commitValue("09:45")).toBe("09:45:00")
  })

  it("projects number and integer values as number DataCell values", () => {
    const numberModel = createJsonTableDataCellModel({
      fieldMetadata: fieldMetadata({ kind: "number" }),
      value: "12.5",
    })
    const integerModel = createJsonTableDataCellModel({
      fieldMetadata: fieldMetadata({ kind: "integer" }),
      value: 12,
    })

    expect(numberModel.kind).toBe("number")
    expect(numberModel.value).toBe("12.5")
    expect(integerModel.kind).toBe("integer")
    expect(integerModel.value).toBe(12)
  })

  it("projects structured fallback values as text", () => {
    const metadata = fieldMetadata({ kind: "object" })
    const model = createJsonTableDataCellModel({
      fieldMetadata: metadata,
      value: { vendor: "ACME" },
    })

    expect(model.kind).toBe("text")
    if (model.kind !== "text") throw new Error("Expected text model")
    expect(model.value).toBe('{"vendor":"ACME"}')
    expect(model.commitValue("updated")).toBe("updated")
  })
})
