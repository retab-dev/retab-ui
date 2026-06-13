// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableActivationIntent,
  JsonTableEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import type {
  ProjectedCell,
  ProjectedRow,
} from "@/components/json-table/lib/document-projection"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileFormRow } from "@/components/json-table/single-file-form-row"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"

import { installJsonTableDom } from "./json-table-test-dom"

beforeAll(() => installJsonTableDom())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    note: { type: "string" },
    amount: { type: "number" },
    count: { type: "integer" },
    is_paid: { type: "boolean" },
    status: { type: "string", enum: ["draft", "paid"] },
    shipped_at: { type: "string", format: "date" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          transaction_type: { type: "string", enum: ["CREDIT", "DEBIT"] },
          shipped_at: { type: "string", format: "date" },
        },
      },
    },
  },
}

const document: TableDocument = {
  id: "doc_1",
  data: {
    vendor: "ACME",
    note: "original",
    amount: 12,
    count: 3,
    is_paid: false,
    status: "draft",
    shipped_at: "2024-01-02",
  },
}

function requireFieldMetadata(key: string): FieldMetadata {
  const fieldMetadata = getFieldMetadata(schema, key)
  if (!fieldMetadata) throw new Error(`Missing field metadata for ${key}`)
  return fieldMetadata
}

function visibleColumn(key: string): VisibleColumn {
  return {
    key,
    widthPx: 160,
    fieldMetadata: requireFieldMetadata(key),
  }
}

function headerNode(key: string): JsonTableHeaderNode {
  const fieldMetadata = requireFieldMetadata(key)

  return {
    key,
    label: key,
    propName: key.split(".").at(-1) ?? key,
    parentPath: "",
    rawSchema: fieldMetadata.rawSchema,
    schema: fieldMetadata.schema,
    effectiveType: headerEffectiveType(fieldMetadata),
    isObject: fieldMetadata.kind === "object",
    isArray: fieldMetadata.kind === "array",
    canFold: false,
    isExpanded: true,
  }
}

function headerEffectiveType(fieldMetadata: FieldMetadata) {
  if (fieldMetadata.kind === "string") return "string"
  return fieldMetadata.kind
}

function editableCells(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-json-table-editable-cell="true"]'
    )
  )
}

function cellByFieldPath(container: HTMLElement, fieldPath: string) {
  const cell = container.querySelector<HTMLElement>(
    `[data-field-path="${fieldPath}"]`
  )
  if (!cell) throw new Error(`Missing cell ${fieldPath}`)
  return cell
}

function rowByIndex(container: HTMLElement, index: number) {
  const row = container.querySelector<HTMLElement>(`[data-index="${index}"]`)
  if (!row) throw new Error(`Missing row ${index}`)
  return row
}

function SingleFileFormRowHarness({
  onDocumentDataChange,
  ...props
}: Omit<
  React.ComponentProps<typeof SingleFileFormRow>,
  | "editSession"
  | "startEditSession"
  | "updateEditSessionDraft"
  | "setEditSessionOverlayOpen"
  | "closeEditSession"
  | "onDocumentDataChange"
> & {
  onDocumentDataChange?: React.ComponentProps<
    typeof SingleFileFormRow
  >["onDocumentDataChange"]
}) {
  const [editSession, setEditSession] =
    React.useState<JsonTableEditSession | null>(null)
  const sessionIdRef = React.useRef(0)

  const startEditSession = React.useCallback(
    (projectedCell: ProjectedCell, intent: JsonTableActivationIntent) => {
      const nextSessionId = sessionIdRef.current + 1
      sessionIdRef.current = nextSessionId
      setEditSession({
        id: nextSessionId,
        cellId: jsonTableCellId(
          props.document.id,
          projectedCell.materializedFieldPath
        ),
        docId: props.document.id,
        fieldPath: projectedCell.materializedFieldPath,
        intent,
        initialValue: projectedCell.value,
        draftValue: projectedCell.value,
        status: "editing",
        isOverlayOpen: false,
      })
    },
    [props.document.id]
  )
  const updateEditSessionDraft = React.useCallback((value: unknown) => {
    setEditSession((currentSession) =>
      currentSession && !Object.is(currentSession.draftValue, value)
        ? { ...currentSession, draftValue: value }
        : currentSession
    )
  }, [])
  const setEditSessionOverlayOpen = React.useCallback((open: boolean) => {
    setEditSession((currentSession) =>
      currentSession && currentSession.isOverlayOpen !== open
        ? { ...currentSession, isOverlayOpen: open }
        : currentSession
    )
  }, [])
  const closeEditSession = React.useCallback(() => {
    setEditSession(null)
  }, [])

  return (
    <SingleFileFormRow
      {...props}
      editSession={editSession}
      startEditSession={startEditSession}
      updateEditSessionDraft={updateEditSessionDraft}
      setEditSessionOverlayOpen={setEditSessionOverlayOpen}
      closeEditSession={closeEditSession}
      onDocumentDataChange={onDocumentDataChange ?? vi.fn()}
    />
  )
}

