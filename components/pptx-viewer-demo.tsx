"use client"

import * as React from "react"

import { PptxViewer } from "@/components/ui/pptx-viewer"

// A normalized bounding box (0..1) to demonstrate the per-slide overlay slot —
// the same shape Retab's edit fields and extraction sources use. Anchored to the
// title bar on the first slide of the sample deck.
const sampleBox = { slide: 1, left: 0.0, top: 0.0, width: 1.0, height: 0.187 }

export function PptxViewerDemo() {
  return (
    <div className="not-prose my-6 h-[600px]">
      <PptxViewer
        source={{
          kind: "url",
          url: "/samples/sample-deck.pptx",
          fileName: "sample-deck.pptx",
        }}
        className="h-full"
        fallbackSlideSize={{ width: 960, height: 540 }}
        renderSlideOverlay={({ slideNumber }) =>
          slideNumber === sampleBox.slide ? (
            <div
              className="absolute rounded-[2px] outline outline-2 outline-primary"
              style={{
                left: `${sampleBox.left * 100}%`,
                top: `${sampleBox.top * 100}%`,
                width: `${sampleBox.width * 100}%`,
                height: `${sampleBox.height * 100}%`,
                backgroundColor: "rgba(99,102,241,0.18)",
              }}
            />
          ) : null
        }
      />
    </div>
  )
}
