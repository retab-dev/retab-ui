"use client"

import * as React from "react"

import { CODE_GUTTER_BACKGROUND } from "./code-viewer-projector"
import { CODE_VIEWER_BASE_FONT_PX } from "./code-viewer-scale"
import { getCodeVirtualTotalSize } from "./code-viewer-virtualization"
import { ScrollArea } from "./scroll-area"

const CODE_VIEWER_DEFAULT_VIEWPORT_WIDTH = 800

export function CodeViewerViewport({
  contentIdentity,
  fontScale,
  gutterWidth,
  lineCount,
  lineHeight,
  rowHostRef,
  viewportRef,
}: {
  contentIdentity: string
  fontScale: number
  gutterWidth: string
  lineCount: number
  lineHeight: number
  rowHostRef: React.RefObject<HTMLPreElement | null>
  viewportRef: React.RefObject<HTMLDivElement | null>
}) {
  const fontSize = `${CODE_VIEWER_BASE_FONT_PX * fontScale}px`
  const totalHeight = getCodeVirtualTotalSize({
    lineCount,
    lineHeight,
  })

  return (
    <div className="relative min-h-0 flex-1 bg-background">
      {/* Fixed full-height gutter rail, behind the scrolling content: the
          line-number column and its divider always reach the bottom of the
          viewport and never move while scrolling, because it lives outside the
          scroll container. The per-row gutters paint the numbers — and mask
          horizontally-scrolled code — on top of it. The viewport itself is
          transparent so this shows through below the last line. */}
      <div
        aria-hidden
        data-code-gutter-rail=""
        className="pointer-events-none absolute inset-y-0 left-0 z-0 border-r"
        style={{ width: gutterWidth, backgroundColor: CODE_GUTTER_BACKGROUND }}
      />
      <ScrollArea className="absolute inset-0 z-10" viewportRef={viewportRef}>
        <div
          className="relative w-max min-w-full font-mono"
          style={{
            fontSize,
            height: totalHeight,
            lineHeight: `${lineHeight}px`,
            minWidth: CODE_VIEWER_DEFAULT_VIEWPORT_WIDTH,
          }}
        >
          <pre
            key={contentIdentity}
            ref={rowHostRef}
            className="relative w-full"
            suppressHydrationWarning
            style={{
              fontSize,
              height: totalHeight,
              lineHeight: `${lineHeight}px`,
            }}
          />
        </div>
      </ScrollArea>
    </div>
  )
}
