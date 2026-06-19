"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";
import { formatFileSize } from "@/components/ui/file-size-format";
import { FileThumbnail } from "@/components/ui/file-thumbnail";

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function ComparisonPairUpload({ className }: DropzoneExampleProps) {
  return (
    <section className={cn("bg-background rounded-lg border p-4", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Comparison pair</div>
          <div className="text-muted-foreground mt-1 text-xs">
            Two independent dropzones model original versus revision.
          </div>
        </div>
        <div className="bg-muted/30 text-muted-foreground rounded-full border px-2 py-1 text-xs">
          2 slots
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ComparisonSlot label="Original" />
        <ComparisonSlot label="Revision" />
      </div>
    </section>
  );
}

function ComparisonSlot({ label }: { label: string }) {
  const dropzone = useDropzone({
    accept: ".pdf,.doc,.docx,application/pdf",
    maxFiles: 1,
  });
  const selectedFile = dropzone.files[0];

  return (
    <div
      {...dropzone.getRootProps({
        className: cn(
          "rounded-md border border-dashed bg-muted/20 p-3 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{label}</div>
        <button
          {...dropzone.getTriggerProps({
            native: true,
            className:
              "inline-flex h-7 cursor-pointer items-center rounded-md border bg-background px-2 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          {selectedFile ? "Replace" : "Choose"}
        </button>
      </div>
      {selectedFile ? (
        <div className="bg-background flex min-w-0 items-center gap-3 rounded-md border p-2">
          <FileThumbnail
            file={selectedFile.file}
            thumbnailShape="square"
            thumbnailSize="md"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {selectedFile.file.name}
            </div>
            <div className="text-muted-foreground text-xs">
              {formatFileSize(selectedFile.file.size)}
            </div>
          </div>
          <button
            type="button"
            aria-label={`Remove ${selectedFile.file.name}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-7 shrink-0 place-items-center rounded-md"
            onClick={dropzone.clearFiles}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div
          {...dropzone.getTriggerProps({
            className:
              "grid min-h-24 cursor-pointer place-items-center rounded-md bg-background text-center text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          Drop {label.toLowerCase()} document.
        </div>
      )}
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </div>
  );
}
