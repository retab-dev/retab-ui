"use client"

import * as React from "react"

import {
  fixedVirtualItems,
  type FixedGridJumpViewportResult,
  type FixedGridViewport,
} from "@/components/ui/fixed-grid-virtualization"
import type { VisibleColumn } from "@/components/json-table/json-table-cell-types"
import { getJsonTableCellDisplayValue } from "@/components/json-table/json-table-display-cell"
import type { ProjectedRow } from "@/components/json-table/lib/document-projection"

export interface ReadOnlyJsonRowPatchState {
  isEnabled: boolean
  projectedRows: ProjectedRow[]
  rowHeightPx: number
  visibleColumns: VisibleColumn[]
}

export interface ReadOnlyJsonRowPatcher {
  patch: (viewport: FixedGridViewport) => FixedGridJumpViewportResult
  invalidate: () => void
}

interface JsonCellHandle {
  element: HTMLElement
  textNode: Text | null
  fieldPath: string | null
}

interface JsonRowHandle {
  element: HTMLElement
  cells: JsonCellHandle[]
  isHidden: boolean
  rowIndex: number | null
  transform: string
}

interface JsonRowHandleCache {
  rowWindow: HTMLElement
  rows: JsonRowHandle[]
}

const PATCH_ROW_OVERSCAN = 0
const MINIMUM_PATCH_VISIBLE_ROWS = 1
const TEXT_NODE = 3

export function useReadOnlyJsonRowPatcher({
  rowWindowRef,
  getState,
}: {
  rowWindowRef: React.RefObject<HTMLElement | null>
  getState: () => ReadOnlyJsonRowPatchState
}): ReadOnlyJsonRowPatcher {
  const rowHandleCacheRef = React.useRef<JsonRowHandleCache | null>(null)

  const invalidate = React.useCallback(() => {
    rowHandleCacheRef.current = null
  }, [])

  const patch = React.useCallback(
    (viewport: FixedGridViewport): FixedGridJumpViewportResult => {
      const state = getState()
      if (!canPatchRows(viewport, state)) return "pass"

      const rowWindow = rowWindowRef.current
      if (!rowWindow) return "pass"

      const cache =
        rowHandleCacheRef.current?.rowWindow === rowWindow
          ? rowHandleCacheRef.current
          : readRowHandles(rowWindow)
      rowHandleCacheRef.current = cache

      if (cache.rows.length === 0) return "pass"

      const nextRows = fixedVirtualItems({
        count: state.projectedRows.length,
        size: state.rowHeightPx,
        scrollOffset: viewport.scrollTop,
        viewportSize: viewport.clientHeight,
        overscan: PATCH_ROW_OVERSCAN,
        minimumVisibleCount: MINIMUM_PATCH_VISIBLE_ROWS,
      })
      if (nextRows.length === 0 || nextRows.length > cache.rows.length) {
        return "pass"
      }

      if (!canPatchRowHandles(cache.rows, nextRows, state)) {
        return "pass"
      }

      patchRows(cache.rows, nextRows, state)

      return "handled"
    },
    [getState, rowWindowRef]
  )

  return React.useMemo(() => ({ invalidate, patch }), [invalidate, patch])
}

function patchRows(
  rowHandles: JsonRowHandle[],
  virtualRows: ReturnType<typeof fixedVirtualItems>,
  state: ReadOnlyJsonRowPatchState
) {
  for (let handleIndex = 0; handleIndex < rowHandles.length; handleIndex++) {
    const rowHandle = rowHandles[handleIndex]
    const virtualRow = virtualRows[handleIndex]
    if (!virtualRow) {
      setRowHidden(rowHandle, true)
      continue
    }

    const rowIndex = virtualRow.index
    const transform = `translate3d(0, ${virtualRow.start}px, 0)`

    setRowHidden(rowHandle, false)
    setRowTransform(rowHandle, transform)

    if (rowHandle.rowIndex === rowIndex) continue
    rowHandle.rowIndex = rowIndex
    rowHandle.element.dataset.index = String(rowIndex)
    patchCells(rowHandle, state.projectedRows[rowIndex], state.visibleColumns)
  }
}

