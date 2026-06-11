"use client"

import * as React from "react"

import {
  citationToLocation,
  sourceLocationKey,
  type SourceCitation,
} from "@/lib/document-source"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  PdfHighlight,
  PdfViewer,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import extractSample from "@/components/viewers/sample-data/extract.json"

const PDF_URL = "/samples/tapstone.pdf"

type ExtractField = {
  key: string
  label: string
  value: string
  /** Where this value was found in the document (its source). */
  citation: SourceCitation
}

// Real extracted values from tapstone.pdf with true text coordinates, so each
// field's source highlight lands exactly on the page.
const FIELDS = extractSample as ExtractField[]

/**
 * Extract viewer block — extracted fields beside the source document, linked by
 * their sources. Hovering or selecting a field highlights where its value came
 * from in the PDF and scrolls it into view; selection persists, hover previews.
 *
 * The wiring is the source-viewer contract: a field's `citation` is normalized
 * to a percentage `location` (`citationToLocation`), drawn as a `PdfHighlight`
 * inside the viewer's `renderPageOverlay`, and scrolled to via the viewer's
 * imperative `scrollToPageArea` handle.
 */
export function ExtractViewerBlock() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const [activeKey, setActiveKey] = React.useState(FIELDS[0]?.key)
  const [hoverKey, setHoverKey] = React.useState<string | null>(null)
  // Dedupe repeated scrolls to the same box (hover fires many times per field).
  const lastScrolledKey = React.useRef<string | null>(null)

  // Hover previews over the current selection (matches the source-viewer UX).
  const shownKey = hoverKey ?? activeKey
  const shownField = FIELDS.find((field) => field.key === shownKey)
  const activeLocation = shownField
    ? citationToLocation(shownField.citation)
    : undefined

  const scrollToField = React.useCallback(
    (field: ExtractField, behavior: ScrollBehavior) => {
      const location = citationToLocation(field.citation)
      if (!location) return
      const key = sourceLocationKey(location)
      if (behavior === "auto" && key === lastScrolledKey.current) return
      lastScrolledKey.current = key
      viewerRef.current?.scrollToPageArea(location.page, location.area, {
        behavior,
      })
    },
    []
  )

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="min-w-0 flex-1">
        <PdfViewer
          ref={viewerRef}
          src={PDF_URL}
          bare
          downloadFileName="tapstone.pdf"
          className="h-full"
          renderPageOverlay={({ pageNumber }) =>
            activeLocation?.page === pageNumber ? (
              <PdfHighlight area={activeLocation.area} />
            ) : null
          }
        />
      </div>
      <aside className="flex w-[360px] flex-shrink-0 flex-col border-l">
        <div className="flex h-10 flex-shrink-0 items-center border-b px-4">
          <h2 className="text-sm font-medium">Extracted fields</h2>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {FIELDS.length} fields
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 p-3">
            {FIELDS.map((field) => {
              const active = field.key === shownKey
              return (
                <button
                  key={field.key}
                  type="button"
                  onMouseEnter={() => {
                    setHoverKey(field.key)
                    scrollToField(field, "auto")
                  }}
                  onMouseLeave={() => setHoverKey(null)}
                  onFocus={() => setHoverKey(field.key)}
                  onBlur={() => setHoverKey(null)}
                  onClick={() => {
                    setActiveKey(field.key)
                    scrollToField(field, "smooth")
                  }}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted/60"
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {field.label}
                  </span>
                  <span className="text-sm tabular-nums">{field.value}</span>
                  <span className="text-[11px] text-muted-foreground/70">
                    Page {field.citation.page}
                  </span>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
