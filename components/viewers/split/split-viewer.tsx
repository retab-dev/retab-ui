"use client"

import * as React from "react"
import { type ReactNode } from "react"
import { Loader2, Scissors } from "lucide-react"

import { segmentsPageCount, toSegments } from "@/lib/segments"
import { cn } from "@/lib/utils"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { SegmentPageRail } from "@/components/ui/segment-page-rail"
import {
  createSegmentedDocumentModel,
  type DocumentSegment,
  type SegmentedDocumentModel,
} from "@/components/ui/segmented-document-model"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import {
  type SegmentDocumentHandle,
  type SegmentViewportController,
} from "@/components/ui/use-segment-viewport-controller"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer"
import { type SplitView } from "@/components/viewers/lib/split-types"

export interface SplitDocumentHandlers {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  setDocumentHandle: (handle: SegmentDocumentHandle | null) => void
}

export interface SplitViewerProps {
  result: SplitView | null
  isProcessing?: boolean
  children?: ReactNode
}

export type SplitViewerRootProps = React.ComponentProps<typeof ViewerRoot>
export type SplitViewerBodyProps = React.ComponentProps<typeof ViewerBody>
export type SplitViewerSidebarProps = React.ComponentProps<typeof ViewerSidebar>
export type SplitViewerSurfaceProps = React.ComponentProps<typeof ViewerSurface>

export function SplitViewer({
  result,
  isProcessing = false,
  children,
}: SplitViewerProps) {
  return (
    <SplitViewerProvider result={result} isProcessing={isProcessing}>
      <SplitViewerRoot>
        <SplitViewerHeader />
        <SplitViewerBody>
          <SplitViewerSidebar />
          <SplitViewerSurface>
            <SplitViewerLegend className="border-b px-3 py-2" />
            <SplitViewerDocument>{children}</SplitViewerDocument>
          </SplitViewerSurface>
        </SplitViewerBody>
      </SplitViewerRoot>
    </SplitViewerProvider>
  )
}

type SplitViewerContextValue = {
  model: SplitViewerModel
  viewport: SegmentViewportController
}

export type SplitViewerModel = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: DocumentSegment[]
}

export type SplitViewerHeaderState = {
  hasOutput: boolean
  isProcessing: boolean
  pageCount: number
  segments: DocumentSegment[]
}

type SplitViewerBodyState = {
  hasOutput: boolean
  pageCount: number
}

export type SplitViewerPageRailState = {
  hasOutput: boolean
  pageCount: number
  segments: DocumentSegment[]
  viewport: SegmentViewportController
}

export type SplitViewerLegendState = {
  hasOutput: boolean
  segments: DocumentSegment[]
  viewport: SegmentViewportController
}