function renderRow({
  isJsonEditable = true,
  onDocumentDataChange = vi.fn(),
  visiblePaths,
}: {
  isJsonEditable?: boolean
  onDocumentDataChange?: React.ComponentProps<
    typeof SingleFileFormRow
  >["onDocumentDataChange"]
  visiblePaths: string[]
}) {
  const rows = projectDocumentRows({
    document,
    visiblePaths,
    includeArrayAddRows: true,
  })

  return render(
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
          isJsonEditable={isJsonEditable}
        />
      </tbody>
    </table>
  )
}

function renderVirtualTable({
  tableDocument,
  visiblePaths,
  onUpdateDocument = vi.fn(),
  jsonEditMode = "editable",
  overscan = 12,
}: {
  tableDocument: TableDocument
  visiblePaths: string[]
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  jsonEditMode?: "editable" | "readOnly"
  overscan?: number
}) {
  const projectedRows = projectDocumentRows({
    document: tableDocument,
    visiblePaths,
    includeArrayAddRows: false,
  })

  return render(
    <SingleFileVirtualizedTable
      headerNodes={visiblePaths.map(headerNode)}
      document={tableDocument}
      schema={schema}
      setSchema={vi.fn()}
      isPublished={false}
      stopAt={[]}
      setStopAt={vi.fn()}
      draggedItemKeyRef={{ current: null }}
      draggedItemParentPathRef={{ current: null }}
      jsonEditMode={jsonEditMode}
      schemaEditMode="readOnly"
      projectedRows={projectedRows}
      visibleColumns={visiblePaths.map(visibleColumn)}
      rowCount={projectedRows.length}
      onUpdateDocument={onUpdateDocument}
      columnWidth="xxl"
      overscan={overscan}
      jumpOverscan={overscan}
    />
  )
}

function StatefulVirtualTableHarness({
  initialDocument,
  visiblePaths,
  onPatch,
}: {
  initialDocument: TableDocument
  visiblePaths: string[]
  onPatch?: (patch: Record<string, unknown>) => void
}) {
  const [tableDocument, setTableDocument] = React.useState(initialDocument)
  const projectedRows = React.useMemo(
    () =>
      projectDocumentRows({
        document: tableDocument,
        visiblePaths,
        includeArrayAddRows: false,
      }),
    [tableDocument, visiblePaths]
  )
  const onUpdateDocument = React.useCallback(
    async (patch: Record<string, unknown>) => {
      onPatch?.(patch)
      setTableDocument((currentDocument) => ({
        ...currentDocument,
        ...patch,
      }))
    },
    [onPatch]
  )

  return (
    <SingleFileVirtualizedTable
      headerNodes={visiblePaths.map(headerNode)}
      document={tableDocument}
      schema={schema}
      setSchema={vi.fn()}
      isPublished={false}
      stopAt={[]}
      setStopAt={vi.fn()}
      draggedItemKeyRef={{ current: null }}
      draggedItemParentPathRef={{ current: null }}
      jsonEditMode="editable"
      schemaEditMode="readOnly"
      projectedRows={projectedRows}
      visibleColumns={visiblePaths.map(visibleColumn)}
      rowCount={projectedRows.length}
      onUpdateDocument={onUpdateDocument}
      columnWidth="xxl"
    />
  )
}

function renderStatefulVirtualTable({
  initialDocument,
  visiblePaths,
  onPatch,
}: {
  initialDocument: TableDocument
  visiblePaths: string[]
  onPatch?: (patch: Record<string, unknown>) => void
}) {
  return render(
    <StatefulVirtualTableHarness
      initialDocument={initialDocument}
      visiblePaths={visiblePaths}
      onPatch={onPatch}
    />
  )
}

