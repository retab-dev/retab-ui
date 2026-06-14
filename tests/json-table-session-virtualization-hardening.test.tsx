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
import type { JsonTableProfilerState } from "@/components/json-table/json-table-profiler"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"
import { projectDocumentRows } from "@/components/json-table/lib/document-projection"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import {
  getFieldMetadata,
  type FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata"
import { SingleFileVirtualizedTable } from "@/components/json-table/single-file-virtualized-table"

import { createTestCellCommitBridge } from "./json-table-interaction-test-utils"
import { installJsonTableDom } from "./json-table-test-dom"

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
  window.__jsonTableProfiler = undefined
})

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor: { type: "string" },
    amount: { type: "number" },
    count: { type: "integer" },
    is_paid: { type: "boolean" },
    status: { type: "string", enum: ["draft", "paid", "void"] },
    shipped_at: { type: "string", format: "date" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          is_paid: { type: "boolean" },
          status: { type: "string", enum: ["draft", "paid", "void"] },
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
    amount: 12,
    count: 3,
    is_paid: false,
    status: "draft",
    shipped_at: "2024-01-02",
  },
}

function linesDocument(rowCount = 48): TableDocument {
  return {
    id: "doc_lines",
    data: {
      lines: Array.from({ length: rowCount }, (_, index) => ({
        name: `line ${index}`,
        amount: index + 1,
        is_paid: false,
        status: "draft",
        shipped_at: "2024-01-02",
      })),
    },
  }
}

function requiredFieldMetadata(key: string): FieldMetadata {
  const fieldMetadata = getFieldMetadata(schema, key)
  if (!fieldMetadata) throw new Error(`Missing field metadata for ${key}`)
  return fieldMetadata
}

function visibleColumn(key: string): VisibleColumn {
  return {
    key,
    widthPx: 180,
    fieldMetadata: requiredFieldMetadata(key),
  }
}

function headerNode(key: string): JsonTableHeaderNode {
  const fieldMetadata = requiredFieldMetadata(key)

  return {
    key,
    label: key,
    propName: key.split(".").at(-1) ?? key,
    parentPath: "",
    rawSchema: fieldMetadata.rawSchema,
    schema: fieldMetadata.schema,
    effectiveType:
      fieldMetadata.kind === "string" ? "string" : fieldMetadata.kind,
    isObject: fieldMetadata.kind === "object",
    isArray: fieldMetadata.kind === "array",
    canFold: false,
    isExpanded: true,
  }
}

function renderVirtualTable({
  tableDocument = document,
  visiblePaths,
  jsonEditMode = "editable",
  onUpdateDocument = vi.fn(async () => undefined),
  overscan = 8,
  jumpOverscan = overscan,
}: {
  tableDocument?: TableDocument
  visiblePaths: string[]
  jsonEditMode?: "editable" | "readOnly"
  onUpdateDocument?: (patch: Record<string, unknown>) => Promise<void>
  overscan?: number
  jumpOverscan?: number
}) {
  const projectedRows = projectDocumentRows({
    document: tableDocument,
    visiblePaths,
    includeArrayAddRows: false,
  })
  const primitiveEditStore = createJsonTablePrimitiveEditStore()

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
      primitiveEditStore={primitiveEditStore}
      {...createTestCellCommitBridge({
        documentData: tableDocument.data,
        onUpdateDocument,
        primitiveEditStore,
      })}
      columnWidth="xxl"
      overscan={overscan}
      jumpOverscan={jumpOverscan}
    />
  )
}

