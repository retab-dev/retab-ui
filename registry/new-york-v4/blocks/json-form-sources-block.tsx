"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import { useForm } from "react-hook-form"

import { extractionSourcesToSourceMap } from "@/lib/document-source"
import {
  useSegmentedFieldLink,
  type SegmentedFieldAnchorLink,
} from "@/components/ui/field-anchor-link"
import {
  PdfHighlight,
  PdfViewer,
  type PageOverlayProps,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import { sourceMapToEvidenceModel } from "@/components/ui/source-evidence"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { sourceMapToSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
import { JsonForm } from "@/components/json-form/json-form"
import sourcesSample from "@/components/viewers/sample-data/json-form-sources.json"

const PDF_URL = "/samples/jane-doe-bank-statement-5-pages.pdf"

// An extraction of the bank-statement sample shaped like the
// `GET /v1/extractions/{id}/sources` response: a JSON Schema, the extracted
// values, and a parallel `sources` tree (leaves `{ value, source }`).
const schema = sourcesSample.schema as JSONSchema7
const extraction = sourcesSample.extraction as Record<string, unknown>
const SOURCES = extractionSourcesToSourceMap(sourcesSample.sources)
const EVIDENCE = sourceMapToEvidenceModel({
  sourceMap: SOURCES,
  values: extraction,
  schema,
})
const SEGMENTED_DOCUMENT = sourceMapToSegmentedDocumentModel({
  labels: Object.fromEntries(
    EVIDENCE.evidenceItems.map((item) => [item.id, item.payload.label])
  ),
  sourceMap: SOURCES,
})

/**
 * JSON Form ⨯ PDF sources block — extraction rendered as a form beside the source
 * document, linked by their sources. Hovering a form field highlights where its
 * value came from in the PDF and scrolls to it.
 *
 * This is the abstraction working across components that don't know about each
 * other: `json-form` receives a field-anchor link and every field reports its
 * path on hover; the PDF adapter is the target. No bespoke wiring between form
 * and viewer.
 */
export function JsonFormSourcesBlock({
  defaultOpenPaths,
}: {
  defaultOpenPaths?: readonly string[]
} = {}) {
  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <JsonFormSourcesContent defaultOpenPaths={defaultOpenPaths} />
    </SegmentedDocumentProvider>
  )
}

function JsonFormSourcesContent({
  defaultOpenPaths,
}: {
  defaultOpenPaths?: readonly string[]
}) {
  const link = useSegmentedFieldLink()
  const segmentedViewport = useSegmentedDocumentViewport()
  const renderPageOverlay = useSegmentedPdfSourceOverlay(link)
  const setPdfViewerHandle = React.useCallback(
    (handle: PdfViewerHandle | null) => {
      segmentedViewport.documentHandlers.setDocumentHandle(handle)
    },
    [segmentedViewport.documentHandlers]
  )
  const form = useForm<Record<string, unknown>>({ defaultValues: extraction })

  return (
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
          <PdfViewer
            ref={setPdfViewerHandle}
            source={{
              kind: "url",
              url: PDF_URL,
              fileName: "jane-doe-bank-statement-5-pages.pdf",
            }}
            bare
            className="h-full"
            onScrollProgressChange={
              segmentedViewport.documentHandlers.onScrollProgressChange
            }
            onVisiblePageChange={
              segmentedViewport.documentHandlers.onCurrentPageChange
            }
            renderPageOverlay={renderPageOverlay}
          />
          <SourceIndicator path={link.activePath} found={!!link.activeAnchor} />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Extracted data sources"
          side="right"
          collapsible="none"
          width="420px"
          className="border-l"
        >
          <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
            <h2 className="text-sm font-medium">Extracted data</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Hover a field to see its source
            </span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <JsonForm
                form={form}
                schema={schema}
                anchorLink={link}
                defaultOpenPaths={defaultOpenPaths}
              />
            </div>
          </ScrollArea>
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}

function useSegmentedPdfSourceOverlay(link: SegmentedFieldAnchorLink) {
  return React.useCallback(
    ({ pageNumber }: PageOverlayProps) => {
      const anchor = link.activeAnchor
      if (!anchor?.bounds || anchor.pageNumber !== pageNumber) return null

      return (
        <PdfHighlight
          area={{
            left: anchor.bounds.x * 100,
            top: anchor.bounds.y * 100,
            width: anchor.bounds.width * 100,
            height: anchor.bounds.height * 100,
          }}
        />
      )
    },
    [link.activeAnchor]
  )
}
