"use client"

import * as React from "react"

import { getViewerBlock, type ViewerBlockId } from "@/lib/viewer-blocks"
import { VIEWER_BLOCK_COMPONENTS } from "@/components/viewer-block-component-registry"

export function ViewerBlockFullscreen({ blockId }: { blockId: string }) {
  const block = getViewerBlock(blockId)
  if (!block) return null

  const Preview = VIEWER_BLOCK_COMPONENTS[block.id]

  return (
    <main className="h-svh min-h-0 overflow-hidden bg-background [&>*]:h-full [&>*]:min-h-0">
      <Preview key={block.id} />
    </main>
  )
}
