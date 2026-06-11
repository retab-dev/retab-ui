"use client"

import * as React from "react"

import { toSegments } from "@/lib/segments"
import {
  SegmentLegend,
  type SegmentLegendOrientation,
  type SegmentLegendSide,
  type SegmentLegendVariant,
} from "@/components/ui/segment-legend"
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
  { id: "inset", label: "Inset", variant: "inset", orientation: "horizontal" },
  { id: "rail", label: "Rail", variant: "bar", orientation: "vertical", side: "left" },
]

export function SegmentLegendVariantsDemo() {
  const [presetId, setPresetId] = React.useState("bar")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]

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

  const isRail = preset.orientation === "vertical"

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
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* The document surface. `relative` so the floating variant can anchor. */}
      <div
        className={cn(
          "relative h-[360px] overflow-hidden rounded-xl border bg-card",
          isRail ? "flex" : "flex flex-col"
        )}
      >
        {/* In-flow variants render before the document; floating overlays it. */}
        {preset.variant !== "floating" ? legend : null}
        <FauxDocument />
        {preset.variant === "floating" ? legend : null}
      </div>
    </div>
  )
}

/** A page-shaped placeholder so the legend has a document to sit on. */
function FauxDocument() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-muted/30 p-6">
      <div className="mx-auto h-full w-full max-w-xs rounded-md border bg-background p-5 shadow-sm">
        <div className="mb-4 h-3 w-2/3 rounded bg-muted-foreground/25" />
        <div className="space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-2 rounded bg-muted-foreground/15"
              style={{ width: `${70 + ((i * 37) % 30)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
