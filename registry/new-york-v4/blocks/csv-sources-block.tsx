"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import { sourceToCsvCell, useCsvSourceTarget } from "@/components/ui/csv-source"
import {
  CsvViewerDocument,
  type CsvViewerHandle,
} from "@/components/ui/csv-viewer"
import {
  FileViewer,
  FileViewerBody,
  FileViewerControls,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerSidebar,
  FileViewerSurface,
  FileViewerTitle,
} from "@/components/ui/file-viewer"
import { SegmentedDocumentProvider } from "@/components/ui/segmented-document-provider"
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { createSourcesSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
import csvSample from "@/components/viewers/sample-data/csv-sources.json"

const CSV_TEXT = `region,quarter,revenue,customers,nrr
North America,Q1,1240000,48,1.12
North America,Q2,1510000,61,1.21
EMEA,Q1,820000,33,1.08
EMEA,Q2,910000,39,1.15
APAC,Q1,430000,18,1.04
APAC,Q2,560000,24,1.11`
const CSV_SOURCE = {
  kind: "text" as const,
  text: CSV_TEXT,
  fileName: "sales.csv",
}

type CsvField = SourceField & { source: Source }

const FIELDS = (csvSample as CsvField[]).map((field) => ({
  ...field,
  hint:
    field.source.anchor.kind === "csv_cell"
      ? `Cell ${field.source.anchor.coordinate ?? field.source.anchor.column}`
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
 * CSV sources block — extracted values linked to the spreadsheet cells they came
 * from. Hovering a field highlights its cell and scrolls to it. Segmented
 * source interaction owns preview/selection while the CSV source adapter owns
 * cell navigation.
 */
export function CsvSourcesBlock() {
  const viewerRef = React.useRef<CsvViewerHandle>(null)

  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <CsvSourcesContent viewerRef={viewerRef} />
    </SegmentedDocumentProvider>
  )
}

function CsvSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<CsvViewerHandle | null>
}) {
  const target = useCsvSourceTarget(viewerRef)
  const segmentedLink = useSegmentedSourceFieldLink({
    initialSourcePath: FIELDS[0]?.key,
  })
  const link = useTargetedSourceFieldLink({
    fieldByKey: FIELD_BY_KEY,
    link: segmentedLink,
    target,
  })
  const activeSource = link.activeSourcePath
    ? FIELD_BY_KEY.get(link.activeSourcePath)?.source
    : undefined
  const activeCell = sourceToCsvCell(activeSource)

  return (
    <FileViewer
      source={CSV_SOURCE}
      className="h-full min-h-[680px] bg-background"
    >
      <FileViewerHeader>
        <FileViewerTitle />
        <FileViewerMeta />
        <FileViewerControls />
      </FileViewerHeader>
      <FileViewerBody>
        <FileViewerSurface className="relative">
          <CsvViewerDocument
            ref={viewerRef}
            source={CSV_SOURCE}
            fillHeight
            className="h-full"
            controls={false}
            activeCell={activeCell}
          />
          <SourceIndicator
            path={link.activeSourcePath}
            found={!!activeSource}
            className="top-2"
          />
        </FileViewerSurface>
        <FileViewerSidebar
          aria-label="Source fields"
          side="right"
          collapsible="none"
          width="360px"
          className="border-l"
        >
          <SourceFieldList fields={FIELDS} link={link} />
        </FileViewerSidebar>
      </FileViewerBody>
    </FileViewer>
  )
}

function useTargetedSourceFieldLink({
  fieldByKey,
  link,
  target,
}: {
  fieldByKey: ReadonlyMap<string, CsvField>
  link: ReturnType<typeof useSegmentedSourceFieldLink>
  target: ReturnType<typeof useCsvSourceTarget>
}) {
  const scrollToField = React.useCallback(
    (path: string, behavior: ScrollBehavior) => {
      const source = fieldByKey.get(path)?.source
      if (source) target.scrollTo?.(source, { behavior })
    },
    [fieldByKey, target]
  )
  const onSourceHover = React.useCallback(
    (path: string | null) => {
      link.onSourceHover(path)
      if (path) scrollToField(path, "auto")
    },
    [link, scrollToField]
  )
  const selectSourcePath = React.useCallback(
    (path: string) => {
      link.selectSourcePath?.(path)
      scrollToField(path, "smooth")
    },
    [link, scrollToField]
  )

  return React.useMemo(
    () => ({
      ...link,
      onSourceHover,
      selectSourcePath,
    }),
    [link, onSourceHover, selectSourcePath]
  )
}
