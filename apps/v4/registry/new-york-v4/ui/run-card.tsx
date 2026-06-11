"use client"

import * as React from "react"
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  FileThumbnail,
  type FileThumbnailProps,
} from "@/components/ui/file-thumbnail"

export type RunStatus = "queued" | "running" | "completed" | "failed"

const RUN_STATUS: Record<
  RunStatus,
  { label: string; icon: LucideIcon; tone: string; spin?: boolean }
> = {
  queued: { label: "Queued", icon: Clock, tone: "text-muted-foreground" },
  running: {
    label: "Running",
    icon: Loader2,
    tone: "text-amber-600 dark:text-amber-500",
    spin: true,
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-500",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    tone: "text-red-600 dark:text-red-500",
  },
}

export interface RunCardProps
  extends Pick<
    FileThumbnailProps,
    | "file"
    | "previewContent"
    | "previewImageUrl"
    | "previewAspectRatio"
    | "previewClassName"
    | "isLoading"
    | "hasError"
  > {
  /**
   * Replaces the single `FileThumbnail` with custom media in the same framed,
   * status-pilled slot — e.g. a bundle of per-subdocument thumbnails. The frame
   * still honors `previewAspectRatio`.
   */
  media?: React.ReactNode
  /** Lifecycle of the run — shown as a pill over the thumbnail. */
  status?: RunStatus
  /** Heading line; defaults to the file name. */
  title?: React.ReactNode
  /** Right-aligned metadata in the heading (e.g. the run kind or a timestamp). */
  meta?: React.ReactNode
  /** The run's result, rendered in the card body. */
  children?: React.ReactNode
  /** Makes the whole card a button. */
  onClick?: () => void
  className?: string
}

/**
 * A run card: a document thumbnail with a status pill, a heading, and a slot for
 * the run's result. It composes {@link FileThumbnail} for the preview surface —
 * pass a rendered page through `previewContent`, an image URL through
 * `previewImageUrl`, or let it fall back to the file-type placeholder — and
 * leaves the result rendering to its `children`, so the same card frames a
 * classification, a split, an extraction, or anything else.
 */
export function RunCard({
  file,
  previewContent,
  previewImageUrl,
  previewAspectRatio,
  previewClassName,
  isLoading,
  hasError,
  media,
  status,
  title,
  meta,
  children,
  onClick,
  className,
}: RunCardProps) {
  const interactive = typeof onClick === "function"
  // The body is optional — a card can be just media + overlays.
  const hasFooter = title != null || meta != null || children != null

  return (
    <div
      data-slot="run-card"
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        "group/run-card bg-card text-card-foreground flex flex-col overflow-hidden rounded-xl border transition-colors",
        interactive &&
          "hover:border-foreground/20 focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2",
        className
      )}
    >
      <div className="relative">
        {media ? (
          <div
            className="overflow-hidden border-b"
            style={{ aspectRatio: String(previewAspectRatio ?? 16 / 10) }}
          >
            {media}
          </div>
        ) : (
          <FileThumbnail
            file={file}
            previewContent={previewContent}
            previewImageUrl={previewImageUrl}
            previewClassName={previewClassName}
            previewAspectRatio={previewAspectRatio ?? 16 / 10}
            isLoading={isLoading}
            hasError={hasError}
            className="rounded-none border-0 border-b"
          />
        )}
        {status ? (
          <div className="absolute top-2 right-2">
            <RunStatusBadge status={status} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {title ?? file.name}
          </span>
          {meta ? (
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {meta}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  )
}

/** The status pill used in the corner of a {@link RunCard}. */
export function RunStatusBadge({
  status,
  className,
}: {
  status: RunStatus
  className?: string
}) {
  const { label, icon: Icon, tone, spin } = RUN_STATUS[status]
  return (
    <span
      className={cn(
        "bg-background/85 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur",
        tone,
        className
      )}
    >
      <Icon className={cn("size-3", spin && "animate-spin")} aria-hidden />
      {label}
    </span>
  )
}
