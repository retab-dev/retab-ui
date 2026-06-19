import { AlertCircle, FileText, Loader2, Pencil } from "lucide-react";

import type { EditViewerStatus } from "./edit-viewer-types";

export function EditViewerBusyOverlay({
  status,
}: {
  status: Extract<EditViewerStatus, { state: "detecting" | "filling" }>;
}) {
  return (
    <div
      className="bg-background/80 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <span className="text-muted-foreground text-sm">
          {status.message ??
            (status.state === "detecting"
              ? "Detecting form fields..."
              : "Filling document...")}
        </span>
      </div>
    </div>
  );
}

export function EmptyEditViewerState() {
  return (
    <div className="bg-muted text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4 px-8">
      <Pencil className="text-muted-foreground/70 size-16" />
      <p className="text-center text-base">Run edit to see output</p>
      <p className="text-muted-foreground/80 max-w-sm text-center text-sm">
        Upload a document, add filling instructions, and click Run Edit
      </p>
    </div>
  );
}

export function NoDocumentState({ message }: { message: string }) {
  return (
    <div className="bg-muted text-muted-foreground flex h-full min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
      <FileText className="text-muted-foreground/70 size-10" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function EditViewerErrorState({ message }: { message: string }) {
  return (
    <div
      className="bg-muted flex h-full min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center"
      role="alert"
    >
      <AlertCircle className="text-destructive size-10" />
      <p className="text-destructive max-w-md text-sm">{message}</p>
    </div>
  );
}

export function EditViewerStatusBadge({
  status,
}: {
  status: Exclude<EditViewerStatus, { state: "idle" }>;
}) {
  if (status.state === "error") {
    return (
      <span className="border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
        <AlertCircle className="size-3" />
        {status.message}
      </span>
    );
  }

  return (
    <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
      <Loader2 className="size-3 animate-spin" />
      {status.message ??
        (status.state === "detecting"
          ? "Detecting fields"
          : "Filling document")}
    </span>
  );
}
