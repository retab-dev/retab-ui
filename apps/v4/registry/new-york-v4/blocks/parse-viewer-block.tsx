"use client"

import type { ParseResponse } from "@/components/viewers/lib/parse-types"
import { ParseViewer } from "@/components/viewers/parse/parse-viewer"
import { PdfViewer } from "@/components/ui/pdf-viewer"
import parseSample from "@/components/viewers/sample-data/parse.json"

const PDF_URL = "/samples/tapstone.pdf"

// A real Retab parse of tapstone.pdf (`retab parses create`, retab-large):
// per-page LLM-ready markdown with reconstructed tables.
const PARSE_RESULT: ParseResponse = {
  output: parseSample.output as ParseResponse["output"],
  usage: parseSample.usage as ParseResponse["usage"],
}

/**
 * Parse viewer block — the source document beside its extracted markdown, kept
 * in sync by page. `ParseViewer` owns the markdown pane (Rendered/Text toggle,
 * page controls); the document surface here is the `PdfViewer`. Scroll the
 * document and the markdown follows; page from the markdown and the document
 * scrolls to match.
 */
export function ParseViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <ParseViewer
        result={PARSE_RESULT}
        renderDocument={(handlers) => (
          <PdfViewer
            src={PDF_URL}
            bare
            downloadFileName="tapstone.pdf"
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  )
}
