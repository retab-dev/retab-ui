"use client"

import * as React from "react"

import { getPptxSource, type PptxSource } from "./pptx-viewer-source"

/** Retains the cached source for the mounted lifetime of the viewer. */
export function useRetainedPptxSource(src: string): PptxSource {
  const source = React.use(getPptxSource(src))
  React.useEffect(() => source.retain(), [source])
  return source
}
