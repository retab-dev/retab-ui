"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import { useForm } from "react-hook-form"

import type { Source, SourceMap } from "@/lib/document-source"
import { useSourceLink } from "@/hooks/use-source-link"
import {
  renderPdfSourceOverlay,
  usePdfSourceTarget,
} from "@/components/ui/pdf-source"
import { PdfViewer, type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SourceIndicator } from "@/components/ui/source-indicator"
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
const SOURCES: SourceMap = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.source])
)

/**
 * Extract viewer block — extracted fields beside the source document, linked by
 * their sources. Hovering or selecting a field highlights where its value came
 * from in the PDF and scrolls it into view; selection persists, hover previews.
 *
 * A thin composition over the source-link abstraction: `JsonForm` is the
 * emitter, `useSourceLink` is the mediator, and the PDF adapter
 * (`usePdfSourceTarget` + `renderPdfSourceOverlay`) is the target.
 */
export function ExtractViewerBlock() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfSourceTarget(viewerRef)
  const link = useSourceLink({
    sources: SOURCES,
    target,
    initialField: FIELDS[0]?.key,
  })
  const form = useForm<Record<string, unknown>>({ defaultValues })

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
          renderPageOverlay={renderPdfSourceOverlay(link.activeSource)}
        />
        <SourceIndicator path={link.activePath} found={!!link.activeSource} />
      </div>
      <aside className="flex w-[240px] flex-shrink-0 flex-col border-l">
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
      </aside>
    </div>
  )
}
