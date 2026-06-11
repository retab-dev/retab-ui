import { AlertCircle, FileText, Loader2, Pencil } from "lucide-react"

import type { EditViewerStatus } from "./edit-viewer-types"

export function EditViewerBusyOverlay({
  status,
}: {
  status: Extract<EditViewerStatus, { state: "detecting" | "filling" }>
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {status.message ??
            (status.state === "detecting"
              ? "Detecting form fields..."
              : "Filling document...")}
        </span>
      </div>
    </div>
  )
}

export function EmptyEditViewerState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
      <Pencil className="size-16 text-muted-foreground/70" />
      <p className="text-center text-base">Run edit to see output</p>
      <p className="max-w-sm text-center text-sm text-muted-foreground/80">
        Upload a document, add filling instructions, and click Run Edit
      </p>
    </div>
  )
}

export function NoDocumentState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 bg-muted px-6 text-center text-muted-foreground">
      <FileText className="size-10 text-muted-foreground/70" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function EditViewerErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 bg-muted px-6 text-center"
      role="alert"
    >
      <AlertCircle className="size-10 text-destructive" />
      <p className="max-w-md text-sm text-destructive">{message}</p>
    </div>
  )
}

export function EditViewerStatusBadge({
  status,
}: {
  status: Exclude<EditViewerStatus, { state: "idle" }>
}) {
  if (status.state === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
        <AlertCircle className="size-3" />
        {status.message}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      {status.message ??
        (status.state === "detecting"
          ? "Detecting fields"
          : "Filling document")}
    </span>
  )
}
