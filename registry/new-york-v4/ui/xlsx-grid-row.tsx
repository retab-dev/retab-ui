"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { XlsxCell } from "@/lib/xlsx-workbook"

export interface XlsxGridColumnItem {
  columnIndex: number
  size: number
}

export const XlsxGridRow = React.memo(function XlsxGridRow({
  rowIndex,
  getCell,
  gridTemplate,
  rowHeight,
  columnItems,
  leftPad,
  rightPad,
  start,
  activeColumnIndex,
}: {
  rowIndex: number
  getCell: (rowIndex: number, columnIndex: number) => XlsxCell
  gridTemplate: string
  rowHeight: number
  columnItems: XlsxGridColumnItem[]
  leftPad: number
  rightPad: number
  start: number
  activeColumnIndex?: number | null
}) {
  const style: React.CSSProperties = {
    gridTemplateColumns: gridTemplate,
    height: rowHeight,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: `translateY(${start}px)`,
  }
  return (
    <div
      className="group grid border-b hover:bg-muted/40"
      style={style}
      role="row"
      aria-rowindex={rowIndex + 1}
    >
      <div
        aria-hidden
        className="sticky left-0 z-[1] flex items-center justify-end border-r bg-card px-2 text-muted-foreground tabular-nums group-hover:bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))]"
      >
        {rowIndex + 1}
      </div>
      <Spacer width={leftPad} />
      {columnItems.map((item) => {
        const cell = getCell(rowIndex, item.columnIndex)
        const isActive = activeColumnIndex === item.columnIndex
        return (
          <div
            key={item.columnIndex}
            role="gridcell"
            aria-rowindex={rowIndex + 1}
            aria-colindex={item.columnIndex + 1}
            className={cn(
              "flex items-center truncate border-r px-2 last:border-r-0",
              cell.numeric ? "justify-end tabular-nums" : "justify-start",
              isActive && "bg-primary/12 ring-1 ring-primary/50 ring-inset"
            )}
            title={cell.text}
          >
            <span className="truncate">{cell.text}</span>
          </div>
        )
      })}
      <Spacer width={rightPad} />
    </div>
  )
})

export function Spacer({ width }: { width: number }) {
  return <div aria-hidden style={{ width }} />
}
