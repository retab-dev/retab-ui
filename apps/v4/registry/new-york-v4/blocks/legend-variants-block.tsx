"use client"

import * as React from "react"

import {
  pageOwners as buildPageOwners,
  toSegments,
  type Segment,
} from "@/lib/segments"
import {
  SegmentLegend,
  type SegmentLegendOrientation,
  type SegmentLegendSide,
  type SegmentLegendVariant,
} from "@/components/ui/segment-legend"
import { PdfViewer } from "@/components/ui/pdf-viewer"
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

/** Where the legend renders relative to the document surface. */
type Placement = "header" | "aside" | "overlay"

type VariantPreset = {
  label: string
  variant: SegmentLegendVariant
  orientation: SegmentLegendOrientation
  side?: SegmentLegendSide
  placement: Placement
}

const PRESETS: VariantPreset[] = [
  { label: "Bar", variant: "bar", orientation: "horizontal", side: "top", placement: "header" },
  { label: "Floating", variant: "floating", orientation: "horizontal", side: "top", placement: "overlay" },
  { label: "Inset", variant: "inset", orientation: "horizontal", placement: "header" },
  { label: "Rail", variant: "bar", orientation: "vertical", side: "left", placement: "aside" },
]

/**
 * Every legend placement — bar, floating, inset, and a vertical rail — shown on
 * the real split/partition document. One `SegmentLegend` drives each panel and
 * the page color overlays; only `variant`/`orientation`/`side` differ. Hover a
 * label and the matching pages dim across all four panels at once, since they
 * share one selection.
 */
export function LegendVariantsBlock() {
  const [exampleId, setExampleId] = React.useState<ExampleId>("split")
  const [activeId, setActiveId] = React.useState<string | null>(null)

  const segments = React.useMemo<Segment[]>(
    () =>
      exampleId === "split"
        ? toSegments(SPLIT_OUTPUT)
        : toSegments(PARTITION_OUTPUT),
    [exampleId]
  )

  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div>
          <h2 className="text-base font-semibold">Legend variants</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            One <code className="text-xs">SegmentLegend</code>, four placements, on the real{" "}
            {exampleId} document.
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
              segments={segments}
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
  segments,
  activeId,
  onActivate,
}: {
  preset: VariantPreset
  segments: Segment[]
  activeId: string | null
  onActivate: (id: string | null) => void
}) {
  const [currentPage, setCurrentPage] = React.useState<number | null>(null)
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

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {preset.label}
        </span>
        <code className="text-[11px] text-muted-foreground">
          variant=&quot;{preset.variant}&quot;
          {preset.orientation === "vertical" ? ' · orientation="vertical"' : ""}
        </code>
      </div>
      {/* `relative` so the floating variant anchors over this panel's document. */}
      <div
        ref={panelRef}
        className="relative h-[420px] overflow-hidden rounded-lg border bg-card"
      >
        <PdfViewer
          src={PDF_URL}
          bare
          toolbar={false}
          downloadFileName="attention.pdf"
          header={preset.placement === "header" ? legend : undefined}
          aside={
            preset.placement === "aside" ? (
              <div className="h-full overflow-auto px-2 py-3">{legend}</div>
            ) : undefined
          }
          asideToggle={false}
          onVisiblePageChange={setCurrentPage}
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
        {preset.placement === "overlay" ? legend : null}
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
