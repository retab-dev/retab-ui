"use client"

import { LegendVariantsBlock } from "@/registry/new-york-v4/blocks/legend-variants-block"

// The legend on a real split viewer: one ViT paper split result rendered
// with all three placements — bar, floating, and a vertical rail — sharing one
// selection across every cell.
export function SegmentLegendSplit() {
  return (
    <div className="not-prose overflow-hidden rounded-xl border">
      <LegendVariantsBlock />
    </div>
  )
}
