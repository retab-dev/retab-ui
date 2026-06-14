"use client"

import * as React from "react"

import { CODE_VIEWER_BASE_FONT_PX } from "./code-viewer-scale"
import { getCodeVirtualTotalSize } from "./code-viewer-virtualization"
import { ScrollArea } from "./scroll-area"

const CODE_VIEWER_DEFAULT_VIEWPORT_WIDTH = 800

export function CodeViewerViewport({
  contentIdentity,
  fontScale,
  lineCount,
  lineHeight,
  rowHostRef,
  viewportRef,
}: {
  contentIdentity: string
  fontScale: number
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
    <ScrollArea
      className="min-h-0 flex-1 bg-background"
      viewportClassName="bg-background"
      viewportRef={viewportRef}
    >
      <div
        className="relative w-max min-w-full bg-background font-mono"
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
  )
}
