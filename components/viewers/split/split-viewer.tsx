"use client"

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { Loader2, Scissors } from "lucide-react"

import { segmentsPageCount, toSegments } from "@/lib/segments"
import { PageRibbon } from "@/components/ui/page-ribbon"
import { type PdfViewerSlots } from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"
import { type SplitView } from "@/components/viewers/lib/split-types"

/**
 * Slots a document surface receives: the legend in `top`, the page ribbon as a
 * `left` rail. The surface spreads them onto its `PdfViewer`; the two are
 * independent regions, so neither disturbs the other.
 */
export interface SplitDocumentHandlers {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  slots: PdfViewerSlots
}

export interface SplitViewerProps {
  result: SplitView | null
  isProcessing?: boolean
  renderDocument?: (handlers: SplitDocumentHandlers) => ReactNode
}

export function SplitViewer({
  result,
  isProcessing = false,
  renderDocument,
}: SplitViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [scrollProgress, setScrollProgress] = useState(0)
  const interaction = useSegmentInteraction()
  const previewRef = useRef<HTMLDivElement | null>(null)
  const hasOutput = !!result && result.output.length > 0

  const segments = useMemo(
    () => toSegments(result?.output ?? []),
    [result?.output]
  )
  const pageCount = useMemo(() => segmentsPageCount(segments), [segments])

  const handleJumpToPage = useCallback((page: number) => {
    previewRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  if (!hasOutput) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
        {isProcessing ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-warning-foreground" />
            <p className="text-center text-base text-muted-foreground">
              Splitting...
            </p>
          </>
        ) : (
          <>
            <Scissors className="h-16 w-16 text-muted-foreground" />
            <p className="text-center text-base text-muted-foreground">
              Run split to see output
            </p>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              Upload a document, define subdocuments, then click Run Split
            </p>
          </>
        )}
      </div>
    )
  }

  // The legend mounts in the document's `top` slot; the ribbon is a `left` rail.
  const slots: PdfViewerSlots = {
    top: (
      <SegmentLegend
        segments={segments}
        currentPage={currentPage}
        interaction={interaction}
        onSelect={(segment) => {
          if (segment.pages.length) handleJumpToPage(segment.pages[0])
        }}
        columns={4}
        showUnusedToggle
      />
    ),
    left:
      pageCount > 0 ? (
        <div className="h-full overflow-auto border-r border-border bg-background px-3 py-6">
          <PageRibbon
            orientation="vertical"
            rows={[{ id: "split", segments }]}
            pageCount={pageCount}
            currentPage={currentPage}
            scrollProgress={scrollProgress}
            interaction={interaction}
            onSelectPage={handleJumpToPage}
            showTicks
          />
        </div>
      ) : undefined,
  }

  return (
    <div ref={previewRef} className="flex min-h-0 flex-1 bg-background">
      {renderDocument ? (
        renderDocument({
          onCurrentPageChange: setCurrentPage,
          onScrollProgressChange: setScrollProgress,
          slots,
        })
      ) : (
        <div className="flex h-full flex-1 items-center justify-center">
          <span className="text-sm text-muted-foreground">
            No document available
          </span>
        </div>
      )}
    </div>
  )
}
