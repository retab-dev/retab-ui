"use client";

import type { ComponentType } from "react";

import type { ViewerBlockId, ViewerBlockMetadata } from "@/lib/viewer-blocks";
import { ClassifyConsensusViewerBlock } from "@/registry/new-york-v4/blocks/classify-consensus-viewer-block";
import { CsvSourcesBlock } from "@/registry/new-york-v4/blocks/csv-sources-block";
import { DocxSourcesBlock } from "@/registry/new-york-v4/blocks/docx-sources-block";
import { AvatarImageSlot } from "@/registry/new-york-v4/blocks/dropzone-avatar-image-slot";
import { DropzoneBlock } from "@/registry/new-york-v4/blocks/dropzone-block";
import { ComparisonPairUpload } from "@/registry/new-york-v4/blocks/dropzone-comparison-pair-upload";
import { ControlledQueue } from "@/registry/new-york-v4/blocks/dropzone-controlled-queue";
import { CustomThumbnailGrid } from "@/registry/new-york-v4/blocks/dropzone-custom-thumbnail-grid";
import { DisabledDropzone } from "@/registry/new-york-v4/blocks/dropzone-disabled-dropzone";
import { EvidenceTimeline } from "@/registry/new-york-v4/blocks/dropzone-evidence-timeline";
import { DefaultFileUploaderExample } from "@/registry/new-york-v4/blocks/dropzone-file-uploader-example";
import { DropzoneFileViewerExample } from "@/registry/new-york-v4/blocks/dropzone-file-viewer-example";
import { IntakeRouter } from "@/registry/new-york-v4/blocks/dropzone-intake-router";
import { MediaTranscriptQueue } from "@/registry/new-york-v4/blocks/dropzone-media-transcript-queue";
import { NativeButtonQueue } from "@/registry/new-york-v4/blocks/dropzone-native-button-queue";
import { NonButtonTrigger } from "@/registry/new-york-v4/blocks/dropzone-non-button-trigger";
import { PinboardDropSurface } from "@/registry/new-york-v4/blocks/dropzone-pinboard-drop-surface";
import { RequiredPacketSlots } from "@/registry/new-york-v4/blocks/dropzone-required-packet-slots";
import { SpreadsheetImportCard } from "@/registry/new-york-v4/blocks/dropzone-spreadsheet-import-card";
import { UploadProgressQueue } from "@/registry/new-york-v4/blocks/dropzone-upload-progress-queue";
import { ValidationOnly } from "@/registry/new-york-v4/blocks/dropzone-validation-only";
import { EditViewerBlock } from "@/registry/new-york-v4/blocks/edit-viewer-block";
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block";
import { FileSystemBlock } from "@/registry/new-york-v4/blocks/file-system-block";
import { FsLightBlock } from "@/registry/new-york-v4/blocks/fslight-block";
import { ImageSourcesBlock } from "@/registry/new-york-v4/blocks/image-sources-block";
import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block";
import { OcrBlock } from "@/registry/new-york-v4/blocks/ocr-block";
import { ParseViewerBlock } from "@/registry/new-york-v4/blocks/parse-viewer-block";
import { PartitionViewerBlock } from "@/registry/new-york-v4/blocks/partition-viewer-block";
import { PdfThumbnailsBlock } from "@/registry/new-york-v4/blocks/pdf-thumbnails-block";
import { PrimitiveCardsBlock } from "@/registry/new-york-v4/blocks/primitive-cards-block";
import { SourcesViewerBlock } from "@/registry/new-york-v4/blocks/sources-viewer-block";
import { SplitConsensusDiagramHorizontalViewerBlock } from "@/registry/new-york-v4/blocks/split-consensus-diagram-horizontal-viewer-block";
import { SplitConsensusDiagramVerticalViewerBlock } from "@/registry/new-york-v4/blocks/split-consensus-diagram-vertical-viewer-block";
import { SplitConsensusLukasViewerBlock } from "@/registry/new-york-v4/blocks/split-consensus-lukas-viewer-block";
import { SplitViewerBlock } from "@/registry/new-york-v4/blocks/split-viewer-block";
import { TextSourcesBlock } from "@/registry/new-york-v4/blocks/text-sources-block";
import { XlsxSourcesBlock } from "@/registry/new-york-v4/blocks/xlsx-sources-block";

export type ViewerBlockComponent = ComponentType;
export type ViewerBlockWithComponent = ViewerBlockMetadata & {
  component: ViewerBlockComponent;
};

export const VIEWER_BLOCK_COMPONENTS = {
  ocr: OcrBlock,
  split: SplitViewerBlock,
  partition: PartitionViewerBlock,
  parse: ParseViewerBlock,
  edit: EditViewerBlock,
  "sources-viewer": SourcesViewerBlock,
  extract: ExtractViewerBlock,
  "image-sources": ImageSourcesBlock,
  "text-sources": TextSourcesBlock,
  "csv-sources": CsvSourcesBlock,
  "xlsx-sources": XlsxSourcesBlock,
  "docx-sources": DocxSourcesBlock,
  "json-form-sources": JsonFormSourcesBlock,
  dropzone: DropzoneBlock,
  "dropzone-file-uploader": DefaultFileUploaderExample,
  "dropzone-file-viewer": DropzoneFileViewerExample,
  "dropzone-non-button-trigger": NonButtonTrigger,
  "dropzone-native-button-queue": NativeButtonQueue,
  "dropzone-controlled-queue": ControlledQueue,
  "dropzone-validation-only": ValidationOnly,
  "dropzone-custom-thumbnail-grid": CustomThumbnailGrid,
  "dropzone-media-transcript-queue": MediaTranscriptQueue,
  "dropzone-upload-progress-queue": UploadProgressQueue,
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
  "split-consensus": SplitConsensusDiagramVerticalViewerBlock,
  "split-consensus-diagram-horizontal":
    SplitConsensusDiagramHorizontalViewerBlock,
  "split-consensus-lukas": SplitConsensusLukasViewerBlock,
  "classify-consensus": ClassifyConsensusViewerBlock,
} satisfies Record<ViewerBlockId, ViewerBlockComponent>;

export function getViewerBlockComponent(blockId: ViewerBlockId) {
  return VIEWER_BLOCK_COMPONENTS[blockId];
}

export function withViewerBlockComponent(
  block: ViewerBlockMetadata,
): ViewerBlockWithComponent {
  return {
    ...block,
    component: getViewerBlockComponent(block.id),
  };
}
