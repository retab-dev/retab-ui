"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  useDropzone,
  type DropzoneFileItem,
} from "@/registry/new-york-v4/ui/dropzone";
import { formatFileSize } from "@/registry/new-york-v4/ui/file-size-format";

export function DropzoneDemo() {
  const [files, setFiles] = React.useState<DropzoneFileItem[]>([]);
  const dropzone = useDropzone({
    accept: "application/pdf,image/*,.docx,.xlsx,.csv",
    files,
    maxFiles: 3,
    onFilesChange: setFiles,
  });

  return (
    <div className="not-prose bg-card rounded-xl border p-4 shadow-sm sm:p-6">
      <div
        {...dropzone.getRootProps(
          dropzone.getTriggerProps({
            "data-slot": "dropzone",
            className: cn(
              "flex min-h-44 cursor-pointer flex-col justify-center rounded-lg border border-dashed bg-background p-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24",
              dropzone.isDragging && "border-foreground/40 bg-accent/35",
            ),
          }),
        )}
      >
        <input {...dropzone.getInputProps({ className: "hidden" })} />
        <div className="text-sm font-medium">Drop or browse files</div>
        <div className="text-muted-foreground mt-1 text-xs">
          Headless useDropzone controls this custom surface.
        </div>
        <div className="mt-4 space-y-1">
          {files.length ? (
            files.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate">
                  {item.file.name}
                </span>
                <span className="text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground text-xs">
              No files selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
