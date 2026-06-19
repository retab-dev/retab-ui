"use client";

import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";

import {
  InlineFileRows,
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function NonButtonTrigger({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: ".pdf,.csv,.txt,text/plain,text/csv,application/pdf",
    maxFiles: 3,
    multiple: true,
  });

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "rounded-lg border bg-muted/20 p-4 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
          className,
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="flex items-center gap-3">
        <div
          {...dropzone.getTriggerProps({
            className:
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-4" aria-hidden />
          Non-button trigger
        </div>
        <div className="min-w-0 text-sm">
          <div className="font-medium">Controls upload</div>
          <div className="text-muted-foreground truncate text-xs">
            {dropzone.files.length
              ? `${dropzone.files.length} attached`
              : "No files attached"}
          </div>
        </div>
      </div>
      <InlineFileRows files={dropzone.files} onRemove={dropzone.removeFile} />
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  );
}
