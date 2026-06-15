import { describe, expect, it } from "vitest"

import {
  createEditViewerFieldProjection,
  createEditViewerSegmentedDocumentModel,
  deriveEditViewerModes,
  displayEditFieldValue,
  editFieldTargetFromBBox,
  filterEditViewerFields,
  groupEditViewerFieldsByPage,
  groupLocatedEditViewerFieldsByPage,
  isEditFieldFilled,
  normalizeEditViewerResult,
  resolveEditViewerDocumentTarget,
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
  target: {
    kind: "pdf-area",
    pageNumber: 2,
    left: 10,
    top: 20,
    width: 30,
    height: 4,
  },
  targetStatus: { state: "resolved" },
}

function moveLocatedFieldToPage(
  field: EditViewerField,
  page: number
): EditViewerField {
  const bbox = { ...field.bbox!, page }
  return {
    ...field,
    bbox,
    target: editFieldTargetFromBBox(bbox),
    targetStatus: { state: "resolved" },
  }
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

  it("treats null requested mode as an explicit fallback request", () => {
    expect(
      resolveEditViewerMode({
        availableModes: ["source", "preview"],
        requestedMode: null,
        currentMode: "preview",
      })
    ).toBe("preview")

    expect(
      resolveEditViewerMode({
        availableModes: ["source", "preview"],
        requestedMode: null,
        currentMode: null,
      })
    ).toBe("preview")
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

  it("generates stable fallback keys for missing keys", () => {
    const fields = normalizeEditViewerResult({
      fields: [
        { type: "text", value: "first" },
        { type: "text", value: "second" },
      ],
    }).fields

    expect(fields.map((field) => field.key)).toEqual(["field_0", "field_1"])
    expect(fields.map((field) => field.description)).toEqual([
      "field_0",
      "field_1",
    ])
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
    expect(fields[0]?.target).toBeNull()
    expect(fields[0]?.targetStatus).toMatchObject({ state: "invalid" })
    expect(fields[1]?.bbox).toBeUndefined()
    expect(fields[1]?.target).toBeNull()
    expect(fields[1]?.targetStatus).toMatchObject({ state: "invalid" })
    expect(fields[2]?.bbox?.page).toBe(1)
    expect(fields[2]?.bbox?.left).toBe(0.9)
    expect(fields[2]?.bbox?.top).toBe(0.9)
    expect(fields[2]?.bbox?.width).toBeCloseTo(0.1)
    expect(fields[2]?.bbox?.height).toBeCloseTo(0.1)
    const clampedTarget = fields[2]?.target
    expect(clampedTarget).toMatchObject({
      kind: "pdf-area",
      pageNumber: 1,
      left: 90,
      top: 90,
    })
    expect(clampedTarget?.kind).toBe("pdf-area")
    if (clampedTarget?.kind !== "pdf-area") {
      throw new Error("Expected clamped edit field target to be a PDF area")
    }
    expect(clampedTarget.width).toBeCloseTo(10)
    expect(clampedTarget.height).toBeCloseTo(10)
    expect(fields[2]?.targetStatus).toEqual({ state: "resolved" })
    expect(
      filterEditViewerFields({ fields, filter: "no_location" }).map(
        (field) => field.key
      )
    ).toEqual(["bad_width", "bad_page"])
  })

  it("filters by query, fill state, and field type", () => {
    const fields: EditViewerField[] = [
      locatedField,
      {
        key: "send_wire",
        type: "checkbox",
        value: "checked",
        target: null,
        targetStatus: { state: "missing" },
      },
      {
        key: "memo",
        description: "Internal memo",
        type: "text",
        value: "",
        target: null,
        targetStatus: { state: "missing" },
      },
      {
        key: "floating",
        type: "text",
        value: "unlocated",
        target: null,
        targetStatus: { state: "missing" },
      },
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
    expect(fields.map((field) => field.key)).toEqual([
      "name",
      "send_wire",
      "memo",
      "floating",
    ])
  })

  it("groups located fields by page and preserves unlocated fields", () => {
    const groups = groupEditViewerFieldsByPage([
      locatedField,
      {
        ...moveLocatedFieldToPage(locatedField, 1),
        key: "city",
      },
      {
        key: "notes",
        type: "text",
        value: "N/A",
        target: null,
        targetStatus: { state: "missing" },
      },
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
        ...moveLocatedFieldToPage(locatedField, 1),
        key: "city",
      },
      {
        key: "notes",
        type: "text",
        value: "N/A",
        target: null,
        targetStatus: { state: "missing" },
      },
    ]
    const fieldsByPage = groupLocatedEditViewerFieldsByPage(fields)

    expect(fieldsByPage.get(1)?.map((field) => field.key)).toEqual(["city"])
    expect(fieldsByPage.get(2)?.map((field) => field.key)).toEqual(["name"])
    expect(
      [...fieldsByPage.values()].flat().map((field) => field.key)
    ).not.toContain("notes")
  })

  it("creates one field projection with stable first-key lookup", () => {
    const fields: EditViewerField[] = [
      locatedField,
      {
        ...moveLocatedFieldToPage(locatedField, 3),
        key: "name",
        value: "Duplicate",
      },
      {
        key: "notes",
        type: "text",
        value: "",
        target: null,
        targetStatus: { state: "missing" },
      },
    ]
    const projection = createEditViewerFieldProjection({
      fields,
      query: "",
      filter: "all",
    })

    expect(projection.fields).toBe(fields)
    expect(projection.fieldCount).toBe(3)
    expect(projection.visibleFieldCount).toBe(3)
    expect(projection.filledCount).toBe(2)
    expect(projection.fieldByKey.get("name")).toBe(fields[0])
    expect(projection.fieldsByPage.get(2)?.map((field) => field.key)).toEqual([
      "name",
    ])
    expect(projection.locatedFields.map((field) => field.key)).toEqual([
      "name",
      "name",
    ])
    expect(projection.unlocatedFields.map((field) => field.key)).toEqual([
      "notes",
    ])
    const segmentedDocument = createEditViewerSegmentedDocumentModel(fields)
    expect(segmentedDocument.segments[0]).toMatchObject({
      id: "edit:name:0",
      pages: [2],
      sourceId: "name",
    })
    expect(segmentedDocument.anchors?.[0]).toEqual({
      id: "edit:name:0:anchor",
      segmentId: "edit:name:0",
      pageNumber: 2,
      bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
    })
    expect(segmentedDocument.segments[2]).toMatchObject({
      id: "edit:notes:2",
      pages: [],
      sourceId: "notes",
    })
  })

  it("resolves document targets as pure model state", () => {
    expect(
      resolveEditViewerDocumentTarget({
        filledDocument,
        mode: "filled",
        sourceDocument,
        status: { state: "error", message: "failed" },
      })
    ).toEqual({ kind: "error", message: "failed" })

    expect(
      resolveEditViewerDocumentTarget({
        filledDocument,
        mode: "filled",
        sourceDocument,
        status: { state: "idle" },
      })
    ).toEqual({
      kind: "filled",
      document: filledDocument,
      showOverlay: false,
    })

    expect(
      resolveEditViewerDocumentTarget({
        filledDocument: null,
        mode: "preview",
        sourceDocument,
        status: { state: "idle" },
      })
    ).toEqual({
      kind: "preview",
      document: sourceDocument,
      showOverlay: true,
    })

    expect(
      resolveEditViewerDocumentTarget({
        filledDocument: null,
        mode: null,
        sourceDocument: null,
        status: { state: "idle" },
      })
    ).toEqual({
      kind: "empty",
      message: "No edit view is available.",
    })
  })
})
