"use client";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";
import { FileThumbnail } from "@/components/ui/file-thumbnail";

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function PinboardDropSurface({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    maxFiles: 8,
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Pinboard drop surface</div>
          <div className="text-muted-foreground mt-1 text-xs">
            The whole canvas is the trigger.
          </div>
        </div>
        <button
          {...dropzone.getTriggerProps({
            native: true,
            className:
              "inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          Pin files
        </button>
      </div>
      <div
        {...dropzone.getTriggerProps({
          className:
            "grid min-h-72 cursor-pointer grid-cols-2 content-start gap-3 rounded-md border border-dashed bg-muted/20 p-3 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/24 sm:grid-cols-3",
        })}
      >
        {dropzone.files.length ? (
          dropzone.files.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "bg-background min-w-0 rounded-md border p-2 text-center shadow-xs",
                index % 2 === 0 && "translate-y-2",
                index % 3 === 0 && "-rotate-1",
                index % 3 === 1 && "rotate-1",
              )}
            >
              <FileThumbnail
                file={item.file}
                previewAspectRatio={1}
                className="mx-auto size-14"
              />
              <div className="mt-2 line-clamp-2 text-xs leading-tight break-words">
                {item.file.name}
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground col-span-full grid min-h-60 place-items-center text-center text-xs">
            Drop files to pin them onto the canvas.
          </div>
        )}
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  );
}
