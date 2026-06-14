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
import { createJsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"
import { useSheetOptionsStore } from "@/components/json-table/table-options-store"
import type { RowHeight } from "@/components/json-table/table-options-store"

import {
  createTestCellCommitBridge,
  primitiveEventTarget,
} from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

type StressLine = {
  name: string
  amount: number
  status: "draft" | "paid" | "void"
  shipped_at: string
  reference: string
  category: "travel" | "office" | "meals"
  owner: string
  memo: string
  approved: boolean
  posted_at: string
  audit_code: string
  batch: string
  far_note: string
  far_status: "new" | "reviewed" | "archived"
  far_date: string
}

const stressSchema: JSONSchema7 = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          status: { type: "string", enum: ["draft", "paid", "void"] },
          shipped_at: { type: "string", format: "date" },
          reference: { type: "string" },
          category: {
            type: "string",
            enum: ["travel", "office", "meals"],
          },
          owner: { type: "string" },
          memo: { type: "string" },
          approved: { type: "boolean" },
          posted_at: { type: "string", format: "date" },
          audit_code: { type: "string" },
          batch: { type: "string" },
          far_note: { type: "string" },
          far_status: {
            type: "string",
            enum: ["new", "reviewed", "archived"],
          },
          far_date: { type: "string", format: "date" },
        },
      },
    },
  },
}

