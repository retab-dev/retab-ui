"use client";

import { FileUploader } from "@/components/ui/file-uploader";

import { type DropzoneExampleProps } from "./dropzone-example-shared";

export function DefaultFileUploaderExample({
  className,
}: DropzoneExampleProps) {
  return (
    <section className={className}>
      <FileUploader
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,text/csv"
        className="min-h-[28rem] justify-start pt-8"
        description="PDF, DOCX, XLSX, CSV, PNG, or JPG"
        maxFiles={6}
        multiple
        title="Default file uploader"
      />
    </section>
  );
}
