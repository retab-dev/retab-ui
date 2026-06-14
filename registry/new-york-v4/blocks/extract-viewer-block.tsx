"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import { useForm } from "react-hook-form"

import type { Source } from "@/lib/document-source"
import {
  useSegmentedFieldLink,
  type SegmentedFieldAnchorLink,
} from "@/components/ui/field-anchor-link"
import {
  PdfHighlight,
  PdfViewerPages,
  PdfViewerProvider,
  type PageOverlayProps,
  type PdfDocumentSource,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { sourceFieldsToSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer"
import { JsonForm } from "@/components/json-form/json-form"
import extractSample from "@/components/viewers/sample-data/extract.json"

const PDF_URL = "/samples/jane-doe-bank-statement-5-pages.pdf"

type ExtractField = {
  key: string
  label: string
  value: string
  /** Where this value was found in the document (its source). */
  source: Source
}

// Extracted values from the bank-statement sample with true text coordinates
// (normalized pdf_bbox anchors), so each field's source highlight lands on the page.
const FIELDS = extractSample as ExtractField[]
const schema: JSONSchema7 = {
  type: "object",
  properties: Object.fromEntries(
    FIELDS.map((field) => [
      field.key,
      {
        type: "string",
        title: field.label,
      },
    ])
  ),
}
const defaultValues = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.value])
) as Record<string, unknown>
const PDF_SOURCE: PdfDocumentSource = {
  kind: "url",
  url: PDF_URL,
  fileName: "jane-doe-bank-statement-5-pages.pdf",
}
const SOURCE_FIELDS = FIELDS.map((field) => ({
  id: field.key,
  label: field.label,
  source: field.source,
}))
const SEGMENTED_DOCUMENT = sourceFieldsToSegmentedDocumentModel(SOURCE_FIELDS)

/**
 * Extract viewer block — extracted fields beside the source document, linked by
 * their sources. Hovering or selecting a field highlights where its value came
 * from in the PDF and scrolls it into view; selection persists, hover previews.
 *
 * A thin composition over the segmented-document abstraction: `JsonForm` is the
 * emitter, the segmented provider owns hover/selection and the PDF pages
 * register their document handle for navigation.
 */
export function ExtractViewerBlock() {
  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <ExtractViewerContent />
    </SegmentedDocumentProvider>
  )
}

function ExtractViewerContent() {
  const link = useSegmentedFieldLink({ initialPath: FIELDS[0]?.key })
  const segmentedViewport = useSegmentedDocumentViewport()
  const renderPageOverlay = useSegmentedPdfSourceOverlay(link)
  const setPdfViewerHandle = React.useCallback(
    (handle: PdfViewerHandle | null) => {
      segmentedViewport.documentHandlers.setDocumentHandle(handle)
    },
    [segmentedViewport.documentHandlers]
  )
  const form = useForm<Record<string, unknown>>({ defaultValues })

  return (
    <ViewerRoot bare defaultOpen className="h-full min-h-[680px] bg-background">
      <ViewerHeader className="flex min-h-10 items-center gap-2 px-2">
        <ViewerSidebarTrigger />
        <h2 className="min-w-0 truncate text-sm font-medium">Extracted data</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {FIELDS.length} fields
        </span>
      </ViewerHeader>
      <ViewerBody>
        <ViewerSurface className="relative">
          <PdfViewerProvider source={PDF_SOURCE}>
            <PdfViewerPages
              ref={setPdfViewerHandle}
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
          </PdfViewerProvider>
          <SourceIndicator path={link.activePath} found={!!link.activeAnchor} />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Extracted fields"
          side="right"
          width="240px"
          className="flex flex-shrink-0 flex-col border-l"
        >
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <JsonForm form={form} schema={schema} anchorLink={link} />
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
