"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Compact source status row: search icon plus an idle hint, or search icon plus
 * the active source path.
 */
export function SourceIndicator({
  path,
  emptyHint = "Hover a field to see its source",
  className,
}: {
  /** The active field path, or null when nothing is selected. */
  path: string | null;
  /** Whether the active field has a resolvable source. */
  found?: boolean;
  /** Leading label shown before the path. */
  label?: string;
  /** Text shown when no field is active. */
  emptyHint?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="source-indicator"
      className={cn(
        "pointer-events-none flex min-h-8 min-w-0 items-center px-3 py-1.5",
        className,
      )}
    >
      <div className="flex h-5 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-[3px] text-xs">
        <Search className="text-muted-foreground size-3.5 shrink-0" />
        {path == null ? (
          <span className="text-muted-foreground truncate">{emptyHint}</span>
        ) : (
          <span className="text-foreground truncate font-mono">{path}</span>
        )}
      </div>
    </div>
  );
}
