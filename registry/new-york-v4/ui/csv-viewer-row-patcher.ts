"use client"

import * as React from "react"

import type { CsvCellAddress } from "./csv-viewer-state"
import {
  fixedVirtualItems,
  type FixedGridColumnItem,
  type FixedGridJumpViewportResult,
  type FixedGridViewport,
} from "./fixed-grid-virtualization"

export interface CsvRowPatchState {
  activeCell: CsvCellAddress | null
  columnItems: FixedGridColumnItem[]
  effectiveRowHeight: number
  rowOrder: number[] | null
  shouldVirtualizeRows: boolean
  sourceRows: string[][]
}

export interface CsvRowPatcher {
  patch: (viewport: FixedGridViewport) => FixedGridJumpViewportResult
  invalidate: () => void
}

interface CsvCellHandle {
  textNode: Text | null
}

interface CsvRowHandle {
  element: HTMLElement
  rowNumberTextNode: Text | null
  cells: CsvCellHandle[]
  isHidden: boolean
  sourceRowIndex: number | null
  transform: string
}

interface CsvRowHandleCache {
  rowWindow: HTMLDivElement
  rows: CsvRowHandle[]
}

const PATCH_ROW_OVERSCAN = 0
const MINIMUM_PATCH_VISIBLE_ROWS = 1
const TEXT_NODE = 3

export function useCsvRowPatcher({
  rowWindowRef,
  getState,
}: {
  rowWindowRef: React.RefObject<HTMLDivElement | null>
  getState: () => CsvRowPatchState
}): CsvRowPatcher {
  const rowHandleCacheRef = React.useRef<CsvRowHandleCache | null>(null)

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
        count: state.sourceRows.length,
        size: state.effectiveRowHeight,
        scrollOffset: viewport.scrollTop,
        viewportSize: viewport.clientHeight,
        overscan: PATCH_ROW_OVERSCAN,
        minimumVisibleCount: MINIMUM_PATCH_VISIBLE_ROWS,
      })
      if (nextRows.length === 0 || nextRows.length > cache.rows.length) {
        return "pass"
      }

      if (
        !canPatchRowHandles(
          cache.rows,
          nextRows.length,
          state.columnItems.length
        )
      ) {
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
  rowHandles: CsvRowHandle[],
  virtualRows: ReturnType<typeof fixedVirtualItems>,
  state: CsvRowPatchState
) {
  for (let handleIndex = 0; handleIndex < rowHandles.length; handleIndex++) {
    const rowHandle = rowHandles[handleIndex]
    const virtualRow = virtualRows[handleIndex]
    if (!virtualRow) {
      setRowHidden(rowHandle, true)
      continue
    }

    const displayRowIndex = virtualRow.index
    const sourceRowIndex = state.rowOrder
      ? state.rowOrder[displayRowIndex]
      : displayRowIndex
    const sourceRow = state.sourceRows[sourceRowIndex]
    const transform = `translate3d(0, ${virtualRow.start}px, 0)`

    setRowHidden(rowHandle, false)
    setRowTransform(rowHandle, transform)

    if (rowHandle.sourceRowIndex === sourceRowIndex) continue
    rowHandle.sourceRowIndex = sourceRowIndex
    setTextNodeValue(rowHandle.rowNumberTextNode, String(sourceRowIndex + 1))
    patchCells(rowHandle, sourceRow, state.columnItems)
  }
}

function patchCells(
  rowHandle: CsvRowHandle,
  sourceRow: string[] | undefined,
  columnItems: FixedGridColumnItem[]
) {
  for (let cellIndex = 0; cellIndex < columnItems.length; cellIndex++) {
    const columnIndex = columnItems[cellIndex]?.index
    const text =
      typeof columnIndex === "number" ? (sourceRow?.[columnIndex] ?? "") : ""
    setTextNodeValue(rowHandle.cells[cellIndex]?.textNode ?? null, text)
  }
}

function canPatchRows(viewport: FixedGridViewport, state: CsvRowPatchState) {
  return (
    state.shouldVirtualizeRows &&
    !state.activeCell &&
    viewport.scrollLeft === 0 &&
    !viewport.isJumpingColumns
  )
}

function canPatchRowHandles(
  rowHandles: CsvRowHandle[],
  visibleRowCount: number,
  cellCount: number
) {
  for (let handleIndex = 0; handleIndex < visibleRowCount; handleIndex++) {
    const rowHandle = rowHandles[handleIndex]
    if (!rowHandle?.rowNumberTextNode) return false
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex++) {
      if (!rowHandle.cells[cellIndex]?.textNode) return false
    }
  }
  return true
}

function readRowHandles(rowWindow: HTMLDivElement): CsvRowHandleCache {
  const rows = Array.from(
    rowWindow.querySelectorAll<HTMLElement>('[data-slot="csv-row"]')
  ).map((element) => {
    const rowNumber = element.querySelector<HTMLElement>(
      '[data-slot="csv-row-number"]'
    )
    const cells = Array.from(
      element.querySelectorAll<HTMLElement>('[data-slot="csv-cell"]')
    ).map((cell) => ({
      textNode: firstTextNode(cell.firstElementChild ?? cell),
    }))

    return {
      element,
      rowNumberTextNode: firstTextNode(rowNumber),
      cells,
      isHidden: element.hidden,
      sourceRowIndex: null,
      transform: element.style.transform,
    }
  })

  return { rowWindow, rows }
}

function firstTextNode(element: Element | null): Text | null {
  const node = element?.firstChild
  return node?.nodeType === TEXT_NODE ? (node as Text) : null
}

function setTextNodeValue(textNode: Text | null, value: string) {
  if (textNode && textNode.nodeValue !== value) textNode.nodeValue = value
}

function setRowTransform(row: CsvRowHandle, transform: string) {
  if (row.transform === transform) return
  row.element.style.transform = transform
  row.transform = transform
}

function setRowHidden(row: CsvRowHandle, isHidden: boolean) {
  if (row.isHidden === isHidden) return
  row.element.hidden = isHidden
  row.isHidden = isHidden
}
