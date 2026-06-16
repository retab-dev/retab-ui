import fs from "node:fs"
import path from "node:path"
import * as React from "react"

import { cn } from "@/lib/utils"
import { CodeViewerDemo } from "@/components/code-viewer-demo"
import {
  CsvViewerDemo,
  CsvViewerStreamingDemo,
} from "@/components/csv-viewer-demo"
import { DataCellDemo } from "@/components/data-cell-demo"
import { DocsViewCodeBlock } from "@/components/docs-code-block"
import { DocxViewerDemo } from "@/components/docx-viewer-demo"
import { DropzoneDemo } from "@/components/dropzone-demo"
import { EmailViewerDemo } from "@/components/email-viewer-demo"
import { FileThumbnailDemo } from "@/components/file-thumbnail-demo"
import { FileThumbnailFormatsDemo } from "@/components/file-thumbnail-formats-demo"
import { FileViewerDemo } from "@/components/file-viewer-demo"
import { HtmlViewerDemo } from "@/components/html-viewer-demo"
import { ImageViewerDemo } from "@/components/image-viewer-demo"
import { JsonFormDemo } from "@/components/json-form-demo"
import { JsonTableDemo } from "@/components/json-table/json-table-demo"
import { MarkdownViewerDemo } from "@/components/markdown-viewer-demo"
import {
  LargeParseViewerDemo,
  ParseViewerDemo,
} from "@/components/parse-viewer-demo"
import { PdfViewerDemo } from "@/components/pdf-viewer-demo"
import { PptxViewerDemo } from "@/components/pptx-viewer-demo"
import { PretextMarkdownViewerDemo } from "@/components/pretext-markdown-viewer-demo"
import { PropertyFormDemo } from "@/components/property-form-demo"
import { RetabSchemaBuilderDemo } from "@/components/retab-schema-builder-demo"
import { ViewerSidebarDemo } from "@/components/sidebar-demo"
import { TextViewerDemo } from "@/components/text-viewer-demo"
import { XlsxViewerDemo } from "@/components/xlsx-viewer-demo"
import { AttachmentSidebarExample } from "@/registry/new-york-v4/blocks/attachment-sidebar-demo"
import { ClassificationViewerExample } from "@/registry/new-york-v4/blocks/classification-viewer-demo"
import { CodeViewerSyntaxDemo } from "@/registry/new-york-v4/blocks/code-viewer-syntax-demo"
import { AvatarImageSlot } from "@/registry/new-york-v4/blocks/dropzone-avatar-image-slot"
import { ComparisonPairUpload } from "@/registry/new-york-v4/blocks/dropzone-comparison-pair-upload"
import { ControlledQueue } from "@/registry/new-york-v4/blocks/dropzone-controlled-queue"
import { CustomThumbnailGrid } from "@/registry/new-york-v4/blocks/dropzone-custom-thumbnail-grid"
import { DisabledDropzone } from "@/registry/new-york-v4/blocks/dropzone-disabled-dropzone"
import { EvidenceTimeline } from "@/registry/new-york-v4/blocks/dropzone-evidence-timeline"
import { DropzoneFileViewerExample } from "@/registry/new-york-v4/blocks/dropzone-file-viewer-example"
import { IntakeRouter } from "@/registry/new-york-v4/blocks/dropzone-intake-router"
import { MediaTranscriptQueue } from "@/registry/new-york-v4/blocks/dropzone-media-transcript-queue"
import { NativeButtonQueue } from "@/registry/new-york-v4/blocks/dropzone-native-button-queue"
import { NonButtonTrigger } from "@/registry/new-york-v4/blocks/dropzone-non-button-trigger"
import { PinboardDropSurface } from "@/registry/new-york-v4/blocks/dropzone-pinboard-drop-surface"
import { RequiredPacketSlots } from "@/registry/new-york-v4/blocks/dropzone-required-packet-slots"
import { SpreadsheetImportCard } from "@/registry/new-york-v4/blocks/dropzone-spreadsheet-import-card"
import { UploadProgressQueue } from "@/registry/new-york-v4/blocks/dropzone-upload-progress-queue"
import { ValidationOnly } from "@/registry/new-york-v4/blocks/dropzone-validation-only"
import { FileViewerHeaderExample } from "@/registry/new-york-v4/blocks/file-viewer-header-demo"
import { PartitionViewerExample } from "@/registry/new-york-v4/blocks/partition-viewer-demo"
import { SchemaBuilderDefinitions } from "@/registry/new-york-v4/blocks/schema-builder-definitions"
import { SchemaBuilderReadOnly } from "@/registry/new-york-v4/blocks/schema-builder-read-only"
import { SegmentLegendSplit } from "@/registry/new-york-v4/blocks/segment-legend-split"
import { SegmentLegendVariants } from "@/registry/new-york-v4/blocks/segment-legend-variants"
import { SegmentSidebarExample } from "@/registry/new-york-v4/blocks/segment-sidebar-demo"
import { SegmentSidebarSplit } from "@/registry/new-york-v4/blocks/segment-sidebar-split"
import { SidebarListExample } from "@/registry/new-york-v4/blocks/sidebar-list-demo"
import { SplitViewerExample } from "@/registry/new-york-v4/blocks/split-viewer-demo"

