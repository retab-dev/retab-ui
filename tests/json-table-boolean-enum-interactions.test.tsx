// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableActivationIntent,
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import { createJsonTablePrimitiveActiveCellStore } from "@/components/json-table/json-table-primitive-active-cell-store"
import { createJsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import type { ProjectedCell } from "@/components/json-table/lib/document-projection"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileFormRow } from "@/components/json-table/single-file-form-row"

import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    is_paid: { type: "boolean" },
    status: { type: "string", enum: ["draft", "paid"] },
    rating: { type: "integer", enum: [1, 2] },
    nullable_status: {
      anyOf: [
        {
          type: "string",
          enum: ["draft", "paid"],
        },
        { type: "null" },
      ],
    },
    sentinel_status: {
      anyOf: [
        {
          type: "string",
          enum: ["__json_table_null__", "option:1", "__null__"],
        },
        { type: "null" },
      ],
    },
  },
}

const tableDocument: TableDocument = {
  id: "doc_1",
  data: {
    is_paid: false,
    status: "draft",
    rating: 1,
    nullable_status: "paid",
    sentinel_status: "__json_table_null__",
  },
}

function visibleColumn(key: string): VisibleColumn {
  const fieldMetadata = getFieldMetadata(schema, key)
  if (!fieldMetadata) throw new Error(`Missing field metadata for ${key}`)

  return {
    key,
    widthPx: 180,
    fieldMetadata,
  }
}

function SingleFileFormRowHarness({
  onDocumentDataChange,
  ...props
}: Omit<
  React.ComponentProps<typeof SingleFileFormRow>,
  | "primitiveActiveCellStore"
  | "primitiveEditStore"
  | "setPrimitiveActiveCell"
  | "structuredEditSession"
  | "startStructuredEditSession"
  | "setStructuredEditSessionOverlayOpen"
  | "closeStructuredEditSession"
  | "onDocumentDataChange"
> & {
  onDocumentDataChange?: React.ComponentProps<
    typeof SingleFileFormRow
  >["onDocumentDataChange"]
}) {
  const primitiveActiveCellStoreRef = React.useRef(
    createJsonTablePrimitiveActiveCellStore()
  )
  const primitiveEditStoreRef = React.useRef(createJsonTablePrimitiveEditStore())
  const [structuredEditSession, setStructuredEditSession] =
    React.useState<JsonTableStructuredEditSession | null>(null)
  const sessionIdRef = React.useRef(0)

  const setNextPrimitiveActiveCell = React.useCallback(
    (activeCell: JsonTablePrimitiveActiveCell | null) => {
      primitiveActiveCellStoreRef.current.setSnapshot(activeCell)
      if (activeCell) setStructuredEditSession(null)
    },
    []
  )

  const startStructuredEditSession = React.useCallback(
    (projectedCell: ProjectedCell, intent: JsonTableActivationIntent) => {
      const nextSessionId = sessionIdRef.current + 1
      sessionIdRef.current = nextSessionId
      primitiveActiveCellStoreRef.current.setSnapshot(null)
      setStructuredEditSession({
        id: nextSessionId,
        cellId: jsonTableCellId(
          props.document.id,
          projectedCell.materializedFieldPath
        ),
        docId: props.document.id,
        fieldPath: projectedCell.materializedFieldPath,
        intent,
        isOverlayOpen: false,
      })
    },
    [props.document.id]
  )
  const setStructuredEditSessionOverlayOpen = React.useCallback(
    (open: boolean) => {
      setStructuredEditSession((currentSession) =>
        currentSession && currentSession.isOverlayOpen !== open
          ? { ...currentSession, isOverlayOpen: open }
          : currentSession
      )
    },
    []
  )
  const closeStructuredEditSession = React.useCallback(() => {
    setStructuredEditSession(null)
  }, [])

  return (
    <SingleFileFormRow
      {...props}
      primitiveActiveCellStore={primitiveActiveCellStoreRef.current}
      primitiveEditStore={primitiveEditStoreRef.current}
      setPrimitiveActiveCell={setNextPrimitiveActiveCell}
      structuredEditSession={structuredEditSession}
      startStructuredEditSession={startStructuredEditSession}
      setStructuredEditSessionOverlayOpen={setStructuredEditSessionOverlayOpen}
      closeStructuredEditSession={closeStructuredEditSession}
      onDocumentDataChange={onDocumentDataChange ?? vi.fn()}
    />
  )
}

