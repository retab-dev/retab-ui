"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A floating pill that reports the active field's source state over a viewer:
 * nothing selected, a located field (its path), or a field with no source.
 * Mount it inside a `relative` viewer pane.
 */
export function SourceIndicator({
  path,
  found,
  label = "Extraction",
  emptyHint = "Hover a field to view its source",
  className,
}: {
  /** The active field path, or null when nothing is selected. */
  path: string | null;
  /** Whether the active field has a resolvable source. */
  found: boolean;
  /** Leading label shown before the path. */
  label?: string;
  /** Text shown when no field is active. */
  emptyHint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-12 left-3 z-20 max-w-[calc(100%-1.5rem)]",
        className,
      )}
    >
      <div className="bg-background/85 flex h-7 items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 text-xs shadow-sm backdrop-blur-sm">
        {path == null ? (
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Search className="size-3.5 shrink-0" />
            {emptyHint}
          </span>
        ) : found ? (
          <span className="text-primary flex min-w-0 items-center gap-1.5">
            <Search className="size-3.5 shrink-0" />
            <span className="shrink-0 font-medium">{label}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-foreground truncate font-mono">{path}</span>
          </span>
        ) : (
          <span className="text-destructive flex min-w-0 items-center gap-1.5">
            <X className="size-3.5 shrink-0" />
            <span className="truncate font-mono">{path}</span>
            <span className="text-muted-foreground shrink-0">· no source</span>
          </span>
        )}
      </div>
    </div>
  );
}
