"use client";

import { FileText, X } from "lucide-react";

import type {
  DropzoneFileItem,
  DropzoneFileRejection,
} from "@/components/ui/dropzone";
import { formatFileSize } from "@/components/ui/file-size-format";

export type DropzoneExampleProps = {
  className?: string;
};

export function InlineFileRows({
  files,
  onRemove,
}: {
  files: DropzoneFileItem[];
  onRemove: (fileId: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="mt-3 space-y-1">
      {files.map((item) => (
        <div
          key={item.id}
          className="bg-background flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
        >
          <FileText className="text-muted-foreground size-3.5 shrink-0" />
          <div className="min-w-0 flex-1 truncate">{item.file.name}</div>
          <div className="text-muted-foreground shrink-0">
            {formatFileSize(item.file.size)}
          </div>
          <button
            type="button"
            aria-label={`Remove ${item.file.name}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-5 shrink-0 place-items-center rounded-[4px]"
            onClick={() => onRemove(item.id)}
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

export function RejectionRows({
  rejections,
}: {
  rejections: DropzoneFileRejection[];
}) {
  if (rejections.length === 0) return null;

  return (
    <div className="text-destructive mt-3 space-y-1 text-xs">
      {rejections.map((rejection) => (
        <div key={`${rejection.file.name}-${rejection.reason}`}>
          {rejection.file.name}: {getDropzoneRejectionMessage(rejection)}
        </div>
      ))}
    </div>
  );
}

function getDropzoneRejectionMessage(rejection: DropzoneFileRejection): string {
  if (rejection.reason === "file-invalid-type") {
    return "This file type is not supported here.";
  }
  if (rejection.reason === "file-too-large") {
    return `File must be ${formatFileSize(rejection.maxSize)} or smaller.`;
  }
  if (rejection.reason === "custom") {
    return rejection.code;
  }
  return rejection.maxFiles === 1
    ? "Only one file can be selected."
    : `Only ${rejection.maxFiles} files can be selected.`;
}
