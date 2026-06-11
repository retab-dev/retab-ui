"use client"

import * as React from "react"

import type { Source, SourceMap } from "@/lib/document-source"
import { useSourceLink } from "@/hooks/use-source-link"
import { PdfViewer, type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import {
  usePdfSourceTarget,
  renderPdfSourceOverlay,
} from "@/components/ui/pdf-source"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import extractSample from "@/components/viewers/sample-data/extract.json"

const PDF_URL = "/samples/bank-statement-x4uhhi7t.pdf"

type ExtractField = SourceField & {
  /** Where this value was found in the document (its source). */
  source: Source
}

// Extracted values from the bank-statement sample with true text coordinates
// (normalized pdf_bbox anchors), so each field's source highlight lands on the page.
const FIELDS: ExtractField[] = (extractSample as ExtractField[]).map(
  (field) => ({
    ...field,
    hint:
      field.source.anchor.kind === "pdf_bbox"
        ? `Page ${field.source.anchor.page}`
        : undefined,
  })
)
const SOURCES: SourceMap = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.source])
)

/**
 * Extract viewer block — extracted fields beside the source document, linked by
 * their sources. Hovering or selecting a field highlights where its value came
 * from in the PDF and scrolls it into view; selection persists, hover previews.
 *
 * A thin composition over the source-link abstraction: `SourceFieldList` is the
 * emitter, `useSourceLink` is the mediator, and the PDF adapter
 * (`usePdfSourceTarget` + `renderPdfSourceOverlay`) is the target.
 */
export function ExtractViewerBlock() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfSourceTarget(viewerRef)
  const link = useSourceLink({ sources: SOURCES, target })

  // Default the pinned field to the first one so a highlight shows on load.
  React.useEffect(() => {
    if (FIELDS[0]) link.selectField(FIELDS[0].key)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="min-w-0 flex-1">
        <PdfViewer
          ref={viewerRef}
          src={PDF_URL}
          bare
          downloadFileName="bank-statement.pdf"
          className="h-full"
          renderPageOverlay={renderPdfSourceOverlay(link.activeSource)}
        />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}
