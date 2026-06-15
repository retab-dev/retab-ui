"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import { sourceToCsvCell, useCsvSourceTarget } from "@/components/ui/csv-source"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import { SegmentedDocumentProvider } from "@/components/ui/segmented-document-provider"
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { sourceFieldsToSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
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
const FIELD_BY_KEY = new Map(FIELDS.map((field) => [field.key, field]))
const SEGMENTED_DOCUMENT = sourceFieldsToSegmentedDocumentModel(
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
  const activeCell = sourceToCsvCell(activeSource)

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
            found={!!activeSource}
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
