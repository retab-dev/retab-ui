import type * as React from "react"

import {
  TEXT_VIEWER_BLOCK_PADDING,
  TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  TEXT_VIEWER_OVERSCAN,
} from "./text-viewer-scale"

export interface TextVirtualLine {
  index: number
  key: React.Key
  size: number
  start: number
}

export function createInitialTextVirtualLines(
  lineCount: number,
  lineHeight: number
): TextVirtualLine[] {
  const windowLineCount = Math.min(
    lineCount,
    Math.ceil(TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT / lineHeight) +
      TEXT_VIEWER_OVERSCAN * 2
  )

  return Array.from({ length: windowLineCount }, (_, index) => ({
    index,
    key: index,
    size: lineHeight,
    start: TEXT_VIEWER_BLOCK_PADDING + index * lineHeight,
  }))
}