/**
 * The shadcn-style example shape: a live component preview in a bordered card
 * with the example's real source code stacked directly below it behind a
 * "View Code" reveal. Server component — it reads the source file from disk at
 * build time (the docs pages are statically generated), exactly like
 * {@link ComponentSource}, so the code shown is always the file that renders.
 *
 * Register an example here once, then drop `<ComponentPreview name="…" />` into
 * any MDX page.
 */

type ComponentPreviewEntry = {
  component: React.ComponentType
  /** Source file path, relative to the app root. */
  src: string
}

const REGISTRY = {
  "dropzone-demo": {
    component: DropzoneDemo,
    src: "components/dropzone-demo.tsx",
  },
  "dropzone-non-button-trigger": {
    component: NonButtonTrigger,
    src: "registry/new-york-v4/blocks/dropzone-non-button-trigger.tsx",
  },
  "dropzone-native-button-queue": {
    component: NativeButtonQueue,
    src: "registry/new-york-v4/blocks/dropzone-native-button-queue.tsx",
  },
  "dropzone-controlled-queue": {
    component: ControlledQueue,
    src: "registry/new-york-v4/blocks/dropzone-controlled-queue.tsx",
  },
  "dropzone-validation-only": {
    component: ValidationOnly,
    src: "registry/new-york-v4/blocks/dropzone-validation-only.tsx",
  },
  "dropzone-disabled-dropzone": {
    component: DisabledDropzone,
    src: "registry/new-york-v4/blocks/dropzone-disabled-dropzone.tsx",
  },
  "dropzone-custom-thumbnail-grid": {
    component: CustomThumbnailGrid,
    src: "registry/new-york-v4/blocks/dropzone-custom-thumbnail-grid.tsx",
  },
  "dropzone-file-viewer-example": {
    component: DropzoneFileViewerExample,
    src: "registry/new-york-v4/blocks/dropzone-file-viewer-example.tsx",
  },
  "dropzone-avatar-image-slot": {
    component: AvatarImageSlot,
    src: "registry/new-york-v4/blocks/dropzone-avatar-image-slot.tsx",
  },
  "dropzone-spreadsheet-import-card": {
    component: SpreadsheetImportCard,
    src: "registry/new-york-v4/blocks/dropzone-spreadsheet-import-card.tsx",
  },
  "dropzone-media-transcript-queue": {
    component: MediaTranscriptQueue,
    src: "registry/new-york-v4/blocks/dropzone-media-transcript-queue.tsx",
  },
  "dropzone-upload-progress-queue": {
    component: UploadProgressQueue,
    src: "registry/new-york-v4/blocks/dropzone-upload-progress-queue.tsx",
  },
  "dropzone-evidence-timeline": {
    component: EvidenceTimeline,
    src: "registry/new-york-v4/blocks/dropzone-evidence-timeline.tsx",
  },
  "dropzone-comparison-pair-upload": {
    component: ComparisonPairUpload,
    src: "registry/new-york-v4/blocks/dropzone-comparison-pair-upload.tsx",
  },
  "dropzone-intake-router": {
    component: IntakeRouter,
    src: "registry/new-york-v4/blocks/dropzone-intake-router.tsx",
  },
  "dropzone-required-packet-slots": {
    component: RequiredPacketSlots,
    src: "registry/new-york-v4/blocks/dropzone-required-packet-slots.tsx",
  },
  "dropzone-pinboard-drop-surface": {
    component: PinboardDropSurface,
    src: "registry/new-york-v4/blocks/dropzone-pinboard-drop-surface.tsx",
  },
  "schema-builder-read-only": {
    component: SchemaBuilderReadOnly,
    src: "registry/new-york-v4/blocks/schema-builder-read-only.tsx",
  },
  "schema-builder-definitions": {
    component: SchemaBuilderDefinitions,
    src: "registry/new-york-v4/blocks/schema-builder-definitions.tsx",
  },
  "schema-builder-demo": {
    component: RetabSchemaBuilderDemo,
    src: "components/retab-schema-builder-demo.tsx",
  },
  "property-form-demo": {
    component: PropertyFormDemo,
    src: "components/property-form-demo.tsx",
  },
  "data-cell-demo": {
    component: DataCellDemo,
    src: "components/data-cell-demo.tsx",
  },
  "file-viewer-demo": {
    component: FileViewerDemo,
    src: "components/file-viewer-demo.tsx",
  },
  "pdf-viewer-demo": {
    component: PdfViewerDemo,
    src: "components/pdf-viewer-demo.tsx",
  },
  "docx-viewer-demo": {
    component: DocxViewerDemo,
    src: "components/docx-viewer-demo.tsx",
  },
  "image-viewer-demo": {
    component: ImageViewerDemo,
    src: "components/image-viewer-demo.tsx",
  },
  "pptx-viewer-demo": {
    component: PptxViewerDemo,
    src: "components/pptx-viewer-demo.tsx",
  },
  "xlsx-viewer-demo": {
    component: XlsxViewerDemo,
    src: "components/xlsx-viewer-demo.tsx",
  },
  "csv-viewer-demo": {
    component: CsvViewerDemo,
    src: "components/csv-viewer-demo.tsx",
  },
  "csv-viewer-streaming-demo": {
    component: CsvViewerStreamingDemo,
    src: "components/csv-viewer-demo.tsx",
  },
  "code-viewer-demo": {
    component: CodeViewerDemo,
    src: "components/code-viewer-demo.tsx",
  },
  "code-viewer-syntax-demo": {
    component: CodeViewerSyntaxDemo,
    src: "registry/new-york-v4/blocks/code-viewer-syntax-demo.tsx",
  },
  "text-viewer-demo": {
    component: TextViewerDemo,
    src: "components/text-viewer-demo.tsx",
  },
  "markdown-viewer-demo": {
    component: MarkdownViewerDemo,
    src: "components/markdown-viewer-demo.tsx",
  },
  "pretext-markdown-viewer-demo": {
    component: PretextMarkdownViewerDemo,
    src: "components/pretext-markdown-viewer-demo.tsx",
  },
  "html-viewer-demo": {
    component: HtmlViewerDemo,
    src: "components/html-viewer-demo.tsx",
  },
  "email-viewer-demo": {
    component: EmailViewerDemo,
    src: "components/email-viewer-demo.tsx",
  },
  "file-thumbnail-demo": {
    component: FileThumbnailDemo,
    src: "components/file-thumbnail-demo.tsx",
  },
  "file-thumbnail-formats-demo": {
    component: FileThumbnailFormatsDemo,
    src: "components/file-thumbnail-formats-demo.tsx",
  },
  "json-form-demo": {
    component: JsonFormDemo,
    src: "components/json-form-demo.tsx",
  },
  "json-table-demo": {
    component: JsonTableDemo,
    src: "components/json-table/json-table-demo.tsx",
  },
  "viewer-sidebar-demo": {
    component: ViewerSidebarDemo,
    src: "components/sidebar-demo.tsx",
  },
  "attachment-sidebar-demo": {
    component: AttachmentSidebarExample,
    src: "registry/new-york-v4/blocks/attachment-sidebar-demo.tsx",
  },
  "file-viewer-header-demo": {
    component: FileViewerHeaderExample,
    src: "registry/new-york-v4/blocks/file-viewer-header-demo.tsx",
  },
  "sidebar-list-demo": {
    component: SidebarListExample,
    src: "registry/new-york-v4/blocks/sidebar-list-demo.tsx",
  },
  "partition-viewer-demo": {
    component: PartitionViewerExample,
    src: "registry/new-york-v4/blocks/partition-viewer-demo.tsx",
  },
  "classification-viewer-demo": {
    component: ClassificationViewerExample,
    src: "registry/new-york-v4/blocks/classification-viewer-demo.tsx",
  },
  "split-viewer-demo": {
    component: SplitViewerExample,
    src: "registry/new-york-v4/blocks/split-viewer-demo.tsx",
  },
  "parse-viewer-demo": {
    component: ParseViewerDemo,
    src: "components/parse-viewer-demo.tsx",
  },
  "large-parse-viewer-demo": {
    component: LargeParseViewerDemo,
    src: "components/parse-viewer-demo.tsx",
  },
  "segment-legend-variants": {
    component: SegmentLegendVariants,
    src: "registry/new-york-v4/blocks/segment-legend-variants.tsx",
  },
  "segment-legend-split": {
    component: SegmentLegendSplit,
    src: "registry/new-york-v4/blocks/segment-legend-split.tsx",
  },
  "segment-sidebar-demo": {
    component: SegmentSidebarExample,
    src: "registry/new-york-v4/blocks/segment-sidebar-demo.tsx",
  },
  "segment-sidebar-split": {
    component: SegmentSidebarSplit,
    src: "registry/new-york-v4/blocks/segment-sidebar-split.tsx",
  },
} satisfies Record<string, ComponentPreviewEntry>

export type ComponentPreviewName = keyof typeof REGISTRY

export function ComponentPreview({
  name,
  className,
  contentClassName,
}: {
  name: ComponentPreviewName
  className?: string
  contentClassName?: string
}) {
  const entry = REGISTRY[name]

  if (!entry) {
    throw new Error(`ComponentPreview: unknown component "${name}".`)
  }

  const Component = entry.component
  const code = fs
    .readFileSync(path.join(process.cwd(), entry.src), "utf-8")
    .trimEnd()

  return (
    <div
      data-slot="component-preview"
      className={cn(
        "not-prose group relative my-6 flex flex-col overflow-hidden rounded-xl border",
        className
      )}
    >
      <div className={cn("flex flex-col bg-background p-6", contentClassName)}>
        <Component />
      </div>
      <DocsViewCodeBlock
        code={code}
        fileName={entry.src.split("/").pop()}
        language="tsx"
      />
    </div>
  )
}