beforeAll(() => {
  installJsonTableDom()
  Object.assign(globalThis, {
    Element: window.Element,
    Node: window.Node,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useSheetOptionsStore.setState({
    rowHeight: "medium",
    columnWidth: "large",
  })
})

function linesDocument(rowCount = 64): TableDocument {
  return {
    id: "doc_lines",
    data: {
      lines: Array.from({ length: rowCount }, (_, index) =>
        expectedStressLine(index)
      ),
    },
  }
}

function expectedStressLine(index: number): StressLine {
  return {
    name: `line ${index}`,
    amount: index + 1,
    status: "draft",
    shipped_at: "2024-01-02",
    reference: `ref-${index}`,
    category: index % 2 === 0 ? "office" : "travel",
    owner: `owner-${index % 5}`,
    memo: `memo ${index}`,
    approved: index % 3 === 0,
    posted_at: "2024-01-03",
    audit_code: `audit-${index}`,
    batch: `batch-${index % 4}`,
    far_note: `far note ${index}`,
    far_status: "new",
    far_date: "2024-01-04",
  }
}

function requiredFieldMetadata(fieldPath: string): FieldMetadata {
  const fieldMetadata = getFieldMetadata(stressSchema, fieldPath)
  if (!fieldMetadata) throw new Error(`Missing field metadata for ${fieldPath}`)
  return fieldMetadata
}

function headerEffectiveType(fieldMetadata: FieldMetadata) {
  if (fieldMetadata.kind === "date-time") return "datetime"
  if (fieldMetadata.kind === "string") return "string"
  return fieldMetadata.kind
}

function headerNode(fieldPath: string): JsonTableHeaderNode {
  const fieldMetadata = requiredFieldMetadata(fieldPath)

  return {
    key: fieldPath,
    label: fieldPath,
    propName: fieldPath.split(".").at(-1) ?? fieldPath,
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

function visibleColumn(fieldPath: string): VisibleColumn {
  return {
    key: fieldPath,
    widthPx: 180,
    fieldMetadata: requiredFieldMetadata(fieldPath),
  }
}

function StressTable({
  initialDocument,
  visiblePaths,
  onPatch,
  applyPatches,
  overscan,
  jumpOverscan,
}: {
  initialDocument: TableDocument
  visiblePaths: string[]
  onPatch: (patch: Record<string, unknown>) => void
  applyPatches: boolean
  overscan: number
  jumpOverscan: number
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
  const primitiveEditStoreRef = React.useRef(
    createJsonTablePrimitiveEditStore()
  )
  const onUpdateDocument = React.useCallback(
    async (patch: Record<string, unknown>) => {
      onPatch(patch)
      if (applyPatches) {
        setTableDocument((currentDocument) => ({
          ...currentDocument,
          ...patch,
        }))
      }
    },
    [applyPatches, onPatch]
  )

  return (
    <SingleFileVirtualizedTable
      headerNodes={visiblePaths.map(headerNode)}
      document={tableDocument}
      schema={stressSchema}
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
      primitiveEditStore={primitiveEditStoreRef.current}
      {...createTestCellCommitBridge({
        documentData: tableDocument.data,
        onUpdateDocument,
        primitiveEditStore: primitiveEditStoreRef.current,
      })}
      columnWidth="xxl"
      overscan={overscan}
      jumpOverscan={jumpOverscan}
    />
  )
}

function renderStressTable({
  rowCount = 64,
  visiblePaths = [
    "lines.*.name",
    "lines.*.amount",
    "lines.*.status",
    "lines.*.shipped_at",
  ],
  applyPatches = true,
  overscan = 1,
  jumpOverscan = overscan,
  onPatch = vi.fn(),
}: {
  rowCount?: number
  visiblePaths?: string[]
  applyPatches?: boolean
  overscan?: number
  jumpOverscan?: number
  onPatch?: (patch: Record<string, unknown>) => void
} = {}) {
  return render(
    <StressTable
      initialDocument={linesDocument(rowCount)}
      visiblePaths={visiblePaths}
      onPatch={onPatch}
      applyPatches={applyPatches}
      overscan={overscan}
      jumpOverscan={jumpOverscan}
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

function viewport(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>(
    '[data-slot="json-table-scroll"]'
  )
  if (!element) throw new Error("Missing JSON table viewport")
  return element
}

function setViewportHeight(container: HTMLElement, height: number) {
  Object.defineProperty(viewport(container), "clientHeight", {
    configurable: true,
    value: height,
  })
}

function setViewportWidth(container: HTMLElement, width: number) {
  Object.defineProperty(viewport(container), "clientWidth", {
    configurable: true,
    value: width,
  })
}

async function scrollToRow(
  container: HTMLElement,
  rowIndex: number,
  rowHeightPx = 32
) {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
  await act(async () => {
    const element = viewport(container)
    const scrollTop = rowIndex * rowHeightPx
    element.scrollTop = scrollTop
    fireEvent.scroll(element, { target: { scrollTop } })
    element.dispatchEvent(new window.Event("scroll"))
  })
  await act(async () => {
    await Promise.resolve()
  })
}

async function scrollToColumn(
  container: HTMLElement,
  columnIndex: number,
  columnWidthPx = 160
) {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
  await act(async () => {
    const element = viewport(container)
    const scrollLeft = columnIndex * columnWidthPx
    element.scrollLeft = scrollLeft
    fireEvent.scroll(element, { target: { scrollLeft } })
    element.dispatchEvent(new window.Event("scroll"))
  })
  await act(async () => {
    await Promise.resolve()
  })
}

function queryCell(container: HTMLElement, fieldPath: string) {
  return container.querySelector<HTMLElement>(
    `[data-field-path="${fieldPath}"]`
  )
}

function cell(container: HTMLElement, fieldPath: string) {
  const element = queryCell(container, fieldPath)
  if (!element) throw new Error(`Missing cell ${fieldPath}`)
  return element
}

function row(container: HTMLElement, rowIndex: number) {
  const element = container.querySelector<HTMLElement>(
    `[data-index="${rowIndex}"]`
  )
  if (!element) throw new Error(`Missing row ${rowIndex}`)
  return element
}

async function waitForCell(container: HTMLElement, fieldPath: string) {
  return waitFor(() => cell(container, fieldPath), { timeout: 3000 })
}

function pointerDownCell(container: HTMLElement, fieldPath: string) {
  const element = cell(container, fieldPath)
  fireEvent.pointerDown(primitiveEventTarget(element), {
    button: 0,
    buttons: 1,
    clientX: 16,
    clientY: 16,
    detail: 1,
    pointerId: 1,
    pointerType: "mouse",
  })
  return element
}

function clickCell(container: HTMLElement, fieldPath: string) {
  const element = cell(container, fieldPath)
  fireEvent.click(primitiveEventTarget(element), {
    button: 0,
    clientX: 16,
    clientY: 16,
    detail: 1,
  })
  return element
}

function activeCells(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-active="true"]')
  )
}

function pickerPopup() {
  return document.querySelector<HTMLElement>(
    '[data-slot="data-cell-picker-popup"]'
  )
}

function stressLines(patch: Record<string, unknown>) {
  const data = patch.data as { lines?: StressLine[] } | undefined
  if (!data?.lines) throw new Error("Expected patch.data.lines")
  return data.lines
}

function expectOnlyLineChanged({
  patch,
  rowIndex,
  field,
  value,
}: {
  patch: Record<string, unknown>
  rowIndex: number
  field: keyof StressLine
  value: StressLine[keyof StressLine]
}) {
  const lines = stressLines(patch)
  expect(lines[rowIndex]?.[field]).toBe(value)
  for (const [index, line] of lines.entries()) {
    if (index === rowIndex) continue
    expect(line).toEqual(expectedStressLine(index))
  }
}

const wideVisiblePaths = [
  "lines.*.name",
  "lines.*.amount",
  "lines.*.status",
  "lines.*.shipped_at",
  "lines.*.reference",
  "lines.*.category",
  "lines.*.owner",
  "lines.*.memo",
  "lines.*.approved",
  "lines.*.posted_at",
  "lines.*.audit_code",
  "lines.*.batch",
  "lines.*.far_note",
  "lines.*.far_status",
  "lines.*.far_date",
]

async function expectNoPickerPortal() {
  await waitFor(() => expect(pickerPopup()).toBeNull())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
}

describe("json table virtualization stress hardening", () => {
  it("mounts the editable body column window for the current horizontal viewport", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const view = renderStressTable({
      rowCount: 4,
      visiblePaths: wideVisiblePaths,
      overscan: 1,
      jumpOverscan: 1,
    })

    try {
      await waitForCell(view.container, "lines.0.name")
      setViewportHeight(view.container, 64)
      setViewportWidth(view.container, 320)
      await scrollToColumn(view.container, 0)

      await waitFor(() =>
        expect(queryCell(view.container, "lines.0.far_note")).toBeNull()
      )
      expect(queryCell(view.container, "lines.0.name")).toBeTruthy()
      expect(queryCell(view.container, "lines.0.amount")).toBeTruthy()

      await scrollToColumn(view.container, 10)

      await waitForCell(view.container, "lines.0.far_note")
      expect(queryCell(view.container, "lines.0.far_status")).toBeTruthy()
      expect(queryCell(view.container, "lines.0.far_date")).toBeTruthy()
      expect(queryCell(view.container, "lines.0.name")).toBeNull()
      expect(
        view.container.querySelector<HTMLElement>(
          '[data-slot="json-table-column-spacer"]'
        )?.style.width
      ).not.toBe("0px")
    } finally {
      restoreAnimationFrame()
    }
  })

  it("edits far text, enum, and date cells after horizontal column virtualization", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const onPatch = vi.fn()
    const view = renderStressTable({
      rowCount: 4,
      visiblePaths: wideVisiblePaths,
      onPatch,
      overscan: 1,
      jumpOverscan: 1,
    })

    try {
      await waitForCell(view.container, "lines.0.name")
      setViewportHeight(view.container, 64)
      setViewportWidth(view.container, 320)
      await scrollToColumn(view.container, 10)
      await waitForCell(view.container, "lines.0.far_note")

      pointerDownCell(view.container, "lines.0.far_note")
      fireEvent.change(view.getByRole("textbox"), {
        target: { value: "edited far note" },
      })
      fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" })

      await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(1))
      expectOnlyLineChanged({
        patch: onPatch.mock.calls[0][0],
        rowIndex: 0,
        field: "far_note",
        value: "edited far note",
      })

      clickCell(view.container, "lines.0.far_status")
      expect(await view.findByRole("option", { name: "reviewed" })).toBeTruthy()

      pointerDownCell(view.container, "lines.0.far_date")
      expect(await view.findByRole("dialog")).toBeTruthy()
      expect(pickerPopup()).toBeTruthy()
    } finally {
      restoreAnimationFrame()
    }
  })

  it("preserves pending far-column primitive data across horizontal unmounts", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const onPatch = vi.fn()
    const view = renderStressTable({
      rowCount: 4,
      visiblePaths: wideVisiblePaths,
      applyPatches: false,
      onPatch,
      overscan: 1,
      jumpOverscan: 1,
    })

    try {
      await waitForCell(view.container, "lines.0.name")
      setViewportHeight(view.container, 64)
      setViewportWidth(view.container, 320)
      await scrollToColumn(view.container, 10)
      await waitForCell(view.container, "lines.0.far_note")

      pointerDownCell(view.container, "lines.0.far_note")
      fireEvent.change(view.getByRole("textbox"), {
        target: { value: "pending far note" },
      })

      await scrollToColumn(view.container, 0)
      await waitFor(() =>
        expect(queryCell(view.container, "lines.0.far_note")).toBeNull()
      )
      await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(1))

      await scrollToColumn(view.container, 10)
      await waitForCell(view.container, "lines.0.far_note")
      pointerDownCell(view.container, "lines.0.far_note")

      expect(view.getByRole("textbox")).toHaveProperty(
        "value",
        "pending far note"
      )
    } finally {
      restoreAnimationFrame()
    }
  })

  it.each([
    ["small", 24],
    ["medium", 32],
    ["xxl", 64],
  ] as const)(
    "keeps row height and low-overscan window math stable for %s rows",
    async (rowHeight: RowHeight, rowHeightPx) => {
      const restoreAnimationFrame = installSynchronousAnimationFrame()
      useSheetOptionsStore.setState({ rowHeight })
      const view = renderStressTable({
        rowCount: 20,
        visiblePaths: ["lines.*.name"],
        overscan: 1,
        jumpOverscan: 1,
      })

      try {
        await waitForCell(view.container, "lines.0.name")
        setViewportHeight(view.container, rowHeightPx * 2)

        await scrollToRow(view.container, 3, rowHeightPx)

        await waitForCell(view.container, "lines.3.name")
        expect(queryCell(view.container, "lines.0.name")).toBeNull()
        expect(row(view.container, 3).style.height).toBe(`${rowHeightPx}px`)
        expect(row(view.container, 3).style.minHeight).toBe(`${rowHeightPx}px`)
        expect(row(view.container, 3).style.transform).toBe(
          `translate3d(0, ${rowHeightPx * 3}px, 0)`
        )
      } finally {
        restoreAnimationFrame()
      }
    }
  )

  it("commits a dirty text editor when it scrolls out and does not patch the next visible row", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const onPatch = vi.fn()
    const view = renderStressTable({ applyPatches: false, onPatch })

    try {
      await waitForCell(view.container, "lines.0.name")
      setViewportHeight(view.container, 64)

      pointerDownCell(view.container, "lines.0.name")
      fireEvent.change(view.getByRole("textbox"), {
        target: { value: "dirty zero" },
      })

      await scrollToRow(view.container, 20)
      await waitForCell(view.container, "lines.20.amount")
      expect(queryCell(view.container, "lines.0.name")).toBeNull()
      expect(view.queryByRole("textbox")).toBeNull()
      expect(activeCells(view.container)).toHaveLength(0)
      await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(1))
      expectOnlyLineChanged({
        patch: onPatch.mock.calls[0][0],
        rowIndex: 0,
        field: "name",
        value: "dirty zero",
      })

      pointerDownCell(view.container, "lines.20.amount")

      expect(onPatch).toHaveBeenCalledTimes(1)
      expect(view.getByRole("spinbutton")).toHaveProperty("value", "21")
    } finally {
      restoreAnimationFrame()
    }
  })

  it("commits the previous active row before unmount and never rewrites the next active row", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const onPatch = vi.fn()
    const view = renderStressTable({
      applyPatches: false,
      onPatch,
      overscan: 2,
    })

    try {
      await waitForCell(view.container, "lines.0.name")
      setViewportHeight(view.container, 64)

      pointerDownCell(view.container, "lines.0.name")
      fireEvent.change(view.getByRole("textbox"), {
        target: { value: "alpha zero" },
      })
      pointerDownCell(view.container, "lines.1.name")

      await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(1))
      expectOnlyLineChanged({
        patch: onPatch.mock.calls[0][0],
        rowIndex: 0,
        field: "name",
        value: "alpha zero",
      })

      fireEvent.change(view.getByRole("textbox"), {
        target: { value: "beta one" },
      })
      await scrollToRow(view.container, 24)
      await waitForCell(view.container, "lines.24.name")
      pointerDownCell(view.container, "lines.24.name")

      await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(2))
      const secondLines = stressLines(onPatch.mock.calls[1][0])
      expect(secondLines[0]?.name).toBe("alpha zero")
      expect(secondLines[1]?.name).toBe("beta one")
      expect(secondLines[24]?.name).toBe("line 24")
      expect(view.getByRole("textbox")).toHaveProperty("value", "line 24")
    } finally {
      restoreAnimationFrame()
    }
  })

  it("preserves pending row data across virtual windows before parent state catches up", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const onPatch = vi.fn()
    const view = renderStressTable({ applyPatches: false, onPatch })

    try {
      await waitForCell(view.container, "lines.0.name")
      setViewportHeight(view.container, 64)

      pointerDownCell(view.container, "lines.0.name")
      fireEvent.change(view.getByRole("textbox"), {
        target: { value: "pending zero" },
      })

      await scrollToRow(view.container, 12)
      await waitForCell(view.container, "lines.12.name")
      pointerDownCell(view.container, "lines.12.name")

      await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(1))
      expect(view.getByRole("textbox")).toHaveProperty("value", "line 12")
      fireEvent.change(view.getByRole("textbox"), {
        target: { value: "pending twelve" },
      })

      await scrollToRow(view.container, 0)
      await waitForCell(view.container, "lines.0.name")
      pointerDownCell(view.container, "lines.0.name")

      await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(2))
      const latestLines = stressLines(onPatch.mock.calls[1][0])
      expect(latestLines[0]?.name).toBe("pending zero")
      expect(latestLines[12]?.name).toBe("pending twelve")
      expect(latestLines[11]?.name).toBe("line 11")
      expect(latestLines[13]?.name).toBe("line 13")
      expect(view.getByRole("textbox")).toHaveProperty("value", "pending zero")
    } finally {
      restoreAnimationFrame()
    }
  })

  it("cleans enum dropdowns when their active row scrolls out", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const onPatch = vi.fn()
    const view = renderStressTable({ onPatch })

    try {
      await waitForCell(view.container, "lines.0.status")
      setViewportHeight(view.container, 64)

      clickCell(view.container, "lines.0.status")
      const combobox = await view.findByRole("combobox")
      await waitFor(() =>
        expect(combobox.getAttribute("aria-expanded")).toBe("true")
      )
      expect(await view.findByRole("option", { name: "paid" })).toBeTruthy()

      await scrollToRow(view.container, 16)

      await waitFor(() =>
        expect(queryCell(view.container, "lines.0.status")).toBeNull()
      )
      await waitFor(() => expect(view.queryByRole("combobox")).toBeNull())
      expect(view.queryByRole("option", { name: "paid" })).toBeNull()
      expect(activeCells(view.container)).toHaveLength(0)

      pointerDownCell(view.container, "lines.16.name")
      expect(view.getByRole("textbox")).toHaveProperty("value", "line 16")
      expect(onPatch).not.toHaveBeenCalled()
    } finally {
      restoreAnimationFrame()
    }
  })

  it("cleans picker portals when their active row scrolls out", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const onPatch = vi.fn()
    const view = renderStressTable({ onPatch })

    try {
      await waitForCell(view.container, "lines.0.shipped_at")
      setViewportHeight(view.container, 64)

      pointerDownCell(view.container, "lines.0.shipped_at")
      expect(await view.findByRole("dialog")).toBeTruthy()
      expect(pickerPopup()).toBeTruthy()

      await scrollToRow(view.container, 18)

      await waitFor(() =>
        expect(queryCell(view.container, "lines.0.shipped_at")).toBeNull()
      )
      await expectNoPickerPortal()
      expect(activeCells(view.container)).toHaveLength(0)

      pointerDownCell(view.container, "lines.18.name")
      expect(view.getByRole("textbox")).toHaveProperty("value", "line 18")
      expect(onPatch).not.toHaveBeenCalled()
    } finally {
      restoreAnimationFrame()
    }
  })

  it("keeps picker open-close cycles from leaving stale portals across distant virtual rows", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const view = renderStressTable({
      visiblePaths: ["lines.*.shipped_at", "lines.*.name"],
    })

    try {
      setViewportHeight(view.container, 64)
      await waitForCell(view.container, "lines.0.shipped_at")

      for (const rowIndex of [0, 8, 16]) {
        if (rowIndex > 0) await scrollToRow(view.container, rowIndex)
        await waitForCell(view.container, `lines.${rowIndex}.shipped_at`)
        pointerDownCell(view.container, `lines.${rowIndex}.shipped_at`)
        expect(await view.findByRole("dialog")).toBeTruthy()
        expect(pickerPopup()).toBeTruthy()

        await scrollToRow(view.container, rowIndex + 4)
        await expectNoPickerPortal()
      }

      expect(
        document.querySelectorAll('[data-slot="data-cell-picker-popup"]')
      ).toHaveLength(0)
    } finally {
      restoreAnimationFrame()
    }
  })
})
