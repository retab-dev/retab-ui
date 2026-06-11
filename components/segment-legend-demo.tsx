"use client"

import * as React from "react"

import { toSegments } from "@/lib/segments"
import {
  SegmentLegend,
  type SegmentLegendOrientation,
  type SegmentLegendSide,
  type SegmentLegendVariant,
} from "@/components/ui/segment-legend"
import { LegendVariantsBlock } from "@/registry/new-york-v4/blocks/legend-variants-block"
import { cn } from "@/lib/utils"

// One split-style result drives every variant — only the chrome changes.
const segments = toSegments([
  { name: "Title & Abstract", pages: [1] },
  { name: "Introduction", pages: [2, 3] },
  { name: "Model Architecture", pages: [4, 5, 6] },
  { name: "Results", pages: [7, 8] },
  { name: "References", pages: [9, 10, 11] },
])

type Preset = {
  id: string
  label: string
  variant: SegmentLegendVariant
  orientation: SegmentLegendOrientation
  side?: SegmentLegendSide
}

const PRESETS: Preset[] = [
  { id: "bar", label: "Bar", variant: "bar", orientation: "horizontal", side: "top" },
  { id: "floating", label: "Floating", variant: "floating", orientation: "horizontal", side: "top" },
  { id: "rail", label: "Rail", variant: "bar", orientation: "vertical", side: "left" },
]

export function SegmentLegendDemo() {
  const [presetId, setPresetId] = React.useState("bar")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const isRail = preset.orientation === "vertical"

  const legend = (
    <SegmentLegend
      segments={segments}
      variant={preset.variant}
      orientation={preset.orientation}
      side={preset.side}
      columns={preset.orientation === "horizontal" ? 4 : undefined}
      activeId={activeId}
      onActivate={setActiveId}
      currentPage={1}
    />
  )

  return (
    <div className="not-prose my-6 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPresetId(p.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              p.id === presetId
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "relative flex overflow-hidden rounded-lg border bg-muted/30",
          isRail ? "h-48" : "h-32 flex-col"
        )}
      >
        {legend}
      </div>
    </div>
  )
}

// The legend on a real split viewer: one attention.pdf split result rendered
// with all three placements — bar, floating, and a vertical rail — sharing one
// selection across every cell.
export function SegmentLegendSplitDemo() {
  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border">
      <LegendVariantsBlock />
    </div>
  )
}