function StatefulVirtualTable({
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
  const primitiveEditStoreRef = React.useRef(
    createJsonTablePrimitiveEditStore()
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
      primitiveEditStore={primitiveEditStoreRef.current}
      {...createTestCellCommitBridge({
        documentData: tableDocument.data,
        onUpdateDocument,
        primitiveEditStore: primitiveEditStoreRef.current,
      })}
      columnWidth="xxl"
      overscan={4}
      jumpOverscan={4}
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
    <StatefulVirtualTable
      initialDocument={initialDocument}
      visiblePaths={visiblePaths}
      onPatch={onPatch}
    />
  )
}

function installProfiler(): JsonTableProfilerState {
  const profiler: JsonTableProfilerState = {
    enabled: true,
    events: [],
    renders: {
      total: 0,
      byComponent: {},
      byInstance: {},
      changedProps: {},
    },
    snapshots: {},
  }
  window.__jsonTableProfiler = profiler
  return profiler
}

function clearProfilerEvents() {
  const profiler = window.__jsonTableProfiler
  if (!profiler) throw new Error("Missing JSON table profiler")
  profiler.events = []
  profiler.renders = {
    total: 0,
    byComponent: {},
    byInstance: {},
    changedProps: {},
  }
}

function editableCells(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-json-table-editable-cell="true"]'
    )
  )
}

function activeCells(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-active="true"]')
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

function scrollViewport(container: HTMLElement) {
  const viewport = container.querySelector<HTMLElement>(
    '[data-slot="json-table-scroll"]'
  )
  if (!viewport) throw new Error("Missing JSON table scroll viewport")
  return viewport
}

