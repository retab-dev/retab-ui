import { describe, expect, it } from "vitest"

import {
  deriveEditViewerModes,
  displayEditFieldValue,
  filterEditViewerFields,
  groupEditViewerFieldsByPage,
  groupLocatedEditViewerFieldsByPage,
  isEditFieldFilled,
  normalizeEditViewerResult,
  resolveEditViewerMode,
  resolveEditViewerOptions,
} from "@/components/viewers/edit/edit-viewer-model"
import type { EditViewerField } from "@/components/viewers/edit/edit-viewer-types"

const sourceDocument = {
  src: "/original.pdf",
  mimeType: "application/pdf",
  filename: "original.pdf",
}

const imageSourceDocument = {
  src: "/source.png",
  mimeType: "image/png",
  filename: "source.png",
}

const filledDocument = {
  src: "/filled.pdf",
  mimeType: "application/pdf",
  filename: "filled.pdf",
}

const locatedField: EditViewerField = {
  key: "name",
  description: "Name",
  type: "text",
  value: "Ada Lovelace",
  bbox: {
    page: 2,
    left: 0.1,
    top: 0.2,
    width: 0.3,
    height: 0.04,
  },
}

const defaultOptions = resolveEditViewerOptions(undefined)

describe("edit viewer model", () => {
  it("derives actual filled mode only when a filled document exists", () => {
    expect(
      deriveEditViewerModes({
        fields: [locatedField],
        sourceDocument,
        filledDocument,
        options: defaultOptions,
      })
    ).toEqual(["source", "preview", "filled"])
  })

  it("derives preview from a PDF source document and located fields", () => {
    expect(
      deriveEditViewerModes({
        fields: [locatedField],
        sourceDocument,
        options: defaultOptions,
      })
    ).toEqual(["source", "preview"])
  })

  it("does not derive preview for non-PDF source documents", () => {
    expect(
      deriveEditViewerModes({
        fields: [locatedField],
        sourceDocument: imageSourceDocument,
        options: defaultOptions,
      })
    ).toEqual(["source"])
  })

  it("derives modes only from already-normalized field locations", () => {
    const result = normalizeEditViewerResult({
      fields: [
        {
          key: "bad_location",
          type: "text",
          value: "ignored",
          bbox: { page: 1, left: 0.1, top: 0.1, width: 0, height: 0.1 },
        },
      ],
    })

    expect(
      deriveEditViewerModes({
        fields: result.fields,
        sourceDocument,
        options: defaultOptions,
      })
    ).toEqual(["source"])
  })

  it("resolves requested and fallback modes predictably", () => {
    const available = ["filled", "source", "preview"] as const

    expect(
      resolveEditViewerMode({
        availableModes: available,
        requestedMode: "source",
      })
    ).toBe("source")

    expect(
      resolveEditViewerMode({
        availableModes: available,
        requestedMode: "preview",
      })
    ).toBe("preview")

    expect(resolveEditViewerMode({ availableModes: [] })).toBeNull()
  })

  it("normalizes checkbox strings and booleans", () => {
    const fields = normalizeEditViewerResult({
      fields: [
        { key: "a", type: "checkbox", value: "checked" },
        { key: "b", type: "checkbox", value: true },
        { key: "c", type: "checkbox", value: "false" },
      ],
    }).fields

    expect(fields.map(isEditFieldFilled)).toEqual([true, true, false])
    expect(fields.map(displayEditFieldValue)).toEqual([
      "Checked",
      "Checked",
      "Unchecked",
    ])
  })

  it("normalizes max_length into maxLength only", () => {
    const fields = normalizeEditViewerResult({
      fields: [
        {
          key: "comb",
          type: "text",
          value: "ABC",
          max_length: 3,
        },
      ],
    }).fields

    expect(fields[0]?.maxLength).toBe(3)
    expect("max_length" in fields[0]!).toBe(false)
  })

  it("drops malformed bboxes so fields become unlocated", () => {
    const fields = normalizeEditViewerResult({
      fields: [
        {
          key: "bad_width",
          type: "text",
          value: "invalid",
          bbox: { page: 1, left: 0.1, top: 0.2, width: 0, height: 0.1 },
        },
        {
          key: "bad_page",
          type: "text",
          value: "invalid",
          bbox: { page: 0, left: 0.1, top: 0.2, width: 0.2, height: 0.1 },
        },
        {
          key: "clamped",
          type: "text",
          value: "valid",
          bbox: { page: 1, left: 0.9, top: 0.9, width: 0.5, height: 0.5 },
        },
      ],
    }).fields

    expect(fields[0]?.bbox).toBeUndefined()
    expect(fields[1]?.bbox).toBeUndefined()
    expect(fields[2]?.bbox?.page).toBe(1)
    expect(fields[2]?.bbox?.left).toBe(0.9)
    expect(fields[2]?.bbox?.top).toBe(0.9)
    expect(fields[2]?.bbox?.width).toBeCloseTo(0.1)
    expect(fields[2]?.bbox?.height).toBeCloseTo(0.1)
    expect(
      filterEditViewerFields({ fields, filter: "no_location" }).map(
        (field) => field.key
      )
    ).toEqual(["bad_width", "bad_page"])
  })

  it("filters by query, fill state, and field type", () => {
    const fields: EditViewerField[] = [
      locatedField,
      { key: "send_wire", type: "checkbox", value: "checked" },
      { key: "memo", description: "Internal memo", type: "text", value: "" },
      { key: "floating", type: "text", value: "unlocated" },
    ]

    expect(
      filterEditViewerFields({ fields, query: "wire" }).map(
        (field) => field.key
      )
    ).toEqual(["send_wire"])
    expect(
      filterEditViewerFields({ fields, filter: "filled" }).map(
        (field) => field.key
      )
    ).toEqual(["name", "send_wire", "floating"])
    expect(
      filterEditViewerFields({ fields, filter: "empty" }).map(
        (field) => field.key
      )
    ).toEqual(["memo"])
    expect(
      filterEditViewerFields({ fields, filter: "checkbox" }).map(
        (field) => field.key
      )
    ).toEqual(["send_wire"])
    expect(
      filterEditViewerFields({ fields, filter: "no_location" }).map(
        (field) => field.key
      )
    ).toEqual(["send_wire", "memo", "floating"])
  })

  it("groups located fields by page and preserves unlocated fields", () => {
    const groups = groupEditViewerFieldsByPage([
      locatedField,
      {
        ...locatedField,
        key: "city",
        bbox: { ...locatedField.bbox!, page: 1 },
      },
      { key: "notes", type: "text", value: "N/A" },
    ])

    expect(groups.map((group) => group.label)).toEqual([
      "Page 1",
      "Page 2",
      "No location",
    ])
    expect(groups.at(-1)?.fields.map((field) => field.key)).toEqual(["notes"])
  })

  it("indexes only located fields for page overlays", () => {
    const fields: EditViewerField[] = [
      locatedField,
      {
        ...locatedField,
        key: "city",
        bbox: { ...locatedField.bbox!, page: 1 },
      },
      { key: "notes", type: "text", value: "N/A" },
    ]
    const fieldsByPage = groupLocatedEditViewerFieldsByPage(fields)

    expect(fieldsByPage.get(1)?.map((field) => field.key)).toEqual(["city"])
    expect(fieldsByPage.get(2)?.map((field) => field.key)).toEqual(["name"])
    expect(
      [...fieldsByPage.values()].flat().map((field) => field.key)
    ).not.toContain("notes")
  })
})
