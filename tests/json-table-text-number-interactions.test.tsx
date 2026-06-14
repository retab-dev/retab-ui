// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type {
  JsonTableCellCommit,
  JsonTableCellCommitHandler,
} from "@/components/json-table/json-table-cell-commit"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableActivationIntent,
  JsonTableActiveCell,
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import { createJsonTablePrimitiveActiveCellStore } from "@/components/json-table/json-table-primitive-active-cell-store"
import { createJsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import { jsonTableFullRenderedColumnWindow } from "@/components/json-table/json-table-rendered-column-window"
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
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
    amount: { type: "number" },
    count: { type: "integer" },
  },
}

const tableDocument: TableDocument = {
  id: "doc_1",
  data: {
    vendor: "ACME",
    note: "memo",
    amount: 12.5,
    count: 3,
  },
}

function visibleColumn(key: string): VisibleColumn {
  return {
    key,
    widthPx: 180,
    fieldMetadata: getFieldMetadata(schema, key),
  }
}

function findEditableCell(
  container: HTMLElement,
  fieldPath: string
): HTMLElement {
  const cell = container.querySelector(
    `td[data-field-path="${fieldPath}"][data-json-table-editable-cell="true"]`
  )
  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Expected editable cell for ${fieldPath}`)
  }
  return cell
}

function primitiveEventTarget(cell: HTMLElement) {
  return (
    cell.querySelector<HTMLElement>(
      '[data-slot="input-control"], [data-slot="data-cell"]'
    ) ?? cell
  )
}

function SingleFileFormRowHarness({
  onCellCommit,
  onEditSessionChange,
  visibleColumns,
  ...props
}: Omit<
  React.ComponentProps<typeof SingleFileFormRow>,
  | "renderedColumnWindow"
  | "primitiveActiveCellStore"
  | "primitiveEditStore"
  | "setPrimitiveActiveCell"
  | "structuredEditSession"
  | "startStructuredEditSession"
  | "setStructuredEditSessionOverlayOpen"
  | "closeStructuredEditSession"
  | "onCellCommit"
> & {
  visibleColumns: VisibleColumn[]
  onCellCommit?: JsonTableCellCommitHandler
  onEditSessionChange?: (activeCell: JsonTableActiveCell | null) => void
}) {
  const primitiveActiveCellStoreRef = React.useRef(
    createJsonTablePrimitiveActiveCellStore()
  )
  const primitiveEditStoreRef = React.useRef(
    createJsonTablePrimitiveEditStore()
  )
  const [structuredEditSession, setStructuredEditSessionState] =
    React.useState<JsonTableStructuredEditSession | null>(null)
  const sessionIdRef = React.useRef(0)

  const setPrimitiveActiveCell = React.useCallback(
    (activeCell: JsonTablePrimitiveActiveCell | null) => {
      primitiveActiveCellStoreRef.current.setSnapshot(activeCell)
      if (activeCell) setStructuredEditSessionState(null)
      onEditSessionChange?.(activeCell)
    },
    [onEditSessionChange]
  )

  const startStructuredEditSession = React.useCallback(
    (projectedCell: ProjectedCell, intent: JsonTableActivationIntent) => {
      const nextSessionId = sessionIdRef.current + 1
      sessionIdRef.current = nextSessionId
      const nextSession: JsonTableStructuredEditSession = {
        id: nextSessionId,
        cellId: jsonTableCellId(
          props.document.id,
          projectedCell.materializedFieldPath
        ),
        docId: props.document.id,
        fieldPath: projectedCell.materializedFieldPath,
        intent,
        isOverlayOpen: true,
      }
      primitiveActiveCellStoreRef.current.setSnapshot(null)
      setStructuredEditSessionState(nextSession)
      onEditSessionChange?.(nextSession)
    },
    [onEditSessionChange, props.document.id]
  )
  const setStructuredEditSessionOverlayOpen = React.useCallback(
    (open: boolean) => {
      setStructuredEditSessionState((currentSession) => {
        const nextSession =
          currentSession && currentSession.isOverlayOpen !== open
            ? { ...currentSession, isOverlayOpen: open }
            : currentSession
        if (nextSession !== currentSession) onEditSessionChange?.(nextSession)
        return nextSession
      })
    },
    [onEditSessionChange]
  )
  const closeStructuredEditSession = React.useCallback(() => {
    setStructuredEditSessionState(null)
    onEditSessionChange?.(primitiveActiveCellStoreRef.current.getSnapshot())
  }, [onEditSessionChange])
  const handleCellCommit = React.useCallback(
    (commit: JsonTableCellCommit) => {
      onCellCommit?.(commit)
    },
    [onCellCommit]
  )

  return (
    <SingleFileFormRow
      {...props}
      renderedColumnWindow={jsonTableFullRenderedColumnWindow(visibleColumns)}
      primitiveActiveCellStore={primitiveActiveCellStoreRef.current}
      primitiveEditStore={primitiveEditStoreRef.current}
      setPrimitiveActiveCell={setPrimitiveActiveCell}
      structuredEditSession={structuredEditSession}
      startStructuredEditSession={startStructuredEditSession}
      setStructuredEditSessionOverlayOpen={setStructuredEditSessionOverlayOpen}
      closeStructuredEditSession={closeStructuredEditSession}
      onCellCommit={handleCellCommit}
    />
  )
}

function renderInteractionRow({
  visiblePaths,
  onCellCommit = vi.fn(),
  onEditSessionChange,
}: {
  visiblePaths: string[]
  onCellCommit?: JsonTableCellCommitHandler
  onEditSessionChange?: (activeCell: JsonTableActiveCell | null) => void
}) {
  const rows = projectDocumentRows({
    document: tableDocument,
    visiblePaths,
    includeArrayAddRows: true,
  })

  return render(
    <table>
      <tbody>
        <SingleFileFormRowHarness
          document={tableDocument}
          schema={schema}
          projectedRow={rows[0]}
          visibleColumns={visiblePaths.map(visibleColumn)}
          rowIdx={0}
          rowTopPx={0}
          rowHeightPx={32}
          onCellCommit={onCellCommit}
          onEditSessionChange={onEditSessionChange}
          isJsonEditable
        />
      </tbody>
    </table>
  )
}

async function editableCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  return waitFor(() => findEditableCell(view.container, fieldPath), {
    timeout: 3000,
  })
}

async function activateCell(
  view: { container: HTMLElement },
  fieldPath: string
) {
  const cell = await editableCell(view, fieldPath)
  fireEvent.pointerDown(primitiveEventTarget(cell), {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  return cell
}

function latestSession(sessions: Array<JsonTableActiveCell | null>) {
  return sessions[sessions.length - 1]
}

describe("json table text and number interactions", () => {
  it("focuses the text input on first click without mounting it on hover", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await editableCell(view, "vendor")

    fireEvent.pointerEnter(cell)
    expect(view.queryByRole("textbox")).toBeNull()

    fireEvent.pointerDown(primitiveEventTarget(cell), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })

    const input = view.getByRole("textbox")
    expect(globalThis.document.activeElement).toBe(input)
    expect(input).toHaveProperty("value", "ACME")
  })

  it("saves text edits on blur and Enter, then cancels them on Escape", async () => {
    const onBlurChange = vi.fn()
    const blurView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit: onBlurChange,
    })
    await activateCell(blurView, "vendor")
    fireEvent.change(blurView.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    fireEvent.blur(blurView.getByRole("textbox"))
    expect(onBlurChange).toHaveBeenCalledWith({
      fieldPath: "vendor",
      value: "Globex",
      previousValue: "ACME",
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onEnterChange = vi.fn()
    const enterView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit: onEnterChange,
    })
    await activateCell(enterView, "vendor")
    fireEvent.change(enterView.getByRole("textbox"), {
      target: { value: "Initech" },
    })
    fireEvent.keyDown(enterView.getByRole("textbox"), { key: "Enter" })
    expect(onEnterChange).toHaveBeenCalledWith({
      fieldPath: "vendor",
      value: "Initech",
      previousValue: "ACME",
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onEscapeChange = vi.fn()
    const escapeView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit: onEscapeChange,
    })
    await activateCell(escapeView, "vendor")
    fireEvent.change(escapeView.getByRole("textbox"), {
      target: { value: "Umbrella" },
    })
    fireEvent.keyDown(escapeView.getByRole("textbox"), { key: "Escape" })
    expect(onEscapeChange).not.toHaveBeenCalled()
  })

  it("does not save unchanged text values", async () => {
    const onCellCommit = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onCellCommit,
    })

    await activateCell(view, "vendor")
    fireEvent.blur(view.getByRole("textbox"))

    expect(onCellCommit).not.toHaveBeenCalled()
  })

  it("commits empty text and number cells as null", async () => {
    const onTextChange = vi.fn()
    const textView = renderInteractionRow({
      visiblePaths: ["note"],
      onCellCommit: onTextChange,
    })
    await activateCell(textView, "note")
    fireEvent.change(textView.getByRole("textbox"), { target: { value: "" } })
    fireEvent.blur(textView.getByRole("textbox"))
    expect(onTextChange).toHaveBeenCalledWith({
      fieldPath: "note",
      value: null,
      previousValue: "memo",
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onNumberChange = vi.fn()
    const numberView = renderInteractionRow({
      visiblePaths: ["amount"],
      onCellCommit: onNumberChange,
    })
    await activateCell(numberView, "amount")
    fireEvent.change(numberView.getByRole("spinbutton"), {
      target: { value: "" },
    })
    fireEvent.blur(numberView.getByRole("spinbutton"))
    expect(onNumberChange).toHaveBeenCalledWith({
      fieldPath: "amount",
      value: null,
      previousValue: 12.5,
      visibleThrough: "primitivePendingValue",
    })
  })

  it("saves valid numbers and commits invalid integer drafts as null", async () => {
    const onValidNumberChange = vi.fn()
    const numberView = renderInteractionRow({
      visiblePaths: ["amount"],
      onCellCommit: onValidNumberChange,
    })
    await activateCell(numberView, "amount")
    fireEvent.change(numberView.getByRole("spinbutton"), {
      target: { value: "45.75" },
    })
    fireEvent.blur(numberView.getByRole("spinbutton"))
    expect(onValidNumberChange).toHaveBeenCalledWith({
      fieldPath: "amount",
      value: 45.75,
      previousValue: 12.5,
      visibleThrough: "primitivePendingValue",
    })
    cleanup()

    const onInvalidIntegerChange = vi.fn()
    const integerView = renderInteractionRow({
      visiblePaths: ["count"],
      onCellCommit: onInvalidIntegerChange,
    })
    await activateCell(integerView, "count")
    fireEvent.change(integerView.getByRole("spinbutton"), {
      target: { value: "3.5" },
    })
    fireEvent.blur(integerView.getByRole("spinbutton"))
    expect(onInvalidIntegerChange).toHaveBeenCalledWith({
      fieldPath: "count",
      value: null,
      previousValue: 3,
      visibleThrough: "primitivePendingValue",
    })
  })

  it("seeds text and number drafts from type-to-edit keyboard input", async () => {
    const textView = renderInteractionRow({ visiblePaths: ["vendor"] })
    const textCell = await editableCell(textView, "vendor")
    primitiveEventTarget(textCell).focus()
    fireEvent.keyDown(primitiveEventTarget(textCell), { key: "Z" })
    expect(textView.getByRole("textbox")).toHaveProperty("value", "Z")
    cleanup()

    const numberView = renderInteractionRow({ visiblePaths: ["amount"] })
    const numberCell = await editableCell(numberView, "amount")
    primitiveEventTarget(numberCell).focus()
    fireEvent.keyDown(primitiveEventTarget(numberCell), { key: "7" })
    expect(numberView.getByRole("spinbutton")).toHaveProperty("value", "7")
  })

  it("does not edit on right click", async () => {
    const sessions: Array<JsonTableActiveCell | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "amount"],
      onEditSessionChange: (session) => sessions.push(session),
    })

    fireEvent.pointerDown(
      primitiveEventTarget(await editableCell(view, "vendor")),
      { button: 2 }
    )
    fireEvent.pointerDown(
      primitiveEventTarget(await editableCell(view, "amount")),
      { button: 2 }
    )

    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.queryByRole("spinbutton")).toBeNull()
    expect(sessions).toEqual([])
  })

  it("does not reset the draft when clicking an already-active cell", async () => {
    const sessions: Array<JsonTableActiveCell | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onEditSessionChange: (session) => sessions.push(session),
    })
    const cell = await activateCell(view, "vendor")
    const startedActiveFieldPath = latestSession(sessions)?.fieldPath

    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "draft vendor" },
    })
    fireEvent.pointerDown(primitiveEventTarget(cell), {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })

    expect(view.getByRole("textbox")).toHaveProperty("value", "draft vendor")
    expect(latestSession(sessions)?.fieldPath).toBe(startedActiveFieldPath)
  })
})
