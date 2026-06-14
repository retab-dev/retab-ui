"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import { useForm } from "react-hook-form"

import type { Source } from "@/lib/document-source"
import {
  AnchoredDocumentProvider,
  type AnchoredItem,
  useAnchoredDocument,
  useAnchoredFieldLink,
} from "@/components/ui/anchored-document-viewer"
import {
  sourceToPdfAnchor,
  usePdfAnchoredOverlay,
  usePdfAnchoredTarget,
} from "@/components/ui/pdf-anchor-target"
import {
  PdfViewer,
  type PdfDocumentSource,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SourceIndicator } from "@/components/ui/source-indicator"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
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
const ANCHORED_ITEMS: AnchoredItem[] = FIELDS.map((field) => ({
  id: field.key,
  anchor: sourceToPdfAnchor(field.source),
}))

/**
 * Extract viewer block — extracted fields beside the source document, linked by
 * their sources. Hovering or selecting a field highlights where its value came
 * from in the PDF and scrolls it into view; selection persists, hover previews.
 *
 * A thin composition over the anchored-document abstraction: `JsonForm` is the
 * emitter, the anchored provider owns hover/selection, and the PDF adapter is
 * the target.
 */
export function ExtractViewerBlock() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider
      items={ANCHORED_ITEMS}
      target={target}
      initialItemId={FIELDS[0]?.key}
    >
      <ExtractViewerContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function ExtractViewerContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<PdfViewerHandle | null>
}) {
  const link = useAnchoredFieldLink()
  const { activeItem } = useAnchoredDocument()
  const renderPageOverlay = usePdfAnchoredOverlay({ mode: "active" })
  const form = useForm<Record<string, unknown>>({ defaultValues })

  return (
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
          <PdfViewer
            ref={viewerRef}
            source={PDF_SOURCE}
            bare
            className="h-full"
            renderPageOverlay={renderPageOverlay}
          />
          <SourceIndicator path={link.activePath} found={!!activeItem?.anchor} />
        </ViewerSurface>
        <ViewerSidebar className="flex w-[240px] flex-shrink-0 flex-col border-l md:w-[240px]">
          <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
            <h2 className="text-sm font-medium">Extracted data</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {FIELDS.length} fields
            </span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <JsonForm form={form} schema={schema} sourceLink={link} />
            </div>
          </ScrollArea>
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}
