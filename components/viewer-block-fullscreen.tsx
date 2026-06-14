"use client"

import * as React from "react"

import { getViewerBlock, type ViewerBlockId } from "@/lib/viewer-blocks"
import { CsvSourcesBlock } from "@/registry/new-york-v4/blocks/csv-sources-block"
import { DocxSourcesBlock } from "@/registry/new-york-v4/blocks/docx-sources-block"
import { AvatarImageSlot } from "@/registry/new-york-v4/blocks/dropzone-avatar-image-slot"
import { DropzoneBlock } from "@/registry/new-york-v4/blocks/dropzone-block"
import { ComparisonPairUpload } from "@/registry/new-york-v4/blocks/dropzone-comparison-pair-upload"
import { ControlledQueue } from "@/registry/new-york-v4/blocks/dropzone-controlled-queue"
import { CustomThumbnailGrid } from "@/registry/new-york-v4/blocks/dropzone-custom-thumbnail-grid"
import { DisabledDropzone } from "@/registry/new-york-v4/blocks/dropzone-disabled-dropzone"
import { EvidenceTimeline } from "@/registry/new-york-v4/blocks/dropzone-evidence-timeline"
import { DefaultFileUploaderExample } from "@/registry/new-york-v4/blocks/dropzone-file-uploader-example"
import { DropzoneFileViewerExample } from "@/registry/new-york-v4/blocks/dropzone-file-viewer-example"
import { IntakeRouter } from "@/registry/new-york-v4/blocks/dropzone-intake-router"
import { MediaTranscriptQueue } from "@/registry/new-york-v4/blocks/dropzone-media-transcript-queue"
import { NativeButtonQueue } from "@/registry/new-york-v4/blocks/dropzone-native-button-queue"
import { NonButtonTrigger } from "@/registry/new-york-v4/blocks/dropzone-non-button-trigger"
import { PinboardDropSurface } from "@/registry/new-york-v4/blocks/dropzone-pinboard-drop-surface"
import { RequiredPacketSlots } from "@/registry/new-york-v4/blocks/dropzone-required-packet-slots"
import { SpreadsheetImportCard } from "@/registry/new-york-v4/blocks/dropzone-spreadsheet-import-card"
import { ValidationOnly } from "@/registry/new-york-v4/blocks/dropzone-validation-only"
import { EditViewerBlock } from "@/registry/new-york-v4/blocks/edit-viewer-block"
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block"
import { ExtractionViewerBlock } from "@/registry/new-york-v4/blocks/extraction-viewer-block"
import { FileSystemBlock } from "@/registry/new-york-v4/blocks/file-system-block"
import { FsLightBlock } from "@/registry/new-york-v4/blocks/fslight-block"
import { ImageSourcesBlock } from "@/registry/new-york-v4/blocks/image-sources-block"
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
  "dropzone-file-uploader": DefaultFileUploaderExample,
  "dropzone-file-viewer": DropzoneFileViewerExample,
  "dropzone-non-button-trigger": NonButtonTrigger,
  "dropzone-native-button-queue": NativeButtonQueue,
  "dropzone-controlled-queue": ControlledQueue,
  "dropzone-validation-only": ValidationOnly,
  "dropzone-custom-thumbnail-grid": CustomThumbnailGrid,
  "dropzone-media-transcript-queue": MediaTranscriptQueue,
  "dropzone-avatar-image-slot": AvatarImageSlot,
  "dropzone-spreadsheet-import": SpreadsheetImportCard,
  "dropzone-evidence-timeline": EvidenceTimeline,
  "dropzone-comparison-pair": ComparisonPairUpload,
  "dropzone-intake-router": IntakeRouter,
  "dropzone-required-packet": RequiredPacketSlots,
  "dropzone-pinboard": PinboardDropSurface,
  "dropzone-disabled": DisabledDropzone,
  "file-system": FileSystemBlock,
  fslight: FsLightBlock,
  "primitive-cards": PrimitiveCardsBlock,
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