function renderJsonTableField({
  doc = tableDocument,
  fieldPath,
  isJsonEditable = true,
  onDocumentDataChange = vi.fn(),
}: {
  doc?: TableDocument
  fieldPath: string
  isJsonEditable?: boolean
  onDocumentDataChange?: React.ComponentProps<
    typeof SingleFileFormRow
  >["onDocumentDataChange"]
}) {
  const rows = projectDocumentRows({
    document: doc,
    visiblePaths: [fieldPath],
    includeArrayAddRows: true,
  })

  const view = render(
    <table>
      <tbody>
        <SingleFileFormRowHarness
          document={doc}
          schema={schema}
          projectedRow={rows[0]}
          visibleColumns={[visibleColumn(fieldPath)]}
          rowIdx={0}
          rowTopPx={0}
          rowHeightPx={32}
          onDocumentDataChange={onDocumentDataChange}
          isJsonEditable={isJsonEditable}
        />
      </tbody>
    </table>
  )

  const findCell = async () => {
    return waitFor(
      () => {
        const cell = view.container.querySelector<HTMLElement>(
          `[data-field-path="${fieldPath}"]`
        )
        if (!cell) throw new Error(`Expected ${fieldPath} cell to render`)
        return cell
      },
      { timeout: 5000 }
    )
  }

  return { ...view, findCell, onDocumentDataChange }
}

async function activateEnumCell(fieldPath: string) {
  const view = renderJsonTableField({ fieldPath })
  const cell = await view.findCell()

  fireEvent.click(cell, { button: 0, clientX: 0, clientY: 0, detail: 1 })

  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )

  return { ...view, cell, trigger }
}

async function clickEnumCell(fieldPath: string) {
  const view = renderJsonTableField({ fieldPath })
  const cell = await view.findCell()

  fireEvent.pointerDown(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  fireEvent.pointerUp(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  fireEvent.click(cell, { button: 0, clientX: 0, clientY: 0, detail: 1 })

  const trigger = await view.findByRole("combobox")
  await waitFor(() =>
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  )

  return { ...view, cell, trigger }
}

async function chooseOption(
  view: ReturnType<typeof renderJsonTableField>,
  optionName: string | RegExp
) {
  const option = await view.findByRole("option", { name: optionName })
  fireEvent.pointerDown(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  })
  fireEvent.pointerUp(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  })
  fireEvent.click(option)
}

function mockElementRect() {
  return vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(
      () =>
        ({
          x: 24,
          y: 48,
          top: 48,
          left: 24,
          right: 204,
          bottom: 78,
          width: 180,
          height: 30,
          toJSON: () => ({}),
        }) as DOMRect
    )
}

