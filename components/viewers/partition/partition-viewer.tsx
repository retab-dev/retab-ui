"use client"

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { Key, Loader2 } from "lucide-react"

import { buildColorMap, type Segment } from "@/lib/segments"
import { PageRibbon, type RibbonRow } from "@/components/ui/page-ribbon"
import { type PdfViewerSlots } from "@/components/ui/pdf-viewer"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"
import type {
  PartitionChunk,
  PartitionResult,
} from "@/components/viewers/lib/partition-types"

/**
 * Slots a document surface receives: the color key in `top`, the consensus
 * waterfall in `bottom`. They're independent regions — the key and the
 * page-axis waterfall never share a slot, so either can be placed on its own.
 */
export interface PartitionDocumentHandlers {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange: (progress: number) => void
  slots: PdfViewerSlots
}

export interface PartitionViewerProps {
  result: PartitionResult | null
  isProcessing?: boolean
  renderDocument?: (handlers: PartitionDocumentHandlers) => ReactNode
}

export function PartitionViewer({
  result,
  isProcessing = false,
  renderDocument,
}: PartitionViewerProps) {
  const [currentPdfPage, setCurrentPdfPage] = useState(1)
  const [scrollProgress, setScrollProgress] = useState(0)
  const interaction = useSegmentInteraction()
  const previewPanelRef = useRef<HTMLDivElement | null>(null)
  const hasOutput = !!result && result.output.length > 0

  const voteChoices = useMemo(
    () => result?.consensus.choices ?? [],
    [result?.consensus.choices]
  )

  const pageCount = useMemo(() => {
    if (!result) return 0
    const lastPage = (chunks: PartitionChunk[]) =>
      chunks.reduce(
        (max, c) =>
          Math.max(max, c.pages.length ? c.pages[c.pages.length - 1] : 0),
        0
      )
    return Math.max(
      lastPage(result.output),
      voteChoices.reduce((m, chunks) => Math.max(m, lastPage(chunks)), 0)
    )
  }, [result, voteChoices])

  const { legendSegments, rows } = useMemo(() => {
    if (!result)
      return { legendSegments: [] as Segment[], rows: [] as RibbonRow[] }
    const colors = buildColorMap([
      ...result.output.map((c) => c.key),
      ...voteChoices.flat().map((c) => c.key),
    ])
    const seg = (c: PartitionChunk): Segment => ({
      id: c.key,
      label: c.key,
      pages: [...c.pages].sort((a, b) => a - b),
      color: colors.get(c.key) ?? "var(--color-muted-foreground)",
      index: 0,
    })
    const legendByKey = new Map<string, Segment>()
    for (const c of result.output) {
      const existing = legendByKey.get(c.key)
      legendByKey.set(
        c.key,
        existing
          ? { ...existing, pages: [...existing.pages, ...c.pages] }
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

  const handleJumpToPage = useCallback((page: number) => {
    previewPanelRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const currentPageInt = Math.max(1, Math.floor(currentPdfPage))

  if (!hasOutput) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
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

  // The color key and the consensus waterfall stack in the `top` slot — two
  // independent surfaces the viewer composes, not one nested in the other.
  const slots: PdfViewerSlots = {
    top: (
      <div className="space-y-2 border-b border-border bg-background px-3 py-2">
        <SegmentLegend
          variant="plain"
          segments={legendSegments}
          currentPage={currentPageInt}
          interaction={interaction}
          onSelect={(segment) => {
            if (segment.pages.length) handleJumpToPage(segment.pages[0])
          }}
          columns={4}
        />
        <PageRibbon
          orientation="horizontal"
          rows={rows}
          pageCount={pageCount}
          currentPage={currentPageInt}
          scrollProgress={scrollProgress}
          interaction={interaction}
          onSelectPage={handleJumpToPage}
        />
      </div>
    ),
  }

  return (
    <div
      ref={previewPanelRef}
      className="flex min-h-0 flex-1 flex-col bg-background"
    >
      {renderDocument ? (
        renderDocument({
          onCurrentPageChange: setCurrentPdfPage,
          onScrollProgressChange: setScrollProgress,
          slots,
        })
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-sm text-muted-foreground">
            No document available
          </span>
        </div>
      )}
    </div>
  )
}
