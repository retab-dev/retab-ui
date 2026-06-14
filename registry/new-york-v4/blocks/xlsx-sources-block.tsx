"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import {
  AnchoredDocumentProvider,
  useAnchoredDocument,
  useAnchoredFieldLink,
  type AnchoredDocumentTarget,
  type AnchoredItem,
} from "@/components/ui/anchored-document-viewer"
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
import { xlsxAnchorToTarget } from "@/components/ui/xlsx-source"
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
const ITEMS: AnchoredItem[] = FIELDS.map((field) => {
  const target = xlsxAnchorToTarget(field.source.anchor)
  return {
    id: field.key,
    anchor: target
      ? {
          kind: "xlsx-cell",
          sheetIndex: target.sheet,
          rowIndex: target.row,
          columnIndex: target.col,
        }
      : null,
  }
})

/**
 * Excel sources block — extracted values linked to the spreadsheet cells they
 * came from, across sheets. Hovering a field switches to its sheet, highlights
 * the cell, and scrolls to it. Same anchored-document abstraction, with the xlsx
 * viewer's sheet-aware cell target adapter.
 */
export function XlsxSourcesBlock() {
  const viewerRef = React.useRef<XlsxViewerHandle>(null)
  const target = useXlsxAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider
      items={ITEMS}
      target={target}
      initialItemId={FIELDS[0]?.key}
    >
      <XlsxSourcesContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function XlsxSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<XlsxViewerHandle | null>
}) {
  const link = useAnchoredFieldLink()
  const { activeAnchor, activeItem } = useAnchoredDocument()
  const activeCell =
    activeAnchor?.kind === "xlsx-cell"
      ? {
          sheet: activeAnchor.sheetIndex,
          row: activeAnchor.rowIndex,
          col: activeAnchor.columnIndex,
        }
      : null

  return (
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
          <XlsxViewer
            ref={viewerRef}
            source={{
              kind: "url",
              url: XLSX_URL,
              fileName: "nvidia-financials-fy2024.xlsx",
            }}
            bare
            className="h-full"
            activeCell={activeCell}
          />
          <SourceIndicator
            path={link.activePath}
            found={!!activeItem?.anchor}
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

function useXlsxAnchoredTarget(
  viewerRef: React.RefObject<XlsxViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "xlsx-cell") return
        viewerRef.current?.scrollToCell(
          anchor.sheetIndex,
          anchor.rowIndex,
          anchor.columnIndex,
          options
        )
      },
    }),
    [viewerRef]
  )
}
