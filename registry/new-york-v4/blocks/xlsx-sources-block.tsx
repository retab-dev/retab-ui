"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import { SegmentedDocumentProvider } from "@/components/ui/segmented-document-provider"
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { createSourcesSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
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
const FIELD_BY_KEY = new Map(FIELDS.map((field) => [field.key, field]))
const SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    source: field.source,
  }))
)

/**
 * Excel sources block — extracted values linked to the spreadsheet cells they
 * came from, across sheets. Hovering a field switches to its sheet, highlights
 * the cell, and scrolls to it. Segmented source interaction owns
 * preview/selection while the XLSX source adapter owns sheet-aware navigation.
 */
export function XlsxSourcesBlock() {
  const viewerRef = React.useRef<XlsxViewerHandle>(null)

  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <XlsxSourcesContent viewerRef={viewerRef} />
    </SegmentedDocumentProvider>
  )
}

function XlsxSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<XlsxViewerHandle | null>
}) {
  const target = useXlsxSourceTarget(viewerRef)
  const segmentedLink = useSegmentedSourceFieldLink({
    initialPath: FIELDS[0]?.key,
  })
  const link = useTargetedSourceFieldLink({
    fieldByKey: FIELD_BY_KEY,
    link: segmentedLink,
    target,
  })
  const activeSource = link.activePath
    ? FIELD_BY_KEY.get(link.activePath)?.source
    : undefined
  const activeCell = sourceToXlsxCell(activeSource)

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
          <SourceIndicator path={link.activePath} found={!!activeSource} />
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

function useTargetedSourceFieldLink({
  fieldByKey,
  link,
  target,
}: {
  fieldByKey: ReadonlyMap<string, XlsxField>
  link: ReturnType<typeof useSegmentedSourceFieldLink>
  target: ReturnType<typeof useXlsxSourceTarget>
}) {
  const scrollToField = React.useCallback(
    (path: string, behavior: ScrollBehavior) => {
      const source = fieldByKey.get(path)?.source
      if (source) target.scrollTo?.(source, { behavior })
    },
    [fieldByKey, target]
  )
  const onFieldHover = React.useCallback(
    (path: string | null) => {
      link.onFieldHover(path)
      if (path) scrollToField(path, "auto")
    },
    [link, scrollToField]
  )
  const selectField = React.useCallback(
    (path: string) => {
      link.selectField?.(path)
      scrollToField(path, "smooth")
    },
    [link, scrollToField]
  )

  return React.useMemo(
    () => ({
      ...link,
      onFieldHover,
      selectField,
    }),
    [link, onFieldHover, selectField]
  )
}
