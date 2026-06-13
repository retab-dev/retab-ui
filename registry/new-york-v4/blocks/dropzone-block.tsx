"use client"

import { FileUploader } from "@/components/ui/file-uploader"
import { FileViewer } from "@/components/ui/file-viewer"

import {
  AvatarImageSlot,
  CustomThumbnailGrid,
  EvidenceTimeline,
  MediaTranscriptQueue,
  SpreadsheetImportCard,
} from "./dropzone-file-examples"
import {
  ControlledQueue,
  DisabledDropzone,
  NativeButtonQueue,
  NonButtonTrigger,
  ValidationOnly,
} from "./dropzone-trigger-examples"
import { DropzoneUploaderViewer } from "./dropzone-uploader-viewer"
import {
  ComparisonPairUpload,
  IntakeRouter,
  PinboardDropSurface,
  RequiredPacketSlots,
} from "./dropzone-workflow-examples"

export function DropzoneBlock() {
  return (
    <div className="h-full min-h-[760px] overflow-auto bg-background p-5">
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-4">
        <section className="col-span-12 xl:col-span-7">
          <FileUploader
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,text/csv"
            className="min-h-[28rem] justify-start pt-8"
            description="PDF, DOCX, XLSX, CSV, PNG, or JPG"
            maxFiles={6}
            multiple
            title="Default file uploader"
          />
        </section>
        <NonButtonTrigger className="col-span-12 md:col-span-6 xl:col-span-5" />
        <NativeButtonQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
        <ControlledQueue className="col-span-12 md:col-span-6 xl:col-span-4" />
        <ValidationOnly className="col-span-12 md:col-span-6 xl:col-span-4" />
        <CustomThumbnailGrid className="col-span-12 xl:col-span-8" />
        <DropzoneUploaderViewer
          className="col-span-12 xl:col-span-8"
          renderViewer={(source) => (
            <FileViewer
              source={source}
              bare
              className="h-[26rem] rounded-md border bg-background"
            />
          )}
        />
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
    </div>
  )
}
