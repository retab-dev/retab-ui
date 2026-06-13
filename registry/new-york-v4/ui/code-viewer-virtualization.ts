import type * as React from "react"

import {
  CODE_VIEWER_BLOCK_PADDING,
  CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  CODE_VIEWER_OVERSCAN,
} from "./code-viewer-scale"

export interface CodeVirtualLine {
  index: number
  key: React.Key
  size: number
  start: number
}

export function createInitialCodeVirtualLines(
  lineCount: number,
  lineHeight: number
): CodeVirtualLine[] {
  const windowLineCount = Math.min(
    lineCount,
    Math.ceil(CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT / lineHeight) +
      CODE_VIEWER_OVERSCAN * 2
  )

  return Array.from({ length: windowLineCount }, (_, index) => ({
    index,
    key: index,
    size: lineHeight,
    start: CODE_VIEWER_BLOCK_PADDING + index * lineHeight,
  }))
}
