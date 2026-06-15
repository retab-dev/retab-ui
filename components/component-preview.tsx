import fs from "node:fs"
import path from "node:path"
import * as React from "react"

import { cn } from "@/lib/utils"
import { DocsViewCodeBlock } from "@/components/docs-code-block"
import { DropzoneDemo } from "@/components/dropzone-demo"
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
import { ValidationOnly } from "@/registry/new-york-v4/blocks/dropzone-validation-only"

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
