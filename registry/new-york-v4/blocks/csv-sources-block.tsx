"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import {
  AnchoredDocumentProvider,
  useAnchoredDocument,
  type AnchoredDocumentTarget,
} from "@/components/ui/anchored-document-viewer"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import { useAnchoredFieldLink } from "@/components/ui/field-anchor-link"
import { sourceFieldsToEvidenceModel } from "@/components/ui/source-evidence"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
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
const EVIDENCE = sourceFieldsToEvidenceModel(FIELDS)

/**
 * CSV sources block — extracted values linked to the spreadsheet cells they came
 * from. Hovering a field highlights its cell and scrolls to it. Same
 * anchored-document abstraction, with the CSV viewer's cell target adapter.
 */
export function CsvSourcesBlock() {
  const viewerRef = React.useRef<CsvViewerHandle>(null)
  const target = useCsvAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider
      items={EVIDENCE.anchoredItems}
      target={target}
      initialItemId={FIELDS[0]?.key}
    >
      <CsvSourcesContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function CsvSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<CsvViewerHandle | null>
}) {
  const link = useAnchoredFieldLink()
  const { activeAnchor, activeItem } = useAnchoredDocument()
  const activeCell =
    activeAnchor?.kind === "csv-cell"
      ? {
          rowIndex: activeAnchor.rowIndex,
          columnIndex: activeAnchor.columnIndex,
        }
      : null

  return (
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
          <CsvViewer
            ref={viewerRef}
            source={{ kind: "text", text: CSV_TEXT, fileName: "sales.csv" }}
            fillHeight
            className="h-full rounded-none border-0"
            activeCell={activeCell}
          />
          <SourceIndicator
            path={link.activePath}
            found={!!activeItem?.anchor}
            className="top-2"
          />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Source fields"
          side="right"
          collapsible="none"
          width="360px"
          className="border-l"
        >
          <SourceFieldList fields={FIELDS} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}

function useCsvAnchoredTarget(
  viewerRef: React.RefObject<CsvViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "csv-cell") return
        viewerRef.current?.scrollToCell(
          {
            rowIndex: anchor.rowIndex,
            columnIndex: anchor.columnIndex,
          },
          options
        )
      },
    }),
    [viewerRef]
  )
}
