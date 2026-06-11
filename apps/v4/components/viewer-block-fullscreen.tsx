"use client"

import * as React from "react"

import { getViewerBlock, type ViewerBlockId } from "@/lib/viewer-blocks"
import { ClassificationViewerBlock } from "@/registry/new-york-v4/blocks/classification-viewer-block"
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block"
import { ParseViewerBlock } from "@/registry/new-york-v4/blocks/parse-viewer-block"
import { PartitionViewerBlock } from "@/registry/new-york-v4/blocks/partition-viewer-block"
import { PdfThumbnailsBlock } from "@/registry/new-york-v4/blocks/pdf-thumbnails-block"
import { SplitViewerBlock } from "@/registry/new-york-v4/blocks/split-viewer-block"

const blockComponents = {
  split: SplitViewerBlock,
  partition: PartitionViewerBlock,
  classification: ClassificationViewerBlock,
  parse: ParseViewerBlock,
  extract: ExtractViewerBlock,
  "pdf-thumbnails": PdfThumbnailsBlock,
} satisfies Record<ViewerBlockId, React.ComponentType>

export function ViewerBlockFullscreen({ blockId }: { blockId: string }) {
  const block = getViewerBlock(blockId)
  if (!block) return null

  const Preview = blockComponents[block.id]

  return (
    <main className="h-svh min-h-0 overflow-hidden bg-background [&>*]:h-full [&>*]:min-h-0">
      <Preview key={block.id} />
    </main>
  )
}
