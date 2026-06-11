"use client"

import * as React from "react"

import { meanConfidence, toSegments } from "@/lib/segments"
import { SegmentSidebar } from "@/components/ui/segment-sidebar"

// A split-style result (named subdocuments) with per-page likelihoods — the
// same model also covers partition chunks; only the label differs.
const output = [
  { name: "Title & Abstract", pages: [1] },
  { name: "Introduction", pages: [2, 3] },
  { name: "Model Architecture", pages: [4, 5, 6] },
  { name: "Results", pages: [7, 8] },
  { name: "References", pages: [9, 10, 11] },
]
const likelihoods = [
  [0.99],
  [0.95, 0.9],
  [0.9, 0.85, 0.9],
  [0.8, 0.82],
  [0.97, 0.95, 0.96],
]

export function SegmentSidebarDemo() {
  const segments = React.useMemo(
    () => toSegments(output, likelihoods.map((l) => meanConfidence(l))),
    []
  )
  const [activeId, setActiveId] = React.useState<string | null>(null)
  return (
    <div className="not-prose my-6 max-w-xs">
      <SegmentSidebar
        segments={segments}
        activeId={activeId}
        onActivate={setActiveId}
        unitLabel="subdocument"
        className="rounded-lg border"
      />
    </div>
  )
}
