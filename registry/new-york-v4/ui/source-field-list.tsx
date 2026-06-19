"use client";

import * as React from "react";

import type { Source } from "@/lib/document-source";
import { cn } from "@/lib/utils";
import type { SourceFieldLink } from "@/components/ui/source-field-link";

import { InteractiveItemList } from "./interactive-item-list";
import {
  sourceFieldToEvidenceItem,
  type SourceEvidenceField,
  type SourceEvidenceItem,
} from "./source-evidence";

export interface SourceField extends Omit<SourceEvidenceField, "source"> {
  /** Join key used by the source field link for hover, selection, and navigation. */
  key: string;
  label: string;
  value: React.ReactNode;
  /** Optional small hint under the value (e.g. "Page 2", "Line 14", "Sheet 1 · B7"). */
  hint?: string;
  source?: Source | null;
}

/**
 * A simple field list that drives source-field interaction: hovering previews
 * the field location in the viewer, clicking selects it.
 */
export function SourceFieldList({
  fields,
  link,
  title = "Extracted fields",
  className,
}: {
  fields: SourceField[];
  link: SourceFieldLink;
  title?: string;
  className?: string;
}) {
  const titleId = React.useId();
  const evidenceItems = React.useMemo(
    () => fields.map(sourceFieldToEvidenceItem),
    [fields],
  );

  return (
    <div
      aria-labelledby={titleId}
      data-slot="source-field-list"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      <div className="flex h-10 flex-shrink-0 items-center border-b px-4">
        <h2 id={titleId} className="text-sm font-medium">
          {title}
        </h2>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {fields.length} fields
        </span>
      </div>
      <InteractiveItemList
        aria-label={title}
        activeItemId={link.activeSourcePath}
        emptyLabel="No fields."
        items={evidenceItems}
        onActivateItem={(item) => link.selectSourcePath?.(item.id)}
        onClearPreview={() => link.onSourceHover(null)}
        onPreviewItem={(item) => link.onSourceHover(item.id)}
        renderItem={(item, state) => (
          <SourceFieldRow
            item={item}
            isActive={state.isActive}
            isDisabled={state.isDisabled}
          />
        )}
      />
    </div>
  );
}

function SourceFieldRow({
  isActive,
  isDisabled,
  item,
}: {
  isActive: boolean;
  isDisabled: boolean;
  item: SourceEvidenceItem;
}) {
  const { hint, label, value } = item.payload;

  return (
    <span
      className={cn(
        "flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
        isActive
          ? "border-primary/40 bg-primary/5"
          : "hover:bg-muted/60 border-transparent",
        isDisabled && "hover:bg-transparent",
      )}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
      {hint ? (
        <span className="text-muted-foreground/70 text-[11px]">{hint}</span>
      ) : null}
      {item.anchor.status === "invalid" ? (
        <span className="text-destructive text-[11px]">
          {item.anchor.reason}
        </span>
      ) : null}
    </span>
  );
}
