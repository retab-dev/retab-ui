"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

import { EDIT_FIELD_ACCENTS } from "./edit-viewer-field-style";
import {
  displayEditFieldValue,
  isEditFieldFilled,
  type EditViewerFieldGroup,
  type EditViewerFilter,
} from "./edit-viewer-model";
import type { EditViewerField } from "./edit-viewer-types";

export function EditViewerFieldPanel({
  className,
  fieldGroups,
  fieldCount,
  filledCount,
  visibleFieldCount,
  effectiveFieldKey,
  selectedFieldKey,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  onFieldHover,
  onFieldSelect,
  showSearch,
  showFilters,
  ...props
}: {
  fieldGroups: readonly EditViewerFieldGroup[];
  fieldCount: number;
  filledCount: number;
  visibleFieldCount: number;
  effectiveFieldKey: string | null;
  selectedFieldKey: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  filter: EditViewerFilter;
  onFilterChange: (filter: EditViewerFilter) => void;
  onFieldHover: (key: string | null) => void;
  onFieldSelect: (key: string) => void;
  showSearch: boolean;
  showFilters: boolean;
} & React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-edit-viewer-fields-panel
      className={cn("bg-background flex h-full min-h-0 flex-col", className)}
    >
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-3">
        <h2 className="px-1 text-sm font-medium">Form fields</h2>
        <span className="text-muted-foreground ml-auto pr-1 text-xs tabular-nums">
          <span className="text-success-foreground">{filledCount}</span>
          {" / "}
          {fieldCount} filled
        </span>
      </div>

      {(showSearch || showFilters) && (
        <div className="flex flex-shrink-0 flex-col gap-2 border-b px-3 py-2.5">
          {showSearch ? (
            <label className="relative block">
              <span className="sr-only">Search form fields</span>
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search key, description, value..."
                className="placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/20 h-7 w-full rounded-md border bg-transparent pr-2 pl-8 text-xs outline-none focus-visible:ring-[3px]"
              />
            </label>
          ) : null}

          {showFilters ? (
            <div className="flex flex-wrap items-center gap-1">
              {EDIT_VIEWER_FILTER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onFilterChange(value)}
                  aria-pressed={filter === value}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                    filter === value
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {visibleFieldCount === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-xs">
            No fields match.
          </p>
        ) : (
          fieldGroups.map((fieldGroup) => (
            <div key={fieldGroup.key}>
              <div className="bg-background/95 text-muted-foreground sticky top-0 z-10 flex items-center justify-between border-b px-4 py-1 text-[10px] font-medium tracking-wide uppercase backdrop-blur">
                <span>{fieldGroup.label}</span>
                <span className="tabular-nums">{fieldGroup.fields.length}</span>
              </div>
              {fieldGroup.fields.map((field) => (
                <EditViewerFieldRow
                  key={field.key}
                  field={field}
                  active={field.key === effectiveFieldKey}
                  selected={field.key === selectedFieldKey}
                  onFieldHover={onFieldHover}
                  onFieldSelect={onFieldSelect}
                />
              ))}
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

const EDIT_VIEWER_FILTER_OPTIONS: Array<{
  value: EditViewerFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "filled", label: "Filled" },
  { value: "empty", label: "Empty" },
  { value: "text", label: "Text" },
  { value: "checkbox", label: "Checkbox" },
  { value: "no_location", label: "No location" },
];

function EditViewerFieldRow({
  field,
  active,
  selected,
  onFieldHover,
  onFieldSelect,
}: {
  field: EditViewerField;
  active: boolean;
  selected: boolean;
  onFieldHover: (key: string | null) => void;
  onFieldSelect: (key: string) => void;
}) {
  const accent = EDIT_FIELD_ACCENTS[field.type];
  const filled = isEditFieldFilled(field);
  const value = displayEditFieldValue(field);

  return (
    <button
      type="button"
      onMouseEnter={() => onFieldHover(field.key)}
      onMouseLeave={() => onFieldHover(null)}
      onFocus={() => onFieldHover(field.key)}
      onBlur={() => onFieldHover(null)}
      onClick={() => onFieldSelect(field.key)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "border-border/60 focus-visible:ring-ring/20 flex w-full flex-col items-start gap-1 border-b px-4 py-2.5 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span
          className={cn(
            "h-3 w-0.5 flex-shrink-0 rounded-full transition-opacity",
            selected ? "opacity-100" : "opacity-0",
          )}
          style={{ backgroundColor: accent.line }}
        />
        <span className="text-foreground truncate font-mono text-[11px]">
          {field.key}
        </span>
        <span
          className={cn(
            "ml-auto flex-shrink-0 rounded border px-1.5 py-0 text-[9px] font-medium tracking-wide uppercase",
            accent.badge,
          )}
        >
          {field.type}
        </span>
      </div>
      {field.description ? (
        <span className="text-muted-foreground line-clamp-1 text-[11px]">
          {field.description}
        </span>
      ) : null}
      <span
        className={cn(
          "w-full truncate font-mono text-[11px]",
          filled
            ? "text-success-foreground"
            : "text-muted-foreground/50 italic",
        )}
      >
        {filled ? value : "- empty -"}
      </span>
    </button>
  );
}
