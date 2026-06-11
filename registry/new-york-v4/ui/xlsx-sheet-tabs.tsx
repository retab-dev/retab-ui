"use client"

import { cn } from "@/lib/utils"
import type { XlsxSheetMeta } from "@/lib/xlsx-workbook"

export function XlsxSheetTabs({
  sheets,
  activeSheetIndex,
  onSelectSheet,
}: {
  sheets: XlsxSheetMeta[]
  activeSheetIndex: number
  onSelectSheet: (sheetIndex: number) => void
}) {
  if (sheets.length <= 1) return null
  return (
    <div
      data-slot="xlsx-viewer-tabs"
      role="tablist"
      aria-label="Workbook sheets"
      className="flex flex-shrink-0 items-stretch gap-0.5 overflow-x-auto border-t bg-card px-1.5 py-1"
    >
      {sheets.map((sheet, sheetIndex) => (
        <button
          key={sheetIndex}
          type="button"
          role="tab"
          aria-selected={sheetIndex === activeSheetIndex}
          onClick={() => onSelectSheet(sheetIndex)}
          title={sheet.name}
          data-active={sheetIndex === activeSheetIndex}
          className={cn(
            "max-w-[10rem] flex-shrink-0 truncate rounded-md px-2.5 py-1 text-xs transition-colors",
            sheetIndex === activeSheetIndex
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60"
          )}
        >
          {sheet.name}
        </button>
      ))}
    </div>
  )
}
