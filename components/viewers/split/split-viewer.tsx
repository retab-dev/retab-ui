"use client"

import { useMemo, type ReactNode } from "react"
import { Loader2, Scissors } from "lucide-react"

import { segmentsPageCount, toSegments } from "@/lib/segments"
import {
  type PdfViewerHandle,
  type PdfViewerSlots,
} from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { type SplitView } from "@/components/viewers/lib/split-types"

import { SegmentPageRail } from "./segment-page-rail"
import { useSegmentViewportController } from "./use-segment-viewport-controller"

/**
 * Slots a document surface receives: the legend in `top`, the page ribbon as a
 * `left` rail. The surface spreads them onto its `PdfViewer`; the two are
 * independent regions, so neither disturbs the other.
 */
export interface SplitDocumentHandlers {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  setViewerHandle: (handle: PdfViewerHandle | null) => void
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
  const hasOutput = !!result && result.output.length > 0

  const segments = useMemo(
    () => toSegments(result?.output ?? []),
    [result?.output]
  )
  const pageCount = useMemo(() => segmentsPageCount(segments), [segments])
  const controller = useSegmentViewportController({ segments })

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
        currentPage={controller.model.currentPage}
        interaction={controller.interaction}
        onSelect={controller.navigation.scrollToSegmentStart}
        columns={4}
        showUnusedToggle
      />
    ),
    left:
      pageCount > 0 ? (
        <SegmentPageRail
          segments={segments}
          pageCount={pageCount}
          currentPage={controller.model.currentPage}
          scrollProgress={controller.model.scrollProgress}
          interaction={controller.interaction}
          railApi={controller.rail}
          onSelectPage={controller.navigation.scrollToPage}
          showTicks
        />
      ) : undefined,
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-background">
      {renderDocument ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {renderDocument({
            ...controller.documentHandlers,
            slots,
          })}
        </div>
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
