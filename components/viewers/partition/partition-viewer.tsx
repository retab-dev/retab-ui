"use client"

import * as React from "react"
import { Key, Loader2 } from "lucide-react"

import {
  buildColorMap,
  segmentDisplayLabel,
  type Segment,
} from "@/lib/segments"
import { PageRibbon, type RibbonRow } from "@/components/ui/page-ribbon"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSurface,
} from "@/components/ui/viewer"
import type {
  PartitionChunk,
  PartitionResult,
} from "@/components/viewers/lib/partition-types"

export type PartitionDocumentScrollRequest = {
  pageNumber: number
  version: number
}

export type PartitionDocumentState = {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  scrollRequest: PartitionDocumentScrollRequest | null
}

type PartitionViewerContextValue = {
  currentPage: number
  document: PartitionDocumentState
  hasOutput: boolean
  isProcessing: boolean
  legendSegments: Segment[]
  pageCount: number
  result: PartitionResult | null
  rows: RibbonRow[]
  scrollProgress: number
  requestPageScroll: (page: number) => void
}

const PartitionViewerContext =
  React.createContext<PartitionViewerContextValue | null>(null)

export interface PartitionViewerProviderProps {
  result: PartitionResult | null
  isProcessing?: boolean
  children: React.ReactNode
}

export interface PartitionViewerProps {
  result: PartitionResult | null
  isProcessing?: boolean
}

export function usePartitionViewer() {
  const context = React.useContext(PartitionViewerContext)
  if (!context) {
    throw new Error(
      "usePartitionViewer must be used within PartitionViewerProvider."
    )
  }
  return context
}

export function usePartitionViewerHeader() {
  const {
    currentPage,
    legendSegments,
    pageCount,
    requestPageScroll,
    rows,
    scrollProgress,
  } = usePartitionViewer()

  return {
    currentPage,
    legendSegments,
    pageCount,
    requestPageScroll,
    rows,
    scrollProgress,
  }
}

export function usePartitionViewerDocument(): PartitionDocumentState {
  return usePartitionViewer().document
}

export function PartitionViewerProvider({
  result,
  isProcessing = false,
  children,
}: PartitionViewerProviderProps) {
  const [currentPdfPage, setCurrentPdfPage] = React.useState(1)
  const [scrollProgress, setScrollProgress] = React.useState(0)
  const [scrollRequest, setScrollRequest] =
    React.useState<PartitionDocumentScrollRequest | null>(null)
  const hasOutput = !!result && result.output.length > 0

  const voteChoices = React.useMemo(
    () => result?.consensus.choices ?? [],
    [result?.consensus.choices]
  )

  const pageCount = React.useMemo(() => {
    if (!result) return 0
    return maxChunkPage([
      ...result.output,
      ...voteChoices.flatMap((chunks) => chunks),
    ])
  }, [result, voteChoices])

  const { legendSegments, rows } = React.useMemo(() => {
    if (!result)
      return { legendSegments: [] as Segment[], rows: [] as RibbonRow[] }
    const colors = buildColorMap([
      ...result.output.map((c) => c.key),
      ...voteChoices.flat().map((c) => c.key),
    ])
    const seg = (c: PartitionChunk): Segment => ({
      id: c.key,
      label: c.key,
      pages: normalizePages(c.pages),
      color:
        colors.get(c.key) ??
        colors.get(segmentDisplayLabel(c.key)) ??
        "var(--color-muted-foreground)",
      index: 0,
    })
    const legendByKey = new Map<string, Segment>()
    for (const c of result.output) {
      const existing = legendByKey.get(c.key)
      legendByKey.set(
        c.key,
        existing
          ? {
              ...existing,
              pages: normalizePages([...existing.pages, ...c.pages]),
            }
          : seg(c)
      )
    }
    const ribbonRows: RibbonRow[] = [
      ...result.output.map((c, i) => ({ id: `c-${i}`, segments: [seg(c)] })),
      ...voteChoices.flatMap((chunks, vi) =>
        chunks.map((c, i) => ({ id: `v${vi}-${i}`, segments: [seg(c)] }))
      ),
    ]
    return { legendSegments: [...legendByKey.values()], rows: ribbonRows }
  }, [result, voteChoices])

  const requestPageScroll = React.useCallback((page: number) => {
    const normalizedPage = Math.max(1, Math.floor(page))
    setScrollRequest((current) => ({
      pageNumber: normalizedPage,
      version: (current?.version ?? 0) + 1,
    }))
  }, [])

  const document = React.useMemo<PartitionDocumentState>(
    () => ({
      onCurrentPageChange: setCurrentPdfPage,
      onScrollProgressChange: setScrollProgress,
      scrollRequest,
    }),
    [scrollRequest]
  )

  const value = React.useMemo<PartitionViewerContextValue>(
    () => ({
      currentPage: Math.max(1, Math.floor(currentPdfPage)),
      document,
      hasOutput,
      isProcessing,
      legendSegments,
      pageCount,
      requestPageScroll,
      result,
      rows,
      scrollProgress,
    }),
    [
      currentPdfPage,
      document,
      hasOutput,
      isProcessing,
      legendSegments,
      pageCount,
      requestPageScroll,
      result,
      rows,
      scrollProgress,
    ]
  )

  return (
    <PartitionViewerContext.Provider value={value}>
      {children}
    </PartitionViewerContext.Provider>
  )
}

