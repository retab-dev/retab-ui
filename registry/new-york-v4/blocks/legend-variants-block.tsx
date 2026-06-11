"use client"

import * as React from "react"

import { segmentsPageCount, toSegments, type Segment } from "@/lib/segments"
import {
  SegmentLegend,
  type SegmentLegendOrientation,
  type SegmentLegendSide,
  type SegmentLegendVariant,
} from "@/components/ui/segment-legend"
import { PageRibbon } from "@/components/ui/page-ribbon"
import { PdfViewer, type PdfViewerSlots } from "@/components/ui/pdf-viewer"

const PDF_URL = "/samples/attention.pdf"

// The same split result the standalone Split Viewer block uses, over attention.pdf.
const SPLIT_OUTPUT = [
  { name: "Title & Abstract", pages: [1] },
  { name: "Introduction", pages: [2, 3] },
  { name: "Model Architecture", pages: [4, 5, 6] },
  { name: "Results", pages: [7, 8, 9] },
  { name: "References", pages: [10, 11] },
  { name: "Attention Visualizations", pages: [12, 13, 14, 15] },
]

type LegendSlot = "top" | "overlay" | "right"

type Preset = {
  label: string
  variant: SegmentLegendVariant
  orientation: SegmentLegendOrientation
  side?: SegmentLegendSide
  slot: LegendSlot
}

// Every way the legend can sit on the document. The page ribbon stays the left
// rail throughout; the legend takes the top, floats over the page, insets into a
// panel, or runs down the right edge — so each is independent of the ribbon.
const PRESETS: Preset[] = [
  { label: "Bar", variant: "bar", orientation: "horizontal", side: "top", slot: "top" },
  { label: "Floating", variant: "floating", orientation: "horizontal", side: "top", slot: "overlay" },
  { label: "Inset", variant: "inset", orientation: "horizontal", slot: "top" },
  { label: "Rail", variant: "plain", orientation: "vertical", slot: "right" },
]

/**
 * The split viewer shown with every legend variant — a 2×2 gallery over one
 * `attention.pdf` split result. Each cell is a real `PdfViewer` with the page
 * ribbon as a left rail and the `SegmentLegend` placed a different way; one
 * shared selection dims the matching pages across all four at once.
 */
export function LegendVariantsBlock() {
  const segments = React.useMemo(() => toSegments(SPLIT_OUTPUT), [])
  const pageCount = React.useMemo(() => segmentsPageCount(segments), [segments])
  const [activeId, setActiveId] = React.useState<string | null>(null)

  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div className="border-b px-6 py-3">
        <h2 className="text-base font-semibold">Split viewer · legend variants</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          One split result, four legend placements — bar, floating, inset, and a vertical rail.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {PRESETS.map((preset) => (
            <Cell
              key={preset.label}
              preset={preset}
              segments={segments}
              pageCount={pageCount}
              activeId={activeId}
              onActivate={setActiveId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Cell({
  preset,
  segments,
  pageCount,
  activeId,
  onActivate,
}: {
  preset: Preset
  segments: Segment[]
  pageCount: number
  activeId: string | null
  onActivate: (id: string | null) => void
}) {
  const [currentPage, setCurrentPage] = React.useState<number | null>(1)
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const jumpToPage = React.useCallback((page: number) => {
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const onSelect = (id: string) => {
    const seg = segments.find((s) => s.id === id)
    if (seg?.pages.length) jumpToPage(seg.pages[0])
  }

  const legend = (
    <SegmentLegend
      segments={segments}
      variant={preset.variant}
      orientation={preset.orientation}
      side={preset.side}
      density="compact"
      columns={preset.orientation === "horizontal" ? 2 : undefined}
      activeId={activeId}
      onActivate={onActivate}
      currentPage={currentPage}
      onSelect={onSelect}
    />
  )

  const ribbon = (
    <div className="h-full overflow-auto border-r border-border bg-background px-2 py-4">
      <PageRibbon
        orientation="vertical"
        rows={[{ id: "split", segments }]}
        pageCount={pageCount}
        currentPage={currentPage}
        activeId={activeId}
        onActivate={onActivate}
        onSelectPage={jumpToPage}
        showTicks
      />
    </div>
  )

  // The legend's slot depends on the variant; the ribbon is always the left rail.
  const slots: PdfViewerSlots = {
    left: ribbon,
    [preset.slot]:
      preset.slot === "right" ? (
        <div className="h-full overflow-auto border-l border-border bg-background px-2 py-4">
          {legend}
        </div>
      ) : (
        legend
      ),
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {preset.label}
        </span>
        <code className="text-[11px] text-muted-foreground">
          variant=&quot;{preset.variant}&quot;
          {preset.orientation === "vertical" ? " · vertical" : ""}
        </code>
      </div>
      <div
        ref={panelRef}
        // A definite pixel height (inline, not a Tailwind arbitrary class) so the
        // viewer never falls back to content-height — which would let the page
        // grow the cell and collapse the `h-full` rails (legend + ribbon).
        style={{ height: 380 }}
        className="overflow-hidden rounded-lg border bg-card"
      >
        <PdfViewer
          src={PDF_URL}
          bare
          toolbar={false}
          asideToggle={false}
          downloadFileName="attention.pdf"
          slots={slots}
          onVisiblePageChange={setCurrentPage}
          className="h-full"
        />
      </div>
    </div>
  )
}
