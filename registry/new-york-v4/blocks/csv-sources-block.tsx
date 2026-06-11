"use client"

import * as React from "react"

import type { Source, SourceMap } from "@/lib/document-source"
import { useSourceLink } from "@/hooks/use-source-link"
import { sourceToCsvCell, useCsvSourceTarget } from "@/components/ui/csv-source"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import csvSample from "@/components/viewers/sample-data/csv-sources.json"

const CSV_TEXT = `region,quarter,revenue,customers,nrr
North America,Q1,1240000,48,1.12
North America,Q2,1510000,61,1.21
EMEA,Q1,820000,33,1.08
EMEA,Q2,910000,39,1.15
APAC,Q1,430000,18,1.04
APAC,Q2,560000,24,1.11`

type CsvField = SourceField & { source: Source }

const FIELDS = (csvSample as CsvField[]).map((field) => ({
  ...field,
  hint:
    field.source.anchor.kind === "csv_cell"
      ? `Cell ${field.source.anchor.coordinate ?? field.source.anchor.column}`
      : undefined,
}))
const SOURCES: SourceMap = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.source])
)

/**
 * CSV sources block — extracted values linked to the spreadsheet cells they came
 * from. Hovering a field highlights its cell and scrolls to it. Same source-link
 * abstraction, with the CSV viewer's cell handle + the csv_cell adapter.
 */
export function CsvSourcesBlock() {
  const viewerRef = React.useRef<CsvViewerHandle>(null)
  const target = useCsvSourceTarget(viewerRef)
  const link = useSourceLink({ sources: SOURCES, target, initialField: FIELDS[0]?.key })

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="relative min-w-0 flex-1">
        <CsvViewer
          ref={viewerRef}
          value={CSV_TEXT}
          fillHeight
          className="h-full rounded-none border-0"
          activeCell={sourceToCsvCell(link.activeSource)}
        />
        <SourceIndicator
          path={link.activePath}
          found={!!link.activeSource}
          className="top-2"
        />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}
