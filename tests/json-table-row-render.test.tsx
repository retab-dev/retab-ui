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
import { createJsonTablePrimitivePatchStore } from "@/components/json-table/json-table-primitive-patch-store"
import type { ProjectedCell } from "@/components/json-table/lib/document-projection"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileFormRow } from "@/components/json-table/single-file-form-row"

import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => cleanup())

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    shipped_at: { type: "string", format: "date" },
    is_paid: { type: "boolean" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
    },
    metadata: {
      type: "object",
      properties: {
        source: { type: "string" },
      },
    },
    nullable_note: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    status: {
      enum: ["__null__", "approved"],
    },
  },
}

const document: TableDocument = {
  id: "doc_1",
  data: {
    vendor: "ACME",
    shipped_at: "2024-01-02",
    is_paid: false,
    lines: [{ name: "one" }, { name: "two" }],
    metadata: { source: "upload" },
    nullable_note: null,
    status: "__null__",
  },
}

function visibleColumn(key: string): VisibleColumn {
  return {
    key,
    widthPx: 160,
    fieldMetadata: getFieldMetadata(schema, key),
  }
}

function SingleFileFormRowHarness({
  onDocumentDataChange,
  ...props
}: Omit<
  React.ComponentProps<typeof SingleFileFormRow>,
  | "primitiveActiveCellStore"
  | "primitivePatchStore"
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
  const primitivePatchStoreRef = React.useRef(createJsonTablePrimitivePatchStore())
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
      primitivePatchStore={primitivePatchStoreRef.current}
      setPrimitiveActiveCell={setNextPrimitiveActiveCell}
      structuredEditSession={structuredEditSession}
      startStructuredEditSession={startStructuredEditSession}
      setStructuredEditSessionOverlayOpen={setStructuredEditSessionOverlayOpen}
      closeStructuredEditSession={closeStructuredEditSession}
      onDocumentDataChange={onDocumentDataChange ?? vi.fn()}
    />
  )
}