export type SplitViewerDocumentState = {
  hasOutput: boolean
  isProcessing: boolean
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

export function useSplitViewerHeader(): SplitViewerHeaderState {
  return useSplitViewer().model
}

function useSplitViewerBody(): SplitViewerBodyState {
  const { hasOutput, pageCount } = useSplitViewer().model
  return { hasOutput, pageCount }
}

export function useSplitViewerPageRail(): SplitViewerPageRailState {
  const { model, viewport } = useSplitViewer()
  return {
    hasOutput: model.hasOutput,
    pageCount: model.pageCount,
    segments: model.segments,
    viewport,
  }
}

export function useSplitViewerLegend(): SplitViewerLegendState {
  const { model, viewport } = useSplitViewer()
  return { hasOutput: model.hasOutput, segments: model.segments, viewport }
}

export function useSplitViewerDocument(): SplitViewerDocumentState {
  const { hasOutput, isProcessing } = useSplitViewer().model
  return { hasOutput, isProcessing }
}

export function useSplitViewerDocumentControls(): SplitDocumentHandlers {
  return useSplitViewer().viewport.documentHandlers
}

export function createSplitViewerModel({
  result,
  isProcessing,
}: {
  result: SplitView | null
  isProcessing: boolean
}): SplitViewerModel {
  const segments = toSegments(result?.output ?? []) satisfies DocumentSegment[]

  return {
    hasOutput: Boolean(result && result.output.length > 0),
    isProcessing,
    pageCount: segmentsPageCount(segments),
    segments,
  }
}

export function createSplitSegmentedDocumentModel(
  model: Pick<SplitViewerModel, "pageCount" | "segments">
): SegmentedDocumentModel {
  return createSegmentedDocumentModel({
    pageCount: model.pageCount,
    segments: model.segments,
  })
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
  const model = React.useMemo(
    () => createSplitViewerModel({ result, isProcessing }),
    [isProcessing, result]
  )
  const segmentedDocumentModel = React.useMemo(
    () => createSplitSegmentedDocumentModel(model),
    [model]
  )

  return (
    <SegmentedDocumentProvider model={segmentedDocumentModel}>
      <SplitViewerContextProvider model={model}>
        {children}
      </SplitViewerContextProvider>
    </SegmentedDocumentProvider>
  )
}

function SplitViewerContextProvider({
  children,
  model,
}: {
  children: React.ReactNode
  model: SplitViewerModel
}) {
  const viewport = useSegmentedDocumentViewport()

  const value = React.useMemo<SplitViewerContextValue>(
    () => ({
      model,
      viewport,
    }),
    [model, viewport]
  )

  return (
    <SplitViewerContext.Provider value={value}>
      {children}
    </SplitViewerContext.Provider>
  )
}

export function SplitViewerRoot({
  bare = true,
  className,
  defaultOpen = true,
  ...props
}: SplitViewerRootProps) {
  return (
    <ViewerRoot
      bare={bare}
      defaultOpen={defaultOpen}
      className={cn("h-full flex-1 bg-background", className)}
      {...props}
    />
  )
}

export function SplitViewerHeader() {
  const { hasOutput, isProcessing, pageCount, segments } =
    useSplitViewerHeader()
  const title = hasOutput
    ? `${segments.length} segment${segments.length === 1 ? "" : "s"}`
    : isProcessing
      ? "Splitting"
      : "Split viewer"

  return (
    <ViewerHeader className="flex flex-col">
      <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {hasOutput && pageCount > 0 ? (
            <ViewerSidebarTrigger className="-ml-1" />
          ) : null}
          <Scissors className="size-4 text-muted-foreground" />
          <span>{title}</span>
        </div>
        {hasOutput ? (
          <div className="text-xs text-muted-foreground">
            {pageCount} page{pageCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </ViewerHeader>
  )
}

export function SplitViewerBody({ className, ...props }: SplitViewerBodyProps) {
  return <ViewerBody className={className} {...props} />
}

export function SplitViewerSidebar({
  children,
  className,
  width = "4rem",
  "aria-label": ariaLabel = "Split pages",
  ...props
}: SplitViewerSidebarProps) {
  const { hasOutput, pageCount } = useSplitViewerBody()
  if (!hasOutput || pageCount <= 0) return null

  return (
    <ViewerSidebar
      aria-label={ariaLabel}
      width={width}
      className={cn("border-r bg-background", className)}
      {...props}
    >
      {children ?? <SplitViewerPageRail />}
    </ViewerSidebar>
  )
}

export function SplitViewerSurface({
  className,
  ...props
}: SplitViewerSurfaceProps) {
  return <ViewerSurface className={className} {...props} />
}

export function SplitViewerPageRail() {
  const { hasOutput, pageCount, segments, viewport } = useSplitViewerPageRail()
  if (!hasOutput || pageCount <= 0) return null

  return (
    <SegmentPageRail
      segments={segments}
      pageCount={pageCount}
      currentPage={viewport.model.currentPage}
      scrollProgress={viewport.model.scrollProgress}
      interaction={viewport.interaction}
      railApi={viewport.rail}
      onSelectPage={viewport.navigation.scrollToPage}
      showTicks
    />
  )
}

export function SplitViewerLegend({ className }: { className?: string }) {
  const { hasOutput, segments, viewport } = useSplitViewerLegend()
  if (!hasOutput) return null

  return (
    <SegmentLegend
      segments={segments}
      currentPage={viewport.model.currentPage}
      interaction={viewport.interaction}
      onSelect={viewport.navigation.scrollToSegmentStart}
      columns={4}
      variant="plain"
      showUnusedToggle
      className={className}
    />
  )
}

export function SplitViewerDocument({ children }: { children?: ReactNode }) {
  const { hasOutput, isProcessing } = useSplitViewerDocument()

  if (!hasOutput) {
    return <SplitViewerEmptyState isProcessing={isProcessing} />
  }

  return children ? (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
  ) : (
    <div className="flex h-full flex-1 items-center justify-center">
      <span className="text-sm text-muted-foreground">
        No document available
      </span>
    </div>
  )
}

export function SplitViewerEmptyState({
  isProcessing,
}: {
  isProcessing: boolean
}) {
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
