"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
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

function DropzoneDocsGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("not-prose my-6 grid gap-4", className)}>{children}</div>
  )
}

export function DropzoneTriggerExamples() {
  return (
    <DropzoneDocsGrid className="md:grid-cols-2">
      <NonButtonTrigger />
      <NativeButtonQueue />
      <ControlledQueue />
      <ValidationOnly />
      <DisabledDropzone />
    </DropzoneDocsGrid>
  )
}

export function DropzoneFileExamples() {
  return (
    <DropzoneDocsGrid>
      <CustomThumbnailGrid />
      <DropzoneFileViewerExample />
      <div className="grid gap-4 md:grid-cols-2">
        <AvatarImageSlot />
        <SpreadsheetImportCard />
      </div>
      <MediaTranscriptQueue />
    </DropzoneDocsGrid>
  )
}

export function DropzoneWorkflowExamples() {
  return (
    <DropzoneDocsGrid>
      <EvidenceTimeline />
      <ComparisonPairUpload />
      <IntakeRouter />
      <RequiredPacketSlots />
      <PinboardDropSurface />
    </DropzoneDocsGrid>
  )
}
