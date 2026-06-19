"use client";

import { Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDropzone, type DropzoneFileItem } from "@/components/ui/dropzone";
import { FileThumbnail } from "@/components/ui/file-thumbnail";

import {
  RejectionRows,
  type DropzoneExampleProps,
} from "./dropzone-example-shared";

export function IntakeRouter({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({
    accept:
      ".pdf,.doc,.docx,.csv,.xls,.xlsx,.png,.jpg,.jpeg,image/*,application/pdf,text/csv",
    maxFiles: 12,
    multiple: true,
  });
  const groups = getRoutedFiles(dropzone.files);

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Intake router</div>
          <div className="text-muted-foreground mt-1 text-xs">
            One target, derived lanes by file type.
          </div>
        </div>
        <button
          {...dropzone.getTriggerProps({
            native: true,
            className:
              "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/24",
          })}
        >
          <Upload className="size-3.5" aria-hidden />
          Add batch
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RoutedLane
          label="Documents"
          files={groups.documents}
          onRemove={dropzone.removeFile}
        />
        <RoutedLane
          label="Images"
          files={groups.images}
          onRemove={dropzone.removeFile}
        />
        <RoutedLane
          label="Tables"
          files={groups.tables}
          onRemove={dropzone.removeFile}
        />
      </div>
      <RejectionRows rejections={dropzone.lastIntake.fileRejections} />
    </section>
  );
}

function getRoutedFiles(files: DropzoneFileItem[]) {
  const groups = {
    documents: [] as DropzoneFileItem[],
    images: [] as DropzoneFileItem[],
    tables: [] as DropzoneFileItem[],
  };

  for (const item of files) {
    const fileName = item.file.name.toLowerCase();
    const fileType = item.file.type;

    if (
      fileType.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|heic)$/.test(fileName)
    ) {
      groups.images.push(item);
    } else if (
      fileType.includes("spreadsheet") ||
      fileType === "text/csv" ||
      /\.(csv|xls|xlsx)$/.test(fileName)
    ) {
      groups.tables.push(item);
    } else {
      groups.documents.push(item);
    }
  }

  return groups;
}

function RoutedLane({
  files,
  label,
  onRemove,
}: {
  files: DropzoneFileItem[];
  label: string;
  onRemove: (fileId: string) => void;
}) {
  return (
    <div className="bg-muted/20 min-h-44 rounded-md border border-dashed p-2">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{files.length}</span>
      </div>
      {files.length ? (
        <div className="space-y-2">
          {files.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="bg-background flex min-w-0 items-center gap-2 rounded-md border p-2"
            >
              <FileThumbnail
                file={item.file}
                thumbnailShape="square"
                thumbnailSize="xs"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1 truncate text-xs font-medium">
                {item.file.name}
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 shrink-0 place-items-center rounded-md"
                onClick={() => onRemove(item.id)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {files.length > 3 ? (
            <div className="text-muted-foreground text-center text-xs">
              +{files.length - 3} more
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-muted-foreground grid h-32 place-items-center text-center text-xs">
          No {label.toLowerCase()} yet.
        </div>
      )}
    </div>
  );
}
