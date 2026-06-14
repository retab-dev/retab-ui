"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import { useForm } from "react-hook-form"

import { extractionSourcesToSourceMap } from "@/lib/document-source"
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
import { PdfViewer, type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { JsonForm } from "@/components/json-form/json-form"
import sourcesSample from "@/components/viewers/sample-data/json-form-sources.json"

const PDF_URL = "/samples/jane-doe-bank-statement-5-pages.pdf"

// An extraction of the bank-statement sample shaped like the
// `GET /v1/extractions/{id}/sources` response: a JSON Schema, the extracted
// values, and a parallel `sources` tree (leaves `{ value, source }`).
const schema = sourcesSample.schema as JSONSchema7
const extraction = sourcesSample.extraction as Record<string, unknown>
const SOURCES = extractionSourcesToSourceMap(sourcesSample.sources)
const ITEMS: AnchoredItem[] = Object.entries(SOURCES).map(([id, source]) => ({
  id,
  anchor: sourceToPdfAnchor(source),
}))

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
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={ITEMS} target={target}>
      <JsonFormSourcesContent
        defaultOpenPaths={defaultOpenPaths}
        viewerRef={viewerRef}
      />
    </AnchoredDocumentProvider>
  )
}

function JsonFormSourcesContent({
  defaultOpenPaths,
  viewerRef,
}: {
  defaultOpenPaths?: readonly string[]
  viewerRef: React.RefObject<PdfViewerHandle | null>
}) {
  const link = useAnchoredFieldLink()
  const { activeItem } = useAnchoredDocument()
  const renderPageOverlay = usePdfAnchoredOverlay({ mode: "active" })
  const form = useForm<Record<string, unknown>>({ defaultValues: extraction })

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="relative min-w-0 flex-1">
        <PdfViewer
          ref={viewerRef}
          source={{
            kind: "url",
            url: PDF_URL,
            fileName: "jane-doe-bank-statement-5-pages.pdf",
          }}
          bare
          className="h-full"
          renderPageOverlay={renderPageOverlay}
        />
        <SourceIndicator path={link.activePath} found={!!activeItem?.anchor} />
      </div>
      <aside className="flex w-[420px] flex-shrink-0 flex-col border-l">
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
      </aside>
    </div>
  )
}
