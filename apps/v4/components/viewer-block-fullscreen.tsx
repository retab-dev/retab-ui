"use client"

import * as React from "react"

import { getViewerBlock, type ViewerBlockId } from "@/lib/viewer-blocks"
import { ClassificationViewerBlock } from "@/registry/new-york-v4/blocks/classification-viewer-block"
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block"
import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block"
import { ImageSourcesBlock } from "@/registry/new-york-v4/blocks/image-sources-block"
import { TextSourcesBlock } from "@/registry/new-york-v4/blocks/text-sources-block"
import { CsvSourcesBlock } from "@/registry/new-york-v4/blocks/csv-sources-block"
import { XlsxSourcesBlock } from "@/registry/new-york-v4/blocks/xlsx-sources-block"
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
  "json-form-sources": JsonFormSourcesBlock,
  "image-sources": ImageSourcesBlock,
  "text-sources": TextSourcesBlock,
  "csv-sources": CsvSourcesBlock,
  "xlsx-sources": XlsxSourcesBlock,
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
