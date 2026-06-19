"use client";

import { Clock3, Paperclip, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";
import { formatFileSize } from "@/components/ui/file-size-format";
import { FileThumbnail } from "@/components/ui/file-thumbnail";

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function EvidenceTimeline({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    maxFiles: 6,
    multiple: true,
  });

  return (
    <section
      {...dropzone.getRootProps({
        className: cn(
          "rounded-lg border bg-background p-4 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
          className,
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock3 className="text-muted-foreground size-4" aria-hidden />
            Evidence timeline
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            Files become ordered events inside a custom surface.
          </div>
        </div>
        <button
          {...dropzone.getTriggerProps({
            native: true,
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Paperclip className="size-3.5" aria-hidden />
          Add evidence
        </button>
      </div>
      <div className="bg-muted/20 mt-4 grid min-h-44 auto-rows-min content-start items-start gap-3 rounded-md border border-dashed p-3 md:grid-cols-2">
        {dropzone.files.length ? (
          dropzone.files.map((item) => (
            <div
              key={item.id}
              className="bg-background flex h-16 min-w-0 items-center gap-3 rounded-md border p-2"
            >
              <FileThumbnail
                file={item.file}
                thumbnailShape="square"
                thumbnailSize="md"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {item.file.name}
                </div>
                <div className="text-muted-foreground text-xs">
                  {formatFileSize(item.file.size)}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-7 shrink-0 place-items-center rounded-md"
                onClick={() => dropzone.removeFile(item.id)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))
        ) : (
          <div
            {...dropzone.getTriggerProps({
              className:
                "col-span-full grid min-h-36 cursor-pointer place-items-center rounded-md bg-background text-center text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
            })}
          >
            Drop PDFs or images to build a case timeline.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  );
}