describe("json table row rendering", () => {
  it("formats read-only scalar, date, array, object, null, and invalid cells", () => {
    const visiblePaths = [
      "vendor",
      "shipped_at",
      "is_paid",
      "lines",
      "metadata",
      "nullable_note",
      "status",
      "missing",
    ]
    const rows = projectDocumentRows({
      document,
      visiblePaths,
      includeArrayAddRows: false,
    })

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRowHarness
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            onDocumentDataChange={vi.fn()}
            isJsonEditable={false}
          />
        </tbody>
      </table>
    )

    expect(view.getByText("ACME")).toBeTruthy()
    expect(view.getByText("Jan 2, 2024")).toBeTruthy()
    expect(view.getByText("[2 items]")).toBeTruthy()
    expect(view.getByText(JSON.stringify({ source: "upload" }))).toBeTruthy()
    expect(view.getByRole("checkbox").getAttribute("aria-checked")).toBe(
      "false"
    )

    const cells = Array.from(view.container.querySelectorAll("td"))
    expect(cells).toHaveLength(8)
    expect(
      view.container.querySelectorAll('[data-slot="data-cell"]')
    ).toHaveLength(6)
    expect(
      cells[0].querySelector('[data-slot="json-table-read-only-cell-text"]')
        ?.textContent
    ).toBe("ACME")
    expect(cells[0].querySelector('[data-slot="data-cell-value"]')).toBeNull()
    expect(view.getAllByRole("button")).toHaveLength(2)
    expect(cells[5].textContent).toBe(String.fromCharCode(8212))
    expect(cells[6].textContent).toBe("__null__")
    expect(cells[7].textContent).toBe("")
    expect(cells[7].getAttribute("data-field-path")).toBe("missing")
  })

  it("keeps read-only cells aligned when an earlier array is empty", () => {
    const visiblePaths = ["empty_lines.*.name", "lines.*.name", "vendor"]
    const rows = projectDocumentRows({
      document: {
        id: "doc_1",
        data: {
          empty_lines: [],
          lines: [{ name: "one" }],
          vendor: "ACME",
        },
      },
      visiblePaths,
      includeArrayAddRows: false,
    })

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRowHarness
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            onDocumentDataChange={vi.fn()}
            isJsonEditable={false}
          />
        </tbody>
      </table>
    )

    const cells = Array.from(view.container.querySelectorAll("td"))
    expect(cells).toHaveLength(3)
    expect(cells[0].textContent).toBe("")
    expect(cells[1].getAttribute("data-field-path")).toBe("lines.0.name")
    expect(cells[1].textContent).toContain("one")
    expect(cells[2].getAttribute("data-field-path")).toBe("vendor")
    expect(cells[2].textContent).toContain("ACME")
  })

  it("activates and commits edits from a hovered text cell", async () => {
    const visiblePaths = ["vendor"]
    const rows = projectDocumentRows({
      document,
      visiblePaths,
      includeArrayAddRows: true,
    })
    const onDocumentDataChange = vi.fn()

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRowHarness
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            onDocumentDataChange={onDocumentDataChange}
            isJsonEditable
          />
        </tbody>
      </table>
    )

    const cell = await waitFor(() => {
      const editableCell = view.container.querySelector(
        '[data-json-table-editable-cell="true"]'
      )
      if (!(editableCell instanceof HTMLElement)) {
        throw new Error("Expected editable vendor cell to render")
      }
      return editableCell
    })
    fireEvent.pointerEnter(cell)
    expect(view.queryByRole("textbox")).toBeNull()

    fireEvent.pointerDown(cell, { button: 0 })

    const input = view.getByRole("textbox")
    expect(globalThis.document.activeElement).toBe(input)

    fireEvent.change(input, { target: { value: "Globex" } })
    fireEvent.blur(input)

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      document.id,
      "vendor",
      "Globex"
    )
  })

  it("toggles boolean cells on the first click", async () => {
    const visiblePaths = ["is_paid"]
    const rows = projectDocumentRows({
      document,
      visiblePaths,
      includeArrayAddRows: true,
    })
    const onDocumentDataChange = vi.fn()

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRowHarness
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            onDocumentDataChange={onDocumentDataChange}
            isJsonEditable
          />
        </tbody>
      </table>
    )

    const cell = await waitFor(() => {
      const editableCell = view.container.querySelector(
        '[data-json-table-editable-cell="true"]'
      )
      if (!(editableCell instanceof HTMLElement)) {
        throw new Error("Expected editable boolean cell to render")
      }
      return editableCell
    })

    fireEvent.pointerDown(cell, { button: 0 })

    expect(onDocumentDataChange).toHaveBeenCalledWith(
      document.id,
      "is_paid",
      true
    )
  })

  it("starts text edit sessions from a typeable key", async () => {
    const visiblePaths = ["vendor"]
    const rows = projectDocumentRows({
      document,
      visiblePaths,
      includeArrayAddRows: true,
    })

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRowHarness
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            onDocumentDataChange={vi.fn()}
            isJsonEditable
          />
        </tbody>
      </table>
    )

    const cell = await waitFor(() => {
      const editableCell = view.container.querySelector(
        '[data-json-table-editable-cell="true"]'
      )
      if (!(editableCell instanceof HTMLElement)) {
        throw new Error("Expected editable vendor cell to render")
      }
      return editableCell
    })

    cell.focus()
    fireEvent.keyDown(cell, { key: "Z" })

    const input = view.getByRole("textbox")
    expect((input as HTMLInputElement).value).toBe("Z")
  })

  it("opens enum selects on the first click", async () => {
    const visiblePaths = ["status"]
    const rows = projectDocumentRows({
      document,
      visiblePaths,
      includeArrayAddRows: true,
    })

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRowHarness
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            onDocumentDataChange={vi.fn()}
            isJsonEditable
          />
        </tbody>
      </table>
    )

    const cell = await waitFor(() => {
      const editableCell = view.container.querySelector(
        '[data-json-table-editable-cell="true"]'
      )
      if (!(editableCell instanceof HTMLElement)) {
        throw new Error("Expected editable enum cell to render")
      }
      return editableCell
    })

    fireEvent.click(cell, {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })

    expect(
      (await view.findByRole("combobox")).getAttribute("aria-expanded")
    ).toBe("true")
  })

  it("opens date pickers on the first click", async () => {
    const visiblePaths = ["shipped_at"]
    const rows = projectDocumentRows({
      document,
      visiblePaths,
      includeArrayAddRows: true,
    })

    const view = render(
      <table>
        <tbody>
          <SingleFileFormRowHarness
            document={document}
            schema={schema}
            projectedRow={rows[0]}
            visibleColumns={visiblePaths.map(visibleColumn)}
            rowIdx={0}
            rowTopPx={0}
            rowHeightPx={32}
            onDocumentDataChange={vi.fn()}
            isJsonEditable
          />
        </tbody>
      </table>
    )

    const cell = await waitFor(() => {
      const editableCell = view.container.querySelector(
        '[data-json-table-editable-cell="true"]'
      )
      if (!(editableCell instanceof HTMLElement)) {
        throw new Error("Expected editable date cell to render")
      }
      return editableCell
    })

    fireEvent.pointerDown(cell, { button: 0 })

    expect(await view.findByRole("dialog")).toBeTruthy()
  })
})
