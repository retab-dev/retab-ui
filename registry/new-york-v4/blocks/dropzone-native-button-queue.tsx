"use client";

import { Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";

import {
  InlineFileRows,
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function NativeButtonQueue({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: "image/*,.pdf",
    maxFiles: 2,
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Native button trigger</div>
          <div className="text-muted-foreground text-xs">
            A real button uses browser button semantics.
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
          Add
        </button>
      </div>
      <InlineFileRows files={dropzone.files} onRemove={dropzone.removeFile} />
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  );
}
