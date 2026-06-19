"use client";

import {
  AvatarImageSlot,
  CustomThumbnailGrid,
  EvidenceTimeline,
  MediaTranscriptQueue,
  SpreadsheetImportCard,
} from "./dropzone-file-examples";
import { DefaultFileUploaderExample } from "./dropzone-file-uploader-example";
import { DropzoneFileViewerExample } from "./dropzone-file-viewer-example";
import {
  ControlledQueue,
  DisabledDropzone,
  NativeButtonQueue,
  NonButtonTrigger,
  ValidationOnly,
} from "./dropzone-trigger-examples";
import {
  ComparisonPairUpload,
  IntakeRouter,
  PinboardDropSurface,
  RequiredPacketSlots,
} from "./dropzone-workflow-examples";

export function DropzoneShowcase() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-12 gap-4">
      <DefaultFileUploaderExample className="col-span-12 xl:col-span-7" />
      <NonButtonTrigger className="col-span-12 md:col-span-6 xl:col-span-5" />
      <NativeButtonQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
      <ControlledQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
      <ValidationOnly className="col-span-12 md:col-span-6 xl:col-span-4" />
      <CustomThumbnailGrid className="col-span-12 xl:col-span-8" />
      <DropzoneFileViewerExample className="col-span-12 xl:col-span-8" />
      <MediaTranscriptQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
      <AvatarImageSlot className="col-span-12 md:col-span-6 xl:col-span-4" />
      <SpreadsheetImportCard className="col-span-12 md:col-span-6 xl:col-span-4" />
      <EvidenceTimeline className="col-span-12 xl:col-span-8" />
      <ComparisonPairUpload className="col-span-12 xl:col-span-6" />
      <IntakeRouter className="col-span-12 xl:col-span-6" />
      <RequiredPacketSlots className="col-span-12 xl:col-span-7" />
      <PinboardDropSurface className="col-span-12 xl:col-span-5" />
      <DisabledDropzone className="col-span-12 xl:col-span-4" />
    </div>
  );
}
