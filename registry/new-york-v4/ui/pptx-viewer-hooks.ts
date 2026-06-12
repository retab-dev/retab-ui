"use client"

import * as React from "react"

import { type ViewerResource } from "@/lib/viewer-resource"

import { getPptxSource, type PptxSource } from "./pptx-viewer-source"

/** Retains the cached source for the mounted lifetime of the viewer. */
export function useRetainedPptxSource(resource: ViewerResource): PptxSource {
  const sourcePromise = React.useMemo(() => getPptxSource(resource), [resource])
  const source = React.use(sourcePromise)
  React.useEffect(() => source.retain(), [source])
  return source
}
