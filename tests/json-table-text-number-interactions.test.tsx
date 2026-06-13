// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableActivationIntent,
  JsonTableEditSession,
} from "@/components/json-table/json-table-edit-session"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
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

function SingleFileFormRowHarness({
  onDocumentDataChange,
  onEditSessionChange,
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
  onEditSessionChange?: (editSession: JsonTableEditSession | null) => void
}) {
  const [editSession, setEditSessionState] =
    React.useState<JsonTableEditSession | null>(null)
  const sessionIdRef = React.useRef(0)

  const setEditSession = React.useCallback(
    (
      updater:
        | JsonTableEditSession
        | null
        | ((
            currentSession: JsonTableEditSession | null
          ) => JsonTableEditSession | null)
    ) => {
      setEditSessionState((currentSession) => {
        const nextSession =
          typeof updater === "function" ? updater(currentSession) : updater
        onEditSessionChange?.(nextSession)
        return nextSession
      })
    },
    [onEditSessionChange]
  )

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
    [props.document.id, setEditSession]
  )
  const updateEditSessionDraft = React.useCallback(
    (value: unknown) => {
      setEditSession((currentSession) =>
        currentSession && !Object.is(currentSession.draftValue, value)
          ? { ...currentSession, draftValue: value }
          : currentSession
      )
    },
    [setEditSession]
  )
  const setEditSessionOverlayOpen = React.useCallback(
    (open: boolean) => {
      setEditSession((currentSession) =>
        currentSession && currentSession.isOverlayOpen !== open
          ? { ...currentSession, isOverlayOpen: open }
          : currentSession
      )
    },
    [setEditSession]
  )
  const closeEditSession = React.useCallback(() => {
    setEditSession(null)
  }, [setEditSession])

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