function installSynchronousAnimationFrame() {
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame
  const previousWindowRequestAnimationFrame = window.requestAnimationFrame
  const previousWindowCancelAnimationFrame = window.cancelAnimationFrame

  const requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }
  const cancelAnimationFrame = vi.fn()

  globalThis.requestAnimationFrame = requestAnimationFrame
  globalThis.cancelAnimationFrame = cancelAnimationFrame
  window.requestAnimationFrame = requestAnimationFrame
  window.cancelAnimationFrame = cancelAnimationFrame

  return () => {
    globalThis.requestAnimationFrame = previousRequestAnimationFrame
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame
    window.requestAnimationFrame = previousWindowRequestAnimationFrame
    window.cancelAnimationFrame = previousWindowCancelAnimationFrame
  }
}

async function chooseOption(
  view: ReturnType<typeof renderVirtualTable>,
  optionName: string
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

function dayButton(day: string) {
  const button = globalThis.document.querySelector<HTMLButtonElement>(
    `button[data-day="${day}"]`
  )
  if (!button) throw new Error(`Expected day button ${day}`)
  return button
}

describe("json table edit-session interactions", () => {
  it("commits a dirty text draft before switching cells", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "amount"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    const vendorInput = view.getByRole("textbox") as HTMLInputElement
    fireEvent.change(vendorInput, { target: { value: "Globex" } })

    expect(
      view.container.querySelectorAll('[data-active="true"]')
    ).toHaveLength(1)

    fireEvent.pointerDown(cellByFieldPath(view.container, "amount"), {
      button: 0,
    })

    const amountInput = view.getByRole("spinbutton") as HTMLInputElement
    expect(amountInput.value).toBe("12")
    expect(
      view.container.querySelectorAll('[data-active="true"]')
    ).toHaveLength(1)
    expect(cellByFieldPath(view.container, "amount").dataset.active).toBe(
      "true"
    )
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...document.data, vendor: "Globex" },
    })
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("commits a dirty number draft as a number before switching cells", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "amount"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "amount"), {
      button: 0,
    })
    const amountInput = view.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: "15.5" } })

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })

    expect(view.getByRole("textbox")).toBeTruthy()
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...document.data, amount: 15.5 },
    })
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("commits an invalid integer draft as null before switching cells", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["count", "vendor"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "count"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("spinbutton"), {
      target: { value: "3.5" },
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })

    expect(view.getByRole("textbox")).toBeTruthy()
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...document.data, count: null },
    })
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("commits an empty text draft as null before switching cells", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["note", "amount"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "note"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "" },
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "amount"), {
      button: 0,
    })

    expect(view.getByRole("spinbutton")).toBeTruthy()
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...document.data, note: null },
    })
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("seeds reopened cells from pending document data before parent rerender", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "amount"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "amount"), {
      button: 0,
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })

    expect(view.getByRole("textbox")).toHaveProperty("value", "Globex")
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("seeds reopened cells from committed parent data after rerender", async () => {
    const onPatch = vi.fn()
    const view = renderStatefulVirtualTable({
      initialDocument: document,
      visiblePaths: ["vendor", "amount"],
      onPatch,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "ServerCo" },
    })
    fireEvent.blur(view.getByRole("textbox"))

    await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(cellByFieldPath(view.container, "vendor").textContent).toContain(
        "ServerCo"
      )
    )

    fireEvent.pointerDown(cellByFieldPath(view.container, "amount"), {
      button: 0,
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })

    expect(view.getByRole("textbox")).toHaveProperty("value", "ServerCo")
    expect(onPatch).toHaveBeenCalledTimes(1)
  })

  it("does not commit unchanged drafts when switching cells", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "amount"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "amount"), {
      button: 0,
    })

    expect(view.getByRole("spinbutton")).toHaveProperty("value", "12")
    expect(onUpdateDocument).not.toHaveBeenCalled()
  })

  it("seeds full-table type-to-edit from printable keyboard input", async () => {
    const textView = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor"],
    })

    await waitFor(() =>
      expect(editableCells(textView.container)).toHaveLength(1)
    )

    const vendorCell = cellByFieldPath(textView.container, "vendor")
    vendorCell.focus()
    fireEvent.keyDown(vendorCell, { key: "Z" })
    expect(textView.getByRole("textbox")).toHaveProperty("value", "Z")

    cleanup()

    const numberView = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["amount"],
    })
    await waitFor(() =>
      expect(editableCells(numberView.container)).toHaveLength(1)
    )

    const amountCell = cellByFieldPath(numberView.container, "amount")
    amountCell.focus()
    fireEvent.keyDown(amountCell, { key: "8" })
    expect(numberView.getByRole("spinbutton")).toHaveProperty("value", "8")
  })

  it("keeps the full virtual table inert in read-only JSON mode", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "amount", "is_paid", "status", "shipped_at"],
      jsonEditMode: "readOnly",
      onUpdateDocument,
    })

    await waitFor(() =>
      expect(view.container.querySelectorAll("td")).toHaveLength(5)
    )

    for (const fieldPath of [
      "vendor",
      "amount",
      "is_paid",
      "status",
      "shipped_at",
    ]) {
      const cell = cellByFieldPath(view.container, fieldPath)
      fireEvent.pointerDown(cell, { button: 0 })
      fireEvent.keyDown(cell, { key: "Enter" })
      fireEvent.keyDown(cell, { key: " " })
    }

    expect(editableCells(view.container)).toHaveLength(0)
    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.queryByRole("spinbutton")).toBeNull()
    expect(view.queryByRole("combobox")).toBeNull()
    expect(view.queryByRole("dialog")).toBeNull()
    expect(onUpdateDocument).not.toHaveBeenCalled()
  })

  it("saves scalar drafts through Escape in the full virtual table", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(1))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "EscapeCo" },
    })
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Escape" })

    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: { ...document.data, vendor: "EscapeCo" },
    })
    await waitFor(() =>
      expect(cellByFieldPath(view.container, "vendor").dataset.active).toBe(
        undefined
      )
    )
  })

  it("composes a dirty draft commit with an immediate boolean toggle", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "is_paid"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "is_paid"), {
      button: 0,
    })

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(2))
    expect(onUpdateDocument).toHaveBeenNthCalledWith(1, {
      data: { ...document.data, vendor: "Globex" },
    })
    expect(onUpdateDocument).toHaveBeenNthCalledWith(2, {
      data: { ...document.data, vendor: "Globex", is_paid: true },
    })
    await waitFor(() =>
      expect(cellByFieldPath(view.container, "is_paid").dataset.active).toBe(
        undefined
      )
    )
  })

  it("composes a dirty draft commit with a later enum selection", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "status"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    fireEvent.click(cellByFieldPath(view.container, "status"), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })
    await chooseOption(view, "paid")

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(2))
    expect(onUpdateDocument).toHaveBeenNthCalledWith(1, {
      data: { ...document.data, vendor: "Globex" },
    })
    expect(onUpdateDocument).toHaveBeenNthCalledWith(2, {
      data: { ...document.data, vendor: "Globex", status: "paid" },
    })
  })

  it("opens and commits nested array enum dropdowns from a full browser click", async () => {
    const tableDocument: TableDocument = {
      id: "doc_lines",
      data: {
        lines: [{ name: "line 0", transaction_type: "CREDIT" }],
      },
    }
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument,
      visiblePaths: ["lines.*.transaction_type", "lines.*.name"],
      onUpdateDocument,
    })

    await waitFor(() =>
      expect(
        cellByFieldPath(view.container, "lines.0.transaction_type")
      ).toBeTruthy()
    )

    const cell = cellByFieldPath(view.container, "lines.0.transaction_type")
    fireEvent.click(cell, { button: 0, clientX: 0, clientY: 0, detail: 1 })

    const trigger = await view.findByRole("combobox")
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("true")
    )
    await chooseOption(view, "DEBIT")

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(1))
    expect(onUpdateDocument).toHaveBeenCalledWith({
      data: {
        lines: [{ name: "line 0", transaction_type: "DEBIT" }],
      },
    })
  })

  it("composes a dirty draft commit with a later date picker selection", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "shipped_at"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    fireEvent.pointerDown(cellByFieldPath(view.container, "shipped_at"), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })
    expect(await view.findByRole("dialog")).toBeTruthy()

    fireEvent.click(dayButton("6/15/2026"))

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(2))
    expect(onUpdateDocument).toHaveBeenNthCalledWith(1, {
      data: { ...document.data, vendor: "Globex" },
    })
    expect(onUpdateDocument).toHaveBeenNthCalledWith(2, {
      data: {
        ...document.data,
        vendor: "Globex",
        shipped_at: "2026-06-15",
      },
    })
    expect(view.queryByRole("dialog")).toBeNull()
  })

  it("removes an open picker overlay when switching cells", async () => {
    const view = renderRow({ visiblePaths: ["shipped_at", "vendor"] })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "shipped_at"), {
      button: 0,
    })

    expect(await view.findByRole("dialog")).toBeTruthy()

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })

    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull())
    expect(view.getByRole("textbox")).toBeTruthy()
  })

  it("sets tabIndex only for editable cells", async () => {
    const editableView = renderRow({ visiblePaths: ["vendor", "note"] })
    await waitFor(() =>
      expect(editableCells(editableView.container)).toHaveLength(2)
    )
    expect(
      editableCells(editableView.container).map((cell) =>
        cell.getAttribute("tabindex")
      )
    ).toEqual(["0", "0"])

    cleanup()

    const readOnlyView = renderRow({
      visiblePaths: ["vendor", "note"],
      isJsonEditable: false,
    })
    const readOnlyCells = Array.from(
      readOnlyView.container.querySelectorAll<HTMLElement>("td")
    )

    expect(readOnlyCells).toHaveLength(2)
    expect(readOnlyCells.map((cell) => cell.getAttribute("tabindex"))).toEqual([
      null,
      null,
    ])
  })

  it("ignores IME process keydown without starting or committing an edit", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(1))

    const cell = cellByFieldPath(view.container, "vendor")
    cell.focus()
    fireEvent.compositionStart(cell)
    fireEvent.keyDown(cell, { key: "Process", isComposing: true })
    fireEvent.compositionEnd(cell)

    expect(view.queryByRole("textbox")).toBeNull()
    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("composes rapid commits against the latest pending document data", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: document,
      visiblePaths: ["vendor", "amount"],
      onUpdateDocument,
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(2))

    fireEvent.pointerDown(cellByFieldPath(view.container, "vendor"), {
      button: 0,
    })
    const vendorInput = view.getByRole("textbox")
    fireEvent.change(vendorInput, { target: { value: "Globex" } })
    fireEvent.blur(vendorInput)

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(1))

    fireEvent.pointerDown(cellByFieldPath(view.container, "amount"), {
      button: 0,
    })
    const amountInput = view.getByRole("spinbutton")
    fireEvent.change(amountInput, { target: { value: "24" } })
    fireEvent.blur(amountInput)

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(2))

    expect(onUpdateDocument.mock.calls[0][0]).toEqual({
      data: { ...document.data, vendor: "Globex" },
    })
    expect(onUpdateDocument.mock.calls[1][0]).toEqual({
      data: { ...document.data, vendor: "Globex", amount: 24 },
    })
  })

  it("elevates the active virtual row while an overlay is mounted", async () => {
    const tableDocument: TableDocument = {
      id: "doc_lines",
      data: {
        lines: Array.from({ length: 20 }, (_, index) => ({
          name: `line ${index}`,
          shipped_at: "2024-01-02",
        })),
      },
    }
    const view = renderVirtualTable({
      tableDocument,
      visiblePaths: ["lines.*.shipped_at", "lines.*.name"],
      overscan: 2,
    })

    await waitFor(() =>
      expect(cellByFieldPath(view.container, "lines.0.shipped_at")).toBeTruthy()
    )

    fireEvent.pointerDown(
      cellByFieldPath(view.container, "lines.0.shipped_at"),
      { button: 0 }
    )

    expect(await view.findByRole("dialog")).toBeTruthy()
    await waitFor(() =>
      expect(rowByIndex(view.container, 0).style.zIndex).toBe("20")
    )
  })

  it("drops the elevated active row when virtualization scrolls it out", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const tableDocument: TableDocument = {
      id: "doc_lines",
      data: {
        lines: Array.from({ length: 40 }, (_, index) => ({
          name: `line ${index}`,
          shipped_at: "2024-01-02",
        })),
      },
    }
    const view = renderVirtualTable({
      tableDocument,
      visiblePaths: ["lines.*.shipped_at", "lines.*.name"],
      overscan: 1,
    })

    try {
      await waitFor(() =>
        expect(
          cellByFieldPath(view.container, "lines.0.shipped_at")
        ).toBeTruthy()
      )

      fireEvent.pointerDown(
        cellByFieldPath(view.container, "lines.0.shipped_at"),
        { button: 0 }
      )
      expect(await view.findByRole("dialog")).toBeTruthy()

      const viewport = view.container.querySelector<HTMLElement>(
        '[data-slot="json-table-scroll"]'
      )
      if (!viewport) throw new Error("Missing json table viewport")
      Object.defineProperty(viewport, "clientHeight", {
        configurable: true,
        value: 64,
      })

      await act(async () => {
        viewport.scrollTop = 32 * 12
        fireEvent.scroll(viewport)
      })

      await waitFor(() =>
        expect(view.container.querySelector('[data-index="0"]')).toBeNull()
      )
      await waitFor(() => expect(view.queryByRole("dialog")).toBeNull())
      expect(rowByIndex(view.container, 12).style.zIndex).toBe("")
    } finally {
      restoreAnimationFrame()
    }
  })
})
