"use client"

import * as React from "react"

import { meanConfidence, toSegments } from "@/lib/segments"
import { SegmentedDocumentViewer } from "@/components/ui/segmented-document-viewer"

// A split-style result (named subdocuments) — the same model also covers
// partition chunks; only the label differs.
const output = [
  { name: "Title & Abstract", pages: [1] },
  { name: "Introduction", pages: [2, 3] },
  { name: "Model Architecture", pages: [4, 5, 6] },
  { name: "Results", pages: [7, 8, 9] },
  { name: "References", pages: [10, 11] },
  { name: "Attention Visualizations", pages: [12, 13, 14, 15] },
]
const likelihoods = [
  [0.99],
  [0.95, 0.9],
  [0.9, 0.85, 0.9],
  [0.8, 0.82, 0.84],
  [0.97, 0.95],
  [0.93, 0.91, 0.92, 0.9],
]

export function SegmentedViewerDemo() {
  const segments = React.useMemo(
    () => toSegments(output, likelihoods.map((l) => meanConfidence(l))),
    []
  )
  return (
    <div className="not-prose my-6 h-[620px]">
      <SegmentedDocumentViewer
        segments={segments}
        src="/samples/attention.pdf"
        unitLabel="subdocument"
        title="attention.pdf"
        className="h-full"
      />
    </div>
  )
}
