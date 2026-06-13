"use client"

import * as React from "react"
import { type ReactNode } from "react"
import { Loader2, Scissors } from "lucide-react"

import { segmentsPageCount, toSegments } from "@/lib/segments"
import {
  type PdfViewerHandle,
  type PdfViewerSlots,
} from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSurface,
} from "@/components/ui/viewer"
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
  return (
    <SplitViewerProvider result={result} isProcessing={isProcessing}>
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <SplitViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <SplitViewerContent renderDocument={renderDocument} />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </SplitViewerProvider>
  )
}

type SplitViewerContextValue = {
  controller: ReturnType<typeof useSegmentViewportController>
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: ReturnType<typeof toSegments>
  slots: PdfViewerSlots
}

const SplitViewerContext = React.createContext<SplitViewerContextValue | null>(
  null
)

export function useSplitViewer() {
  const context = React.useContext(SplitViewerContext)
  if (!context) {
    throw new Error("useSplitViewer must be used within SplitViewerProvider.")
  }
  return context
}

export function SplitViewerProvider({
  result,
  isProcessing = false,
  children,
}: {
  result: SplitView | null
  isProcessing?: boolean
  children: React.ReactNode
}) {
  const hasOutput = !!result && result.output.length > 0

  const segments = React.useMemo(
    () => toSegments(result?.output ?? []),
    [result?.output]
  )
  const pageCount = React.useMemo(() => segmentsPageCount(segments), [segments])
  const controller = useSegmentViewportController({ segments })

  // The legend mounts in the document's `top` slot; the ribbon is a `left` rail.
  const slots = React.useMemo<PdfViewerSlots>(
    () => ({
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
    }),
    [
      controller.interaction,
      controller.model.currentPage,
      controller.model.scrollProgress,
      controller.navigation.scrollToPage,
      controller.navigation.scrollToSegmentStart,
      controller.rail,
      pageCount,
      segments,
    ]
  )
  const value = React.useMemo<SplitViewerContextValue>(
    () => ({
      controller,
      hasOutput,
      isProcessing,
      pageCount,
      segments,
      slots,
    }),
    [controller, hasOutput, isProcessing, pageCount, segments, slots]
  )

  return (
    <SplitViewerContext.Provider value={value}>
      {children}
    </SplitViewerContext.Provider>
  )
}

export function SplitViewerHeader() {
  const { hasOutput, isProcessing, pageCount, segments } = useSplitViewer()
  const title = hasOutput
    ? `${segments.length} segment${segments.length === 1 ? "" : "s"}`
    : isProcessing
      ? "Splitting"
      : "Split viewer"

  return (
    <ViewerHeader className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Scissors className="size-4 text-muted-foreground" />
        <span>{title}</span>
      </div>
      {hasOutput ? (
        <div className="text-xs text-muted-foreground">
          {pageCount} page{pageCount === 1 ? "" : "s"}
        </div>
      ) : null}
    </ViewerHeader>
  )
}

function SplitViewerContent({
  renderDocument,
}: {
  renderDocument?: (handlers: SplitDocumentHandlers) => ReactNode
}) {
  const { controller, hasOutput, isProcessing, slots } = useSplitViewer()

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

  return renderDocument ? (
    <>
      {renderDocument({
        ...controller.documentHandlers,
        slots,
      })}
    </>
  ) : (
    <div className="flex h-full flex-1 items-center justify-center">
      <span className="text-sm text-muted-foreground">
        No document available
      </span>
    </div>
  )
}
