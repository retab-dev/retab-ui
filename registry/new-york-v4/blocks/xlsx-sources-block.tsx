"use client"

import * as React from "react"

import type { Source, SourceMap } from "@/lib/document-source"
import { useSourceLink } from "@/hooks/use-source-link"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import {
  sourceToXlsxCell,
  useXlsxSourceTarget,
} from "@/components/ui/xlsx-source"
import { XlsxViewer, type XlsxViewerHandle } from "@/components/ui/xlsx-viewer"
import xlsxSample from "@/components/viewers/sample-data/xlsx-sources.json"

const XLSX_URL = "/samples/nvidia-financials-fy2024.xlsx"

type XlsxField = SourceField & { source: Source }

const FIELDS = (xlsxSample as XlsxField[]).map((field) => ({
  ...field,
  hint:
    field.source.anchor.kind === "spreadsheet_cell"
      ? `${field.source.anchor.sheet_name ?? `Sheet ${field.source.anchor.sheet_index + 1}`} · ${field.source.anchor.coordinate ?? ""}`
      : undefined,
}))
const SOURCES: SourceMap = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.source])
)

/**
 * Excel sources block — extracted values linked to the spreadsheet cells they
 * came from, across sheets. Hovering a field switches to its sheet, highlights
 * the cell, and scrolls to it. Same source-link abstraction, with the xlsx
 * viewer's sheet-aware cell handle + the spreadsheet_cell adapter.
 */
export function XlsxSourcesBlock() {
  const viewerRef = React.useRef<XlsxViewerHandle>(null)
  const target = useXlsxSourceTarget(viewerRef)
  const link = useSourceLink({ sources: SOURCES, target, initialField: FIELDS[0]?.key })

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="relative min-w-0 flex-1">
        <XlsxViewer
          ref={viewerRef}
          src={XLSX_URL}
          bare
          downloadFileName="nvidia-financials-fy2024.xlsx"
          className="h-full"
          activeCell={sourceToXlsxCell(link.activeSource)}
        />
        <SourceIndicator path={link.activePath} found={!!link.activeSource} />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}
