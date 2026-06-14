"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import { cn } from "@/lib/utils"
import type { FieldAnchorLink } from "@/components/ui/field-anchor-link"

import { AnchoredItemList } from "./anchored-item-list"
import {
  sourceFieldToEvidenceItem,
  type SourceEvidenceField,
  type SourceEvidenceItem,
} from "./source-evidence"

export interface SourceField extends Omit<SourceEvidenceField, "source"> {
  /** Join key — must match the anchored item id for this field. */
  key: string
  label: string
  value: React.ReactNode
  /** Optional small hint under the value (e.g. "Page 2", "Line 14", "Sheet 1 · B7"). */
  hint?: string
  source?: Source | null
}

/**
 * A simple field list that drives anchored document state: hovering a field
 * previews its anchor in the viewer, clicking selects it.
 */
export function SourceFieldList({
  fields,
  link,
  title = "Extracted fields",
  className,
}: {
  fields: SourceField[]
  link: FieldAnchorLink
  title?: string
  className?: string
}) {
  const titleId = React.useId()
  const evidenceItems = React.useMemo(
    () => fields.map(sourceFieldToEvidenceItem),
    [fields]
  )

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
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {fields.length} fields
        </span>
      </div>
      <AnchoredItemList
        aria-label={title}
        activeItemId={link.activePath}
        emptyLabel="No fields."
        items={evidenceItems}
        onActivateItem={(item) => link.selectField?.(item.id)}
        onClearPreview={() => link.onFieldHover(null)}
        onPreviewItem={(item) => link.onFieldHover(item.id)}
        renderItem={(item, state) => (
          <SourceFieldRow
            item={item}
            isActive={state.isActive}
            isDisabled={state.isDisabled}
          />
        )}
      />
    </div>
  )
}

function SourceFieldRow({
  isActive,
  isDisabled,
  item,
}: {
  isActive: boolean
  isDisabled: boolean
  item: SourceEvidenceItem
}) {
  const { hint, label, value } = item.payload

  return (
    <span
      className={cn(
        "flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
        isActive
          ? "border-primary/40 bg-primary/5"
          : "border-transparent hover:bg-muted/60",
        isDisabled && "hover:bg-transparent"
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
      {hint ? (
        <span className="text-[11px] text-muted-foreground/70">{hint}</span>
      ) : null}
      {item.anchor.status === "invalid" ? (
        <span className="text-[11px] text-destructive">
          {item.anchor.reason}
        </span>
      ) : null}
    </span>
  )
}
