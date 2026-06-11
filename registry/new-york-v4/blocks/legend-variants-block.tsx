"use client"

import * as React from "react"

import {
  pageOwners as buildPageOwners,
  segmentsPageCount,
  toSegments,
  type Segment,
} from "@/lib/segments"
import {
  SegmentLegend,
  type SegmentLegendOrientation,
  type SegmentLegendSide,
  type SegmentLegendVariant,
} from "@/components/ui/segment-legend"
import { PageRibbon, type RibbonRow } from "@/components/ui/page-ribbon"
import { PdfViewer, type PdfViewerSlots } from "@/components/ui/pdf-viewer"
import { cn } from "@/lib/utils"

const PDF_URL = "/samples/attention.pdf"

// The exact split and partition results the standalone viewer blocks use, over
// the same attention.pdf — so this is the real document, not a placeholder.
const SPLIT_OUTPUT = [
  { name: "Title & Abstract", pages: [1] },
  { name: "Introduction", pages: [2, 3] },
  { name: "Model Architecture", pages: [4, 5, 6] },
  { name: "Results", pages: [7, 8] },
  { name: "References", pages: [9, 10, 11] },
]

const PARTITION_OUTPUT = [
  { key: "abstract", pages: [1] },
  { key: "introduction", pages: [2] },
  { key: "model_architecture", pages: [2, 3, 4, 5, 6] },
  { key: "training", pages: [7, 8] },
  { key: "results", pages: [8, 9, 10] },
  { key: "references", pages: [10, 11, 12] },
]

type ExampleId = "split" | "partition"

// Each example reduces to the same shared model — a `Segment[]` for the legend
// and overlays, plus ribbon "lanes". Split is one vertical lane (subdocuments
// tile the pages); partition is a horizontal waterfall, one lane per chunk.
type ExampleConfig = {
  id: ExampleId
  segments: Segment[]
  ribbonRows: RibbonRow[]
  ribbonOrientation: "vertical" | "horizontal"
  pageCount: number
}

function buildExample(id: ExampleId): ExampleConfig {
  if (id === "split") {
    const segments = toSegments(SPLIT_OUTPUT)
    return {
      id,
      segments,
      ribbonRows: [{ id: "split", segments }],
      ribbonOrientation: "vertical",
      pageCount: segmentsPageCount(segments),
    }
  }
  const segments = toSegments(PARTITION_OUTPUT)
  return {
    id,
    segments,
    // One lane per chunk → the consensus waterfall (overlap shows as stacked rows).
    ribbonRows: segments.map((s) => ({ id: s.id, segments: [s] })),
    ribbonOrientation: "horizontal",
    pageCount: segmentsPageCount(segments),
  }
}

type Placement = "top" | "overlay" | "left"

type VariantPreset = {
  label: string
  variant: SegmentLegendVariant
  orientation: SegmentLegendOrientation
  side?: SegmentLegendSide
  placement: Placement
}

const PRESETS: VariantPreset[] = [
  { label: "Bar", variant: "bar", orientation: "horizontal", side: "top", placement: "top" },
  { label: "Floating", variant: "floating", orientation: "horizontal", side: "top", placement: "overlay" },
  { label: "Inset", variant: "inset", orientation: "horizontal", placement: "top" },
  { label: "Rail", variant: "bar", orientation: "vertical", side: "left", placement: "left" },
]

/**
 * Every legend placement — bar, floating, inset, and a vertical rail — shown on
 * the real split/partition document. The legend, the page ribbon/waterfall, and
 * the page color overlays are independent surfaces mounted into separate
 * `PdfViewer` slots, so moving the legend never drags the ribbon along: that's
 * the whole point. They share one selection, so hovering a label dims the
 * matching pages across all four panels at once.
 */
