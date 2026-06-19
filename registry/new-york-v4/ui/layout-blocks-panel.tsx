"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { InteractiveItemList } from "./interactive-item-list";
import {
  layoutLevelLabel,
  type LayoutEvidenceItem,
} from "./layout-blocks-model";

const ROW_ESTIMATE_SIZE = 84;

export function LayoutBlocksPanel({
  activeItemId,
  className,
  emptyLabel = "No layout items found.",
  items,
  onActiveItemIdChange,
  onNavigateItem,
  onSelectedItemIdChange,
  renderItemContent,
  selectedItemId,
}: {
  activeItemId?: string | null;
  className?: string;
  emptyLabel?: string;
  items: LayoutEvidenceItem[];
  onActiveItemIdChange?: (itemId: string | null) => void;
  onNavigateItem?: (
    item: LayoutEvidenceItem,
    options?: ScrollToOptions,
  ) => void;
  onSelectedItemIdChange?: (itemId: string | null) => void;
  renderItemContent?: (item: LayoutEvidenceItem) => React.ReactNode;
  selectedItemId?: string | null;
}) {
  return (
    <div
      data-slot="layout-blocks-panel"
      className={cn("bg-background flex min-h-0 flex-col", className)}
    >
      <InteractiveItemList
        aria-label="OCR blocks"
        activeItemId={activeItemId}
        emptyLabel={emptyLabel}
        estimateSize={ROW_ESTIMATE_SIZE}
        items={items}
        onActivateItem={(item) => {
          onSelectedItemIdChange?.(item.id);
          onNavigateItem?.(item, { behavior: "smooth" });
        }}
        onClearPreview={() => onActiveItemIdChange?.(null)}
        onClearSelection={() => onSelectedItemIdChange?.(null)}
        onPreviewItem={(item) => {
          onActiveItemIdChange?.(item.id);
          onNavigateItem?.(item, { behavior: "auto" });
        }}
        onVisibleItemChange={(item) => {
          onActiveItemIdChange?.(item.id);
          onNavigateItem?.(item, { behavior: "auto" });
        }}
        renderItem={(item, state) => (
          <LayoutItemRow
            item={item}
            isActive={state.isActive}
            isSelected={state.isSelected}
            renderItemContent={renderItemContent}
          />
        )}
        selectedItemId={selectedItemId}
      />
    </div>
  );
}

function LayoutItemRow({
  isActive,
  isSelected,
  item,
  renderItemContent,
}: {
  isActive: boolean;
  isSelected: boolean;
  item: LayoutEvidenceItem;
  renderItemContent?: (item: LayoutEvidenceItem) => React.ReactNode;
}) {
  const { confidence, pageNumber, text: rawText } = item.payload;
  const confidenceLabel =
    confidence == null ? "Unknown" : `${Math.round(confidence * 100)}%`;
  const text = rawText.replace(/\s+/g, " ").trim();

  return (
    <span
      className={cn(
        "bg-background hover:bg-muted/40 focus-visible:ring-ring block w-full rounded-lg border p-3 text-left transition-[background-color,border-color,box-shadow] outline-none focus-visible:ring-2",
        isActive && "border-primary/50 bg-primary/5",
        isSelected && "border-primary bg-primary/8 shadow-sm",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px] font-medium">
          {layoutLevelLabel(item.payload.level)}
        </span>
        <span
          className={cn(
            "text-[11px] font-medium",
            confidence != null && confidence < 0.9
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {confidenceLabel}
        </span>
        <span className="text-muted-foreground ml-auto text-[11px]">
          p. {pageNumber}
        </span>
      </div>
      <div className="text-foreground mt-2 text-sm leading-5">
        {renderItemContent ? (
          renderItemContent(item)
        ) : (
          <span className="line-clamp-3">{text || "Empty text"}</span>
        )}
      </div>
    </span>
  );
}