describe("json table boolean interactions", () => {
  it("toggles once and closes on the first boolean click", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderJsonTableField({
      fieldPath: "is_paid",
      onDocumentDataChange,
    })
    const cell = await view.findCell()

    fireEvent.pointerDown(cell, { button: 0 })

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        tableDocument.id,
        "is_paid",
        true
      )
    )
    expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(cell.getAttribute("data-active")).toBeNull())
  })

  it("toggles a boolean from Space keyboard activation", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderJsonTableField({
      fieldPath: "is_paid",
      onDocumentDataChange,
    })
    const cell = await view.findCell()

    cell.focus()
    fireEvent.keyDown(cell, { key: " " })

    await waitFor(() =>
      expect(onDocumentDataChange).toHaveBeenCalledWith(
        tableDocument.id,
        "is_paid",
        true
      )
    )
    expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(cell.getAttribute("data-active")).toBeNull())
  })

  it("does not auto-toggle booleans from Enter or F2 activation", async () => {
    for (const key of ["Enter", "F2"]) {
      const onDocumentDataChange = vi.fn()
      const view = renderJsonTableField({
        fieldPath: "is_paid",
        onDocumentDataChange,
      })
      const cell = await view.findCell()

      cell.focus()
      fireEvent.keyDown(cell, { key })

      await waitFor(() => expect(cell.getAttribute("data-active")).toBe("true"))
      expect(onDocumentDataChange).not.toHaveBeenCalled()

      fireEvent.click(view.getByRole("checkbox"))

      await waitFor(() =>
        expect(onDocumentDataChange).toHaveBeenCalledWith(
          tableDocument.id,
          "is_paid",
          true
        )
      )
      expect(onDocumentDataChange).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it("leaves read-only booleans inert", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderJsonTableField({
      fieldPath: "is_paid",
      isJsonEditable: false,
      onDocumentDataChange,
    })
    const cell = await view.findCell()

    fireEvent.pointerDown(cell, { button: 0 })
    fireEvent.keyDown(cell, { key: " " })
    fireEvent.click(view.getByRole("checkbox"))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
    expect(view.queryByRole("button")).toBeNull()
    expect(cell.getAttribute("data-active")).toBeNull()
  })
})

describe("json table enum interactions", () => {
  it("opens enum options on the first click", async () => {
    const { trigger, findByRole } = await activateEnumCell("status")

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await findByRole("option", { name: "paid" })).toBeTruthy()
  })

  it("keeps enum options open through the full first browser click sequence", async () => {
    const { trigger, findByRole } = await clickEnumCell("status")

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await findByRole("option", { name: "paid" })).toBeTruthy()
  })

  it("opens enum options with one anchor layout read", async () => {
    const getBoundingClientRect = mockElementRect()
    const view = await activateEnumCell("status")

    expect(await view.findByRole("option", { name: "paid" })).toBeTruthy()
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1)
  })

  it("commits enum options from keyboard navigation", async () => {
    const view = await activateEnumCell("status")

    fireEvent.keyDown(view.trigger, { key: "ArrowDown" })
    fireEvent.keyDown(view.trigger, { key: "Enter" })

    await waitFor(() =>
      expect(view.onDocumentDataChange).toHaveBeenCalledWith(
        tableDocument.id,
        "status",
        "paid"
      )
    )
  })

  it("closes enum options on Escape without committing", async () => {
    const view = await activateEnumCell("status")

    fireEvent.keyDown(view.trigger, { key: "Escape" })

    await waitFor(() =>
      expect(view.onDocumentDataChange).not.toHaveBeenCalled()
    )
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
  })

  it("closes enum options on outside interaction without committing", async () => {
    const view = await activateEnumCell("status")

    fireEvent.pointerDown(globalThis.document.body)

    await waitFor(() =>
      expect(view.onDocumentDataChange).not.toHaveBeenCalled()
    )
    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
  })

  it("commits selected enum options using the original JSON value type", async () => {
    const view = await activateEnumCell("rating")

    await chooseOption(view, "2")

    await waitFor(() =>
      expect(view.onDocumentDataChange).toHaveBeenCalledWith(
        tableDocument.id,
        "rating",
        2
      )
    )
  })

  it("commits nullable No selection as null", async () => {
    const view = await activateEnumCell("nullable_status")

    await chooseOption(view, /no selection/i)

    await waitFor(() =>
      expect(view.onDocumentDataChange).toHaveBeenCalledWith(
        tableDocument.id,
        "nullable_status",
        null
      )
    )
  })

  it("does not commit when selecting the current enum value", async () => {
    const view = await activateEnumCell("status")

    await chooseOption(view, "draft")

    await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
    expect(view.onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("keeps sentinel-like enum strings distinct from internal select values", async () => {
    const view = await activateEnumCell("sentinel_status")

    await chooseOption(view, "option:1")

    await waitFor(() =>
      expect(view.onDocumentDataChange).toHaveBeenCalledWith(
        tableDocument.id,
        "sentinel_status",
        "option:1"
      )
    )
  })
})