export function PartitionViewerHeader({
  className,
}: {
  className?: string
}) {
  const interaction = useSegmentInteraction()
  const {
    currentPage,
    legendSegments,
    pageCount,
    requestPageScroll,
    rows,
    scrollProgress,
  } = usePartitionViewerHeader()

  if (legendSegments.length === 0) return null

  return (
    <ViewerHeader className={className ?? "space-y-2 bg-background px-3 py-2"}>
      <SegmentLegend
        variant="plain"
        segments={legendSegments}
        currentPage={currentPage}
        interaction={interaction}
        onSelect={(segment) => {
          if (segment.pages.length) requestPageScroll(segment.pages[0])
        }}
        columns={4}
      />
      <PageRibbon
        orientation="horizontal"
        rows={rows}
        pageCount={pageCount}
        currentPage={currentPage}
        scrollProgress={scrollProgress}
        interaction={interaction}
        onSelectPage={requestPageScroll}
      />
    </ViewerHeader>
  )
}

export function PartitionViewerDocumentState() {
  const { hasOutput } = usePartitionViewer()

  if (!hasOutput) return <PartitionViewerEmptyState />

  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <span className="text-sm text-muted-foreground">
        No document available
      </span>
    </div>
  )
}

export function PartitionViewerEmptyState() {
  const { isProcessing } = usePartitionViewer()

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
      {isProcessing ? (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-base text-muted-foreground">
            Partitioning...
          </p>
        </>
      ) : (
        <>
          <Key className="h-16 w-16 text-muted-foreground" />
          <p className="text-center text-base text-muted-foreground">
            Run partition to see output
          </p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Upload a document, set a key and instructions, then click Run
            Partition
          </p>
        </>
      )}
    </div>
  )
}

export function PartitionViewer({
  result,
  isProcessing = false,
}: PartitionViewerProps) {
  return (
    <PartitionViewerProvider result={result} isProcessing={isProcessing}>
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <PartitionViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <PartitionViewerDocumentState />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PartitionViewerProvider>
  )
}

function normalizePages(pages: number[]): number[] {
  return Array.from(
    new Set((pages ?? []).filter((page) => Number.isInteger(page) && page > 0))
  ).sort((a, b) => a - b)
}

function maxChunkPage(chunks: PartitionChunk[]): number {
  let max = 0
  for (const chunk of chunks) {
    for (const page of normalizePages(chunk.pages)) {
      max = Math.max(max, page)
    }
  }
  return max
}