function renderInteractionRow({
  visiblePaths,
  onDocumentDataChange = vi.fn(),
  onEditSessionChange,
}: {
  visiblePaths: string[]
  onDocumentDataChange?: React.ComponentProps<
    typeof SingleFileFormRow
  >["onDocumentDataChange"]
  onEditSessionChange?: (editSession: JsonTableEditSession | null) => void
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
          onDocumentDataChange={onDocumentDataChange}
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
  fireEvent.pointerDown(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  return cell
}

function latestSession(sessions: Array<JsonTableEditSession | null>) {
  return sessions[sessions.length - 1]
}

describe("json table text and number interactions", () => {
  it("focuses the text input on first click without mounting it on hover", async () => {
    const view = renderInteractionRow({ visiblePaths: ["vendor"] })
    const cell = await editableCell(view, "vendor")

    fireEvent.pointerEnter(cell)
    expect(view.queryByRole("textbox")).toBeNull()

    fireEvent.pointerDown(cell, {
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
      onDocumentDataChange: onBlurChange,
    })
    await activateCell(blurView, "vendor")
    fireEvent.change(blurView.getByRole("textbox"), {
      target: { value: "Globex" },
    })
    fireEvent.blur(blurView.getByRole("textbox"))
    expect(onBlurChange).toHaveBeenCalledWith("doc_1", "vendor", "Globex")
    cleanup()

    const onEnterChange = vi.fn()
    const enterView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange: onEnterChange,
    })
    await activateCell(enterView, "vendor")
    fireEvent.change(enterView.getByRole("textbox"), {
      target: { value: "Initech" },
    })
    fireEvent.keyDown(enterView.getByRole("textbox"), { key: "Enter" })
    expect(onEnterChange).toHaveBeenCalledWith("doc_1", "vendor", "Initech")
    cleanup()

    const onEscapeChange = vi.fn()
    const escapeView = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange: onEscapeChange,
    })
    await activateCell(escapeView, "vendor")
    fireEvent.change(escapeView.getByRole("textbox"), {
      target: { value: "Umbrella" },
    })
    fireEvent.keyDown(escapeView.getByRole("textbox"), { key: "Escape" })
    expect(onEscapeChange).not.toHaveBeenCalled()
  })

  it("does not save unchanged text values", async () => {
    const onDocumentDataChange = vi.fn()
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onDocumentDataChange,
    })

    await activateCell(view, "vendor")
    fireEvent.blur(view.getByRole("textbox"))

    expect(onDocumentDataChange).not.toHaveBeenCalled()
  })

  it("commits empty text and number cells as null", async () => {
    const onTextChange = vi.fn()
    const textView = renderInteractionRow({
      visiblePaths: ["note"],
      onDocumentDataChange: onTextChange,
    })
    await activateCell(textView, "note")
    fireEvent.change(textView.getByRole("textbox"), { target: { value: "" } })
    fireEvent.blur(textView.getByRole("textbox"))
    expect(onTextChange).toHaveBeenCalledWith("doc_1", "note", null)
    cleanup()

    const onNumberChange = vi.fn()
    const numberView = renderInteractionRow({
      visiblePaths: ["amount"],
      onDocumentDataChange: onNumberChange,
    })
    await activateCell(numberView, "amount")
    fireEvent.change(numberView.getByRole("spinbutton"), {
      target: { value: "" },
    })
    fireEvent.blur(numberView.getByRole("spinbutton"))
    expect(onNumberChange).toHaveBeenCalledWith("doc_1", "amount", null)
  })

  it("saves valid numbers and commits invalid integer drafts as null", async () => {
    const onValidNumberChange = vi.fn()
    const numberView = renderInteractionRow({
      visiblePaths: ["amount"],
      onDocumentDataChange: onValidNumberChange,
    })
    await activateCell(numberView, "amount")
    fireEvent.change(numberView.getByRole("spinbutton"), {
      target: { value: "45.75" },
    })
    fireEvent.blur(numberView.getByRole("spinbutton"))
    expect(onValidNumberChange).toHaveBeenCalledWith("doc_1", "amount", 45.75)
    cleanup()

    const onInvalidIntegerChange = vi.fn()
    const integerView = renderInteractionRow({
      visiblePaths: ["count"],
      onDocumentDataChange: onInvalidIntegerChange,
    })
    await activateCell(integerView, "count")
    fireEvent.change(integerView.getByRole("spinbutton"), {
      target: { value: "3.5" },
    })
    fireEvent.blur(integerView.getByRole("spinbutton"))
    expect(onInvalidIntegerChange).toHaveBeenCalledWith("doc_1", "count", null)
  })

  it("seeds text and number drafts from type-to-edit keyboard input", async () => {
    const textView = renderInteractionRow({ visiblePaths: ["vendor"] })
    const textCell = await editableCell(textView, "vendor")
    textCell.focus()
    fireEvent.keyDown(textCell, { key: "Z" })
    expect(textView.getByRole("textbox")).toHaveProperty("value", "Z")
    cleanup()

    const numberView = renderInteractionRow({ visiblePaths: ["amount"] })
    const numberCell = await editableCell(numberView, "amount")
    numberCell.focus()
    fireEvent.keyDown(numberCell, { key: "7" })
    expect(numberView.getByRole("spinbutton")).toHaveProperty("value", "7")
  })

  it("does not edit on right click", async () => {
    const sessions: Array<JsonTableEditSession | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["vendor", "amount"],
      onEditSessionChange: (session) => sessions.push(session),
    })

    fireEvent.pointerDown(await editableCell(view, "vendor"), { button: 2 })
    fireEvent.pointerDown(await editableCell(view, "amount"), { button: 2 })

    expect(view.queryByRole("textbox")).toBeNull()
    expect(view.queryByRole("spinbutton")).toBeNull()
    expect(sessions).toEqual([])
  })

  it("does not reset the draft when clicking an already-active cell", async () => {
    const sessions: Array<JsonTableEditSession | null> = []
    const view = renderInteractionRow({
      visiblePaths: ["vendor"],
      onEditSessionChange: (session) => sessions.push(session),
    })
    const cell = await activateCell(view, "vendor")
    const startedSessionId = latestSession(sessions)?.id

    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "draft vendor" },
    })
    fireEvent.pointerDown(cell, {
      button: 0,
      clientX: 0,
      clientY: 0,
      detail: 1,
    })

    expect(view.getByRole("textbox")).toHaveProperty("value", "draft vendor")
    expect(latestSession(sessions)?.id).toBe(startedSessionId)
  })
})
