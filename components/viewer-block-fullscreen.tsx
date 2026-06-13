"use client"

import * as React from "react"

import { getViewerBlock, type ViewerBlockId } from "@/lib/viewer-blocks"
import { CsvSourcesBlock } from "@/registry/new-york-v4/blocks/csv-sources-block"
import { DocxSourcesBlock } from "@/registry/new-york-v4/blocks/docx-sources-block"
import { DropzoneBlock } from "@/registry/new-york-v4/blocks/dropzone-block"
import { EditViewerBlock } from "@/registry/new-york-v4/blocks/edit-viewer-block"
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block"
import { ExtractionViewerBlock } from "@/registry/new-york-v4/blocks/extraction-viewer-block"
import { ImageSourcesBlock } from "@/registry/new-york-v4/blocks/image-sources-block"
import { LegendVariantsBlock } from "@/registry/new-york-v4/blocks/legend-variants-block"
import { OcrBlock } from "@/registry/new-york-v4/blocks/ocr-block"
import { ParseViewerBlock } from "@/registry/new-york-v4/blocks/parse-viewer-block"
import { PartitionViewerBlock } from "@/registry/new-york-v4/blocks/partition-viewer-block"
import { PdfThumbnailsBlock } from "@/registry/new-york-v4/blocks/pdf-thumbnails-block"
import { PrimitiveCardsBlock } from "@/registry/new-york-v4/blocks/primitive-cards-block"
import { SplitViewerBlock } from "@/registry/new-york-v4/blocks/split-viewer-block"
import { TextSourcesBlock } from "@/registry/new-york-v4/blocks/text-sources-block"
import { XlsxSourcesBlock } from "@/registry/new-york-v4/blocks/xlsx-sources-block"

const blockComponents = {
  ocr: OcrBlock,
  split: SplitViewerBlock,
  partition: PartitionViewerBlock,
  parse: ParseViewerBlock,
  edit: EditViewerBlock,
  "extraction-viewer": ExtractionViewerBlock,
  extract: ExtractViewerBlock,
  "image-sources": ImageSourcesBlock,
  "text-sources": TextSourcesBlock,
  "csv-sources": CsvSourcesBlock,
  "xlsx-sources": XlsxSourcesBlock,
  "docx-sources": DocxSourcesBlock,
  dropzone: DropzoneBlock,
  "primitive-cards": PrimitiveCardsBlock,
  "legend-variants": LegendVariantsBlock,
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