function pointerDownCell(container: HTMLElement, fieldPath: string) {
  const cell = cellByFieldPath(container, fieldPath)
  fireEvent.pointerDown(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  return cell
}

function clickCell(container: HTMLElement, fieldPath: string) {
  const cell = cellByFieldPath(container, fieldPath)
  fireEvent.click(cell, {
    button: 0,
    clientX: 0,
    clientY: 0,
    detail: 1,
  })
  return cell
}

async function waitForField(
  container: HTMLElement,
  fieldPath: string
): Promise<HTMLElement> {
  return waitFor(() => cellByFieldPath(container, fieldPath), {
    timeout: 5000,
  })
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

describe("json table session and virtualization hardening", () => {
  it("keeps one primitive active cell across cell switches", async () => {
    installProfiler()
    const view = renderVirtualTable({
      visiblePaths: ["vendor", "amount", "status"],
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(3))

    pointerDownCell(view.container, "vendor")
    expect(view.getByRole("textbox")).toHaveProperty("value", "ACME")
    expect(activeCells(view.container)).toHaveLength(1)
    expect(cellByFieldPath(view.container, "vendor").dataset.active).toBe(
      "true"
    )

    pointerDownCell(view.container, "amount")
    expect(view.getByRole("spinbutton")).toHaveProperty("value", "12")
    expect(activeCells(view.container)).toHaveLength(1)
    expect(cellByFieldPath(view.container, "amount").dataset.active).toBe(
      "true"
    )

    pointerDownCell(view.container, "vendor")
    expect(view.getByRole("textbox")).toHaveProperty("value", "ACME")
    expect(activeCells(view.container)).toHaveLength(1)
    expect(cellByFieldPath(view.container, "vendor").dataset.active).toBe(
      "true"
    )

    expect(cellByFieldPath(view.container, "amount").dataset.active).toBe(
      undefined
    )
  })

  it("opens a primitive dropdown overlay without active-cell churn", async () => {
    installProfiler()
    const view = renderVirtualTable({ visiblePaths: ["status"] })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(1))

    const statusCell = clickCell(view.container, "status")
    const combobox = await view.findByRole("combobox")
    await waitFor(() =>
      expect(combobox.getAttribute("aria-expanded")).toBe("true")
    )

    expect(statusCell.dataset.active).toBe("true")
    expect(activeCells(view.container)).toHaveLength(1)
    expect(view.getByRole("combobox").getAttribute("aria-expanded")).toBe(
      "true"
    )
  })

  it("opens a primitive dropdown without rendering sibling cells", async () => {
    const profiler = installProfiler()
    const view = renderVirtualTable({
      visiblePaths: ["vendor", "status", "amount"],
    })

    await waitFor(() => expect(editableCells(view.container)).toHaveLength(3))
    clearProfilerEvents()

    clickCell(view.container, "status")
    const combobox = await view.findByRole("combobox")
    await waitFor(() =>
      expect(combobox.getAttribute("aria-expanded")).toBe("true")
    )

    expect(
      profiler.renders.byInstance["EditableJsonTableCell:status"] ?? 0
    ).toBeGreaterThan(0)
    expect(
      profiler.renders.byInstance["EditableJsonTableCell:vendor"] ?? 0
    ).toBe(0)
    expect(
      profiler.renders.byInstance["EditableJsonTableCell:amount"] ?? 0
    ).toBe(0)
  })

  it("elevates only the active row while scalar input is focused and clears elevation on close", async () => {
    const view = renderVirtualTable({
      tableDocument: linesDocument(),
      visiblePaths: ["lines.*.name", "lines.*.amount"],
      overscan: 3,
    })

    await waitForField(view.container, "lines.0.name")

    pointerDownCell(view.container, "lines.0.name")
    const input = view.getByRole("textbox")

    await waitFor(() =>
      expect(rowByIndex(view.container, 0).style.zIndex).toBe("20")
    )
    expect(rowByIndex(view.container, 1).style.zIndex).toBe("")
    expect(activeCells(view.container)).toHaveLength(1)

    fireEvent.blur(input)

    await waitFor(() =>
      expect(rowByIndex(view.container, 0).style.zIndex).toBe("")
    )
    expect(activeCells(view.container)).toHaveLength(0)
  })

  it("elevates the overlay row, keeps unrelated rows inert, and clears when switching rows", async () => {
    const view = renderVirtualTable({
      tableDocument: linesDocument(),
      visiblePaths: ["lines.*.status", "lines.*.name"],
      overscan: 4,
    })

    await waitForField(view.container, "lines.0.status")

    clickCell(view.container, "lines.0.status")
    const combobox = await view.findByRole("combobox")
    await waitFor(() =>
      expect(combobox.getAttribute("aria-expanded")).toBe("true")
    )
    await waitFor(() =>
      expect(rowByIndex(view.container, 0).style.zIndex).toBe("20")
    )
    expect(rowByIndex(view.container, 1).style.zIndex).toBe("")
    expect(
      cellByFieldPath(view.container, "lines.1.status").dataset.active
    ).toBe(undefined)

    pointerDownCell(view.container, "lines.1.name")

    expect(view.getByRole("textbox")).toHaveProperty("value", "line 1")
    await waitFor(() =>
      expect(rowByIndex(view.container, 0).style.zIndex).toBe("")
    )
    expect(rowByIndex(view.container, 1).style.zIndex).toBe("20")
    expect(activeCells(view.container)).toHaveLength(1)
    expect(cellByFieldPath(view.container, "lines.1.name").dataset.active).toBe(
      "true"
    )
  })

  it("removes active controls and row elevation when virtualization unmounts the active row", async () => {
    const restoreAnimationFrame = installSynchronousAnimationFrame()
    const view = renderVirtualTable({
      tableDocument: linesDocument(80),
      visiblePaths: ["lines.*.name", "lines.*.shipped_at"],
      overscan: 1,
      jumpOverscan: 1,
    })

    try {
      await waitForField(view.container, "lines.0.name")

      pointerDownCell(view.container, "lines.0.name")
      expect(view.getByRole("textbox")).toHaveProperty("value", "line 0")
      await waitFor(() =>
        expect(rowByIndex(view.container, 0).style.zIndex).toBe("20")
      )

      const viewport = scrollViewport(view.container)
      Object.defineProperty(viewport, "clientHeight", {
        configurable: true,
        value: 64,
      })

      await act(async () => {
        viewport.scrollTop = 32 * 24
        fireEvent.scroll(viewport)
      })

      await waitFor(() =>
        expect(view.container.querySelector('[data-index="0"]')).toBeNull()
      )
      expect(view.queryByRole("textbox")).toBeNull()
      expect(activeCells(view.container)).toHaveLength(0)
      expect(rowByIndex(view.container, 24).style.zIndex).toBe("")
    } finally {
      restoreAnimationFrame()
    }
  })

  it("composes rapid row commits from the latest pending document data", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const baseDocument = linesDocument(3)
    const view = renderVirtualTable({
      tableDocument: baseDocument,
      visiblePaths: ["lines.*.name", "lines.*.amount"],
      onUpdateDocument,
    })

    await waitForField(view.container, "lines.0.name")

    pointerDownCell(view.container, "lines.0.name")
    const firstInput = view.getByRole("textbox")
    fireEvent.change(firstInput, { target: { value: "alpha" } })
    fireEvent.blur(firstInput)

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(1))

    pointerDownCell(view.container, "lines.1.amount")
    const secondInput = view.getByRole("spinbutton")
    fireEvent.change(secondInput, { target: { value: "99" } })
    fireEvent.blur(secondInput)

    await waitFor(() => expect(onUpdateDocument).toHaveBeenCalledTimes(2))

    expect(onUpdateDocument.mock.calls[0][0]).toEqual({
      data: {
        lines: [
          {
            name: "alpha",
            amount: 1,
            is_paid: false,
            status: "draft",
            shipped_at: "2024-01-02",
          },
          {
            name: "line 1",
            amount: 2,
            is_paid: false,
            status: "draft",
            shipped_at: "2024-01-02",
          },
          {
            name: "line 2",
            amount: 3,
            is_paid: false,
            status: "draft",
            shipped_at: "2024-01-02",
          },
        ],
      },
    })
    expect(onUpdateDocument.mock.calls[1][0]).toEqual({
      data: {
        lines: [
          {
            name: "alpha",
            amount: 1,
            is_paid: false,
            status: "draft",
            shipped_at: "2024-01-02",
          },
          {
            name: "line 1",
            amount: 99,
            is_paid: false,
            status: "draft",
            shipped_at: "2024-01-02",
          },
          {
            name: "line 2",
            amount: 3,
            is_paid: false,
            status: "draft",
            shipped_at: "2024-01-02",
          },
        ],
      },
    })
  })

  it("seeds switched rows from pending data before parent state catches up", async () => {
    const onUpdateDocument = vi.fn<
      (patch: Record<string, unknown>) => Promise<void>
    >(async () => undefined)
    const view = renderVirtualTable({
      tableDocument: linesDocument(3),
      visiblePaths: ["lines.*.name", "lines.*.amount"],
      onUpdateDocument,
    })

    await waitForField(view.container, "lines.0.name")

    pointerDownCell(view.container, "lines.0.name")
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "pending zero" },
    })
    pointerDownCell(view.container, "lines.1.amount")
    pointerDownCell(view.container, "lines.0.name")

    expect(view.getByRole("textbox")).toHaveProperty("value", "pending zero")
    expect(activeCells(view.container)).toHaveLength(1)
    expect(onUpdateDocument).toHaveBeenCalledTimes(1)
  })

  it("seeds reopened rows from committed parent data after rerender", async () => {
    const onPatch = vi.fn()
    const view = renderStatefulVirtualTable({
      initialDocument: linesDocument(3),
      visiblePaths: ["lines.*.name", "lines.*.amount"],
      onPatch,
    })

    await waitForField(view.container, "lines.0.name")

    pointerDownCell(view.container, "lines.0.name")
    const input = view.getByRole("textbox")
    fireEvent.change(input, { target: { value: "server zero" } })
    fireEvent.blur(input)

    await waitFor(() => expect(onPatch).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        cellByFieldPath(view.container, "lines.0.name").textContent
      ).toContain("server zero")
    )

    pointerDownCell(view.container, "lines.1.amount")
    pointerDownCell(view.container, "lines.0.name")

    expect(view.getByRole("textbox")).toHaveProperty("value", "server zero")
    expect(onPatch).toHaveBeenCalledTimes(1)
  })

  it("keeps editable tab stops and read-only cells sharply separated", async () => {
    const editableView = renderVirtualTable({
      visiblePaths: ["vendor", "amount", "is_paid", "status", "shipped_at"],
    })

    await waitFor(() =>
      expect(editableCells(editableView.container)).toHaveLength(5)
    )
    expect(
      editableCells(editableView.container).map((cell) =>
        cell.getAttribute("tabindex")
      )
    ).toEqual(["0", "0", "0", "0", "0"])

    cleanup()

    const readOnlyView = renderVirtualTable({
      visiblePaths: ["vendor", "amount", "is_paid", "status", "shipped_at"],
      jsonEditMode: "readOnly",
    })

    await waitFor(() =>
      expect(readOnlyView.container.querySelectorAll("td")).toHaveLength(5)
    )
    const readOnlyCells = Array.from(
      readOnlyView.container.querySelectorAll<HTMLElement>("td")
    )
    expect(editableCells(readOnlyView.container)).toHaveLength(0)
    expect(readOnlyCells.map((cell) => cell.getAttribute("tabindex"))).toEqual([
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it("honors keyboard activation boundaries without editing from navigation or platform shortcuts", async () => {
    const ignoredKeys = [
      { key: "Tab" },
      { key: "Escape" },
      { key: "ArrowDown" },
      { key: "c", metaKey: true },
      { key: "c", ctrlKey: true },
      { key: "e", altKey: true },
    ]

    for (const keyboardEvent of ignoredKeys) {
      const view = renderVirtualTable({ visiblePaths: ["vendor"] })
      await waitForField(view.container, "vendor")
      const cell = cellByFieldPath(view.container, "vendor")

      cell.focus()
      fireEvent.keyDown(cell, keyboardEvent)

      expect(view.queryByRole("textbox")).toBeNull()
      expect(activeCells(view.container)).toHaveLength(0)
      cleanup()
    }

    for (const key of ["Enter", "F2", "A"]) {
      const view = renderVirtualTable({ visiblePaths: ["vendor"] })
      await waitForField(view.container, "vendor")
      const cell = cellByFieldPath(view.container, "vendor")

      cell.focus()
      fireEvent.keyDown(cell, { key })

      expect(view.getByRole("textbox")).toBeTruthy()
      expect(activeCells(view.container)).toHaveLength(1)
      cleanup()
    }

    const booleanView = renderVirtualTable({ visiblePaths: ["is_paid"] })
    await waitForField(booleanView.container, "is_paid")
    const booleanCell = cellByFieldPath(booleanView.container, "is_paid")
    booleanCell.focus()
    fireEvent.keyDown(booleanCell, { key: " " })
    await waitFor(() =>
      expect(activeCells(booleanView.container)).toHaveLength(0)
    )
  })

  it("does not mount active controls or activate cells for unrelated mounted rows", async () => {
    installProfiler()
    const view = renderVirtualTable({
      tableDocument: linesDocument(12),
      visiblePaths: ["lines.*.name", "lines.*.amount"],
      overscan: 6,
    })

    await waitForField(view.container, "lines.0.name")
    await waitForField(view.container, "lines.5.name")
    clearProfilerEvents()

    pointerDownCell(view.container, "lines.0.name")
    expect(view.getByRole("textbox")).toHaveProperty("value", "line 0")

    expect(activeCells(view.container)).toHaveLength(1)
    expect(cellByFieldPath(view.container, "lines.1.name").dataset.active).toBe(
      undefined
    )
    expect(cellByFieldPath(view.container, "lines.5.name").dataset.active).toBe(
      undefined
    )
  })
})