function patchCells(
  rowHandle: JsonRowHandle,
  projectedRow: ProjectedRow | undefined,
  visibleColumns: VisibleColumn[]
) {
  for (let cellIndex = 0; cellIndex < visibleColumns.length; cellIndex++) {
    const cellHandle = rowHandle.cells[cellIndex]
    const projectedCell = projectedRow?.cells[cellIndex]
    const fieldPath = projectedCell?.materializedFieldPath ?? ""

    if (cellHandle) {
      cellHandle.element.dataset.fieldPath = fieldPath
      cellHandle.fieldPath = fieldPath
    }
    setTextNodeValue(
      cellHandle?.textNode ?? null,
      displayTextForCell(projectedCell, visibleColumns[cellIndex])
    )
  }
}

function displayTextForCell(
  projectedCell: ProjectedRow["cells"][number] | undefined,
  column: VisibleColumn | undefined
) {
  const materializedFieldPath = projectedCell?.materializedFieldPath
  const fieldMetadata = column?.fieldMetadata
  if (!materializedFieldPath || !fieldMetadata) return ""

  if (projectedCell.displayValue !== undefined) {
    return projectedCell.displayValue || emptyDisplayText(fieldMetadata.kind)
  }

  const displayValue = getJsonTableCellDisplayValue({
    fieldMetadata,
    value: projectedCell.value,
  })
  return displayValue || emptyDisplayText(fieldMetadata.kind)
}

function emptyDisplayText(kind: string) {
  return kind === "object" || kind === "array" ? "" : "—"
}

function canPatchRows(
  viewport: FixedGridViewport,
  state: ReadOnlyJsonRowPatchState
) {
  return (
    state.isEnabled &&
    state.rowHeightPx > 0 &&
    viewport.scrollLeft === 0 &&
    !viewport.isJumpingColumns
  )
}

function canPatchRowHandles(
  rowHandles: JsonRowHandle[],
  virtualRows: ReturnType<typeof fixedVirtualItems>,
  state: ReadOnlyJsonRowPatchState
) {
  for (let handleIndex = 0; handleIndex < virtualRows.length; handleIndex++) {
    const rowHandle = rowHandles[handleIndex]
    if (!rowHandle || rowHandle.cells.length !== state.visibleColumns.length) {
      return false
    }

    const projectedRow = state.projectedRows[virtualRows[handleIndex].index]
    for (let cellIndex = 0; cellIndex < state.visibleColumns.length; cellIndex++) {
      const column = state.visibleColumns[cellIndex]
      const projectedCell = projectedRow?.cells[cellIndex]
      const fieldMetadata = column?.fieldMetadata
      if (!projectedCell?.materializedFieldPath || !fieldMetadata) continue
      if (fieldMetadata.kind === "boolean") return false
      if (!rowHandle.cells[cellIndex]?.textNode) return false
    }
  }
  return true
}

function readRowHandles(rowWindow: HTMLElement): JsonRowHandleCache {
  const rows = Array.from(
    rowWindow.querySelectorAll<HTMLElement>('[data-slot="json-table-row"]')
  ).map((element) => {
    const cells = Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-slot="json-table-read-only-cell"]'
      )
    ).map((cell) => {
      const textElement = cell.querySelector<HTMLElement>(
        '[data-slot="json-table-read-only-cell-text"], [data-slot="data-cell-value"]'
      )
      return {
        element: cell,
        textNode: firstTextNode(textElement),
        fieldPath: cell.dataset.fieldPath ?? null,
      }
    })

    return {
      element,
      cells,
      isHidden: element.hidden,
      rowIndex: numericDataIndex(element),
      transform: element.style.transform,
    }
  })

  return { rowWindow, rows }
}

function firstTextNode(element: Element | null): Text | null {
  const node = element?.firstChild
  return node?.nodeType === TEXT_NODE ? (node as Text) : null
}

function numericDataIndex(element: HTMLElement): number | null {
  const value = Number(element.dataset.index)
  return Number.isInteger(value) && value >= 0 ? value : null
}

function setTextNodeValue(textNode: Text | null, value: string) {
  if (textNode && textNode.nodeValue !== value) textNode.nodeValue = value
}

function setRowTransform(row: JsonRowHandle, transform: string) {
  if (row.transform === transform) return
  row.element.style.transform = transform
  row.transform = transform
}

function setRowHidden(row: JsonRowHandle, isHidden: boolean) {
  if (row.isHidden === isHidden) return
  row.element.hidden = isHidden
  row.isHidden = isHidden
}