export function LegendVariantsBlock() {
  const [exampleId, setExampleId] = React.useState<ExampleId>("split")
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const example = React.useMemo(() => buildExample(exampleId), [exampleId])

  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div>
          <h2 className="text-base font-semibold">Legend variants</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            One <code className="text-xs">SegmentLegend</code>, four placements, on the real{" "}
            {exampleId} document — the {exampleId === "split" ? "page ribbon" : "consensus waterfall"}{" "}
            stays put in its own slot.
          </p>
        </div>
        <ExampleToggle
          value={exampleId}
          onChange={(next) => {
            setExampleId(next)
            setActiveId(null)
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          {PRESETS.map((preset) => (
            <VariantPanel
              key={preset.label}
              preset={preset}
              example={example}
              activeId={activeId}
              onActivate={setActiveId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function VariantPanel({
  preset,
  example,
  activeId,
  onActivate,
}: {
  preset: VariantPreset
  example: ExampleConfig
  activeId: string | null
  onActivate: (id: string | null) => void
}) {
  const { segments, ribbonRows, ribbonOrientation, pageCount } = example
  const [currentPage, setCurrentPage] = React.useState<number | null>(null)
  const [scrollProgress, setScrollProgress] = React.useState<number | null>(null)
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const owners = React.useMemo(() => buildPageOwners(segments), [segments])
  const byIndex = React.useMemo(() => {
    const map = new Map<number, Segment>()
    segments.forEach((s) => map.set(s.index, s))
    return map
  }, [segments])
  const activeSegment = activeId
    ? segments.find((s) => s.id === activeId)
    : undefined

  const jumpToPage = React.useCallback((page: number) => {
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const legend = (
    <SegmentLegend
      segments={segments}
      variant={preset.variant}
      orientation={preset.orientation}
      side={preset.side}
      density="compact"
      columns={preset.orientation === "horizontal" ? 3 : undefined}
      activeId={activeId}
      onActivate={onActivate}
      currentPage={currentPage}
      onSelect={(id) => {
        const seg = segments.find((s) => s.id === id)
        if (seg?.pages.length) jumpToPage(seg.pages[0])
      }}
    />
  )

  // The legend mounts where the variant dictates; the ribbon/waterfall mounts in
  // its own slot and only steps aside (left → right) when the legend takes the
  // left rail. The two never share a slot, so placement stays independent.
  const ribbonSide: "left" | "right" | "bottom" =
    ribbonOrientation === "horizontal"
      ? "bottom"
      : preset.placement === "left"
        ? "right"
        : "left"

  const ribbon = (
    <PageRibbon
      orientation={ribbonOrientation}
      rows={ribbonRows}
      pageCount={pageCount}
      currentPage={currentPage}
      scrollProgress={ribbonOrientation === "horizontal" ? scrollProgress : null}
      activeId={activeId}
      onActivate={onActivate}
      onSelectPage={jumpToPage}
      showTicks={ribbonOrientation === "vertical"}
    />
  )

  const slots: PdfViewerSlots = {
    [preset.placement]: legend,
    [ribbonSide]:
      ribbonSide === "bottom" ? (
        <div className="border-t border-border bg-background px-3 py-2">{ribbon}</div>
      ) : (
        <div
          className={cn(
            "h-full overflow-auto bg-background px-3 py-4",
            ribbonSide === "left" ? "border-r" : "border-l"
          )}
        >
          {ribbon}
        </div>
      ),
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {preset.label}
        </span>
        <code className="text-[11px] text-muted-foreground">
          slots.{preset.placement}
          {preset.orientation === "vertical" ? " · vertical" : ""}
        </code>
      </div>
      <div
        ref={panelRef}
        className="h-[420px] overflow-hidden rounded-lg border bg-card"
      >
        <PdfViewer
          src={PDF_URL}
          bare
          toolbar={false}
          asideToggle={false}
          downloadFileName="attention.pdf"
          slots={slots}
          onVisiblePageChange={setCurrentPage}
          onScrollProgressChange={setScrollProgress}
          renderPageOverlay={({ pageNumber }) => {
            const ownerIdx = owners.get(pageNumber) ?? []
            if (ownerIdx.length === 0) return null
            const owner = byIndex.get(ownerIdx[0])
            if (!owner) return null
            const active =
              activeSegment != null && ownerIdx.includes(activeSegment.index)
            return (
              <div
                className="absolute inset-0 transition-colors"
                style={{
                  backgroundColor: withAlpha(owner.color, active ? 0.22 : 0.08),
                  outline: active ? `3px solid ${owner.color}` : undefined,
                  outlineOffset: -3,
                }}
              />
            )
          }}
          className="h-full"
        />
      </div>
    </div>
  )
}

function ExampleToggle({
  value,
  onChange,
}: {
  value: ExampleId
  onChange: (next: ExampleId) => void
}) {
  const options: { id: ExampleId; label: string }[] = [
    { id: "split", label: "Split" },
    { id: "partition", label: "Partition" },
  ]
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((option) => {
        const isActive = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace("#", "")
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
