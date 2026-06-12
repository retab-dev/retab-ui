"use client"

import * as React from "react"

import {
  type ViewerContentBytes,
  type ViewerContentIdentity,
} from "@/lib/viewer-resource"

import { type PptxSourceLoadTiming } from "./pptx-viewer-core"
import {
  getPptxSource,
  subscribePptxSourceLoadTiming,
  type PptxSource,
} from "./pptx-viewer-source"

/** Retains the cached source for the mounted lifetime of the viewer. */
export function useRetainedPptxSource(
  content: ViewerContentBytes & ViewerContentIdentity,
  onLoadTiming?: (timing: PptxSourceLoadTiming) => void
): PptxSource {
  const sourcePromise = React.useMemo(() => getPptxSource(content), [content])
  const source = React.use(sourcePromise)
  React.useEffect(() => source.retain(), [source])
  React.useEffect(() => {
    if (!onLoadTiming) return
    return subscribePptxSourceLoadTiming(content, onLoadTiming)
  }, [onLoadTiming, content])
  return source
}
