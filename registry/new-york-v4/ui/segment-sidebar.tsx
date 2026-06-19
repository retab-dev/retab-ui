"use client";

import * as React from "react";

import {
  getSegmentInteractionState,
  getSegmentSurfaceProps,
  scopeSegmentInteraction,
  type SegmentInteraction,
} from "@/lib/segment-interaction";
import {
  formatPageRanges,
  segmentDisplayLabel,
  segmentPageCount,
} from "@/lib/segments";
import { cn } from "@/lib/utils";

import type { DocumentSegment } from "./segmented-document-model";
import {
  SidebarListButton,
  SidebarListContent,
  SidebarListGroup,
  SidebarListGroupContent,
  SidebarListGroupLabel,
  SidebarListMenu,
  SidebarListMenuItem,
  SidebarListRoot,
} from "./sidebar-list";

export interface SegmentSidebarProps {
  segments: DocumentSegment[];
  /** Shared preview state. */
  interaction?: SegmentInteraction;
  /** Fired when a segment surface is clicked, after transient preview is cleared. */
  onSelect?: (segment: DocumentSegment) => void;
  /** 1-based current page; owning segments receive current-page state. */
  currentPage?: number | null;
  /** Noun for a row, e.g. "chunk" (partition) or "subdocument" (split). */
  unitLabel?: string;
  /** Show segments with zero pages too. */
  showUnused?: boolean;
  className?: string;
}

/**
 * A navigable list of segments — the "sidebar" surface. Each row shows the
 * color swatch, label, page ranges, page count, and (when present) a confidence
 * bar. Hovering previews the segment; clicking fires `onSelect` for host side
 * effects like document scrolling.
 */
export function SegmentSidebar({
  segments,
  interaction,
  onSelect,
  currentPage,
  unitLabel = "segment",
  showUnused = true,
  className,
}: SegmentSidebarProps) {
  const visible = showUnused
    ? segments
    : segments.filter((s) => segmentPageCount(s.pages) > 0);
  const scopedInteraction = React.useMemo(
    () =>
      scopeSegmentInteraction(
        interaction,
        visible.map((segment) => segment.id),
      ),
    [interaction, visible],
  );
  const interactionState = React.useMemo(
    () =>
      getSegmentInteractionState({
        segments: visible,
        currentPage,
        interaction: scopedInteraction,
      }),
    [currentPage, scopedInteraction, visible],
  );

  return (
    <div
      data-slot="segment-sidebar"
      onMouseLeave={() => scopedInteraction?.clearPreview()}
      className={cn("flex min-h-0 flex-col", className)}
    >
      <SidebarListRoot className="w-full bg-transparent">
        <SidebarListContent className="gap-0">
          <SidebarListGroup className="min-h-0 flex-1 p-2">
            <SidebarListGroupLabel className="px-1">
              {visible.length} {unitLabel}
              {visible.length === 1 ? "" : "s"}
            </SidebarListGroupLabel>
            <SidebarListGroupContent className="min-h-0 flex-1">
              <SidebarListMenu className="gap-0.5">
                {visible.map((segment, segmentPosition) => (
                  <SegmentSidebarItem
                    key={`${segment.id}-${segmentPosition}`}
                    segment={segment}
                    interaction={scopedInteraction ?? undefined}
                    interactionState={interactionState}
                    onSelect={onSelect}
                  />
                ))}
              </SidebarListMenu>
            </SidebarListGroupContent>
          </SidebarListGroup>
        </SidebarListContent>
      </SidebarListRoot>
    </div>
  );
}

function SegmentSidebarItem({
  segment,
  interaction,
  interactionState,
  onSelect,
}: {
  segment: DocumentSegment;
  interaction: SegmentInteraction | undefined;
  interactionState: ReturnType<typeof getSegmentInteractionState>;
  onSelect: ((segment: DocumentSegment) => void) | undefined;
}) {
  const { state, eventHandlers, dataProps } = getSegmentSurfaceProps({
    segment,
    interaction,
    interactionState,
    onSelect,
  });
  const label = segmentDisplayLabel(segment.label);
  const pageCount = segmentPageCount(segment.pages);

  return (
    <SidebarListMenuItem>
      <SidebarListButton
        {...dataProps}
        {...eventHandlers}
        aria-current={state.isCurrent ? "page" : undefined}
        className={cn(
          "h-auto items-start gap-2.5 rounded-md border px-2.5 py-2",
          "data-[active=true]:border-sidebar-border",
          state.isHighlighted
            ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
            : "border-transparent",
          state.isDimmed && "opacity-60",
        )}
        isActive={state.isHighlighted}
      >
        <span
          aria-hidden
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-[3px] ring-1 ring-black/20"
          style={{ backgroundColor: segment.color }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {segment.label.trim() ? (
              label
            ) : (
              <span className="text-muted-foreground italic">unnamed</span>
            )}
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            {pageCount === 0
              ? "no pages"
              : `${pageCount} page${
                  pageCount === 1 ? "" : "s"
                } · ${formatPageRanges(segment.pages)}`}
          </span>
          {segment.confidence != null ? (
            <ConfidenceBar value={segment.confidence} />
          ) : null}
        </span>
      </SidebarListButton>
    </SidebarListMenuItem>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const pct = Math.round(Math.max(0, Math.min(1, safeValue)) * 100);
  return (
    <span className="mt-0.5 flex items-center gap-1.5">
      <span className="bg-muted-foreground/20 h-1 w-16 overflow-hidden rounded-full">
        <span
          className="bg-foreground/60 block h-full rounded-full"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-muted-foreground text-[10px] tabular-nums">
        {pct}%
      </span>
    </span>
  );
}
