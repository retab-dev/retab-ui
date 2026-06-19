"use client";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";
import { FileThumbnail } from "@/components/ui/file-thumbnail";

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function RequiredPacketSlots({ className }: DropzoneExampleProps) {
  return (
    <section className={cn("bg-background rounded-lg border p-4", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Required packet</div>
          <div className="text-muted-foreground mt-1 text-xs">
            Slot-level dropzones for checklist-driven uploads.
          </div>
        </div>
        <div className="bg-muted/30 text-muted-foreground rounded-full border px-2 py-1 text-xs">
          checklist
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {["Identity proof", "Bank statement", "Board approval"].map((label) => (
          <PacketSlot key={label} label={label} />
        ))}
      </div>
    </section>
  );
}

function PacketSlot({ label }: { label: string }) {
  const dropzone = useDropzone({
    accept: ".pdf,.png,.jpg,.jpeg,image/*,application/pdf",
    maxFiles: 1,
  });
  const selectedFile = dropzone.files[0];

  return (
    <div
      {...dropzone.getRootProps({
        className: cn(
          "min-h-44 rounded-md border border-dashed bg-muted/20 p-3 transition-colors",
          dropzone.isDragging && "border-foreground/40 bg-accent/35",
        ),
      })}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs font-medium">{label}</div>
        <div
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            selectedFile
              ? "bg-foreground text-background"
              : "bg-background text-muted-foreground",
          )}
        >
          {selectedFile ? "done" : "open"}
        </div>
      </div>
      {selectedFile ? (
        <div className="text-center">
          <FileThumbnail
            file={selectedFile.file}
            thumbnailShape="square"
            thumbnailSize="lg"
            className="bg-background mx-auto"
          />
          <div className="mt-2 line-clamp-2 text-xs font-medium break-words">
            {selectedFile.file.name}
          </div>
          <button
            type="button"
            className="bg-background text-muted-foreground hover:bg-muted hover:text-foreground mt-3 h-7 rounded-md border px-2 text-xs"
            onClick={dropzone.clearFiles}
          >
            Clear
          </button>
        </div>
      ) : (
        <div
          {...dropzone.getTriggerProps({
            className:
              "grid h-28 cursor-pointer place-items-center rounded-md bg-background text-center text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          Drop required file.
        </div>
      )}
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </div>
  );
}
