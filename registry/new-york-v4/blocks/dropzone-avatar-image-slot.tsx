"use client";

import { ImagePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";
import { FileThumbnail } from "@/components/ui/file-thumbnail";

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function AvatarImageSlot({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: "image/*,.png,.jpg,.jpeg,.webp",
    maxFiles: 1,
  });
  const selectedFile = dropzone.files[0];

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <ImagePlus className="text-muted-foreground size-4" aria-hidden />
            Avatar image slot
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            One image, replaceable by design.
          </div>
        </div>
        {selectedFile ? (
          <button
            className="bg-background hover:bg-muted h-8 rounded-md border px-3 text-xs font-medium"
            onClick={dropzone.clearFiles}
            type="button"
          >
            Remove
          </button>
        ) : null}
      </div>
      <div
        {...dropzone.getTriggerProps({
          className:
            "mt-4 grid min-h-44 cursor-pointer place-items-center rounded-md border border-dashed bg-background p-4 text-center outline-none transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/24",
        })}
      >
        {selectedFile ? (
          <div className="min-w-0">
            <FileThumbnail
              file={selectedFile.file}
              previewAspectRatio={1}
              className="mx-auto size-24 rounded-full"
            />
            <div className="mt-3 line-clamp-1 max-w-48 text-sm font-medium">
              {selectedFile.file.name}
            </div>
            <div className="text-muted-foreground text-xs">
              Click or drop to replace.
            </div>
          </div>
        ) : (
          <div>
            <ImagePlus className="text-muted-foreground mx-auto size-8" />
            <div className="mt-3 text-sm font-medium">Drop profile image</div>
            <div className="text-muted-foreground mt-1 text-xs">
              PNG, JPG, or WebP.
            </div>
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  );
}
