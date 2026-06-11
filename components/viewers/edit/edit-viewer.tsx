"use client";

import * as React from "react";
import { Check, Loader2, Pencil, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  PageOverlayProps,
  PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import type { FormField } from "@/components/viewers/lib/edit-types";

export type EditViewMode = "original" | "filled";

/**
 * Wiring handed to `renderDocument` so the host PDF viewer draws the field
 * overlays and stays scroll-synced with the panel. Spread it onto a
 * `<PdfViewer>`: `ref`, `renderPageOverlay`, and `onVisiblePageChange`.
 */
export interface EditDocumentContext {
  /** Whether the overlay should paint filled values or just the empty regions. */
  view: EditViewMode;
  viewerRef: React.RefObject<PdfViewerHandle | null>;
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode;
}

export interface EditViewerProps {
  detectedFields: FormField[];
  /** Whether a filled document is available (enables the "Filled" view). */
  hasFilled?: boolean;
  /** Whether the original document is available (enables the "Original" view). */
  hasOriginal?: boolean;
  isProcessing?: boolean;
  isDetecting?: boolean;
  /**
   * Render the source document. Receives the overlay renderer, a viewer ref, and
   * a page-change handler so the document and the field panel stay in sync. Omit
   * to show the field panel on its own.
   */
  renderDocument?: (ctx: EditDocumentContext) => React.ReactNode;
}

type Filter = "all" | "filled" | "empty";

// Text fields read blue, checkboxes read amber — the two accents the repo theme
// exposes that stay legible on light and dark page backgrounds alike.
const TYPE_ACCENT: Record<
  FormField["type"],
  { line: string; tint: string; text: string; badge: string }
> = {
  text: {
    line: "var(--color-chart-3)",
    tint: "color-mix(in oklab, var(--color-chart-3) 12%, transparent)",
    text: "var(--color-chart-4)",
    badge:
      "border-chart-3/30 bg-chart-3/10 text-chart-4 dark:text-chart-2",
  },
  checkbox: {
    line: "var(--color-amber-500)",
    tint: "color-mix(in oklab, var(--color-amber-500) 14%, transparent)",
    text: "var(--color-amber-600)",
    badge:
      "border-warning/30 bg-warning/10 text-warning-foreground",
  },
};

function isChecked(field: FormField) {
  return field.value === "true" || field.value === "checked";
}

/** A field carries a value when text is non-empty, or a checkbox is checked. */
function isFilled(field: FormField) {
  if (field.type === "checkbox") return isChecked(field);
  return Boolean(field.value && field.value.trim().length > 0);
}

function displayValue(field: FormField): string {
  if (field.type === "checkbox") return isChecked(field) ? "Checked" : "Unchecked";
  return field.value && field.value.trim().length > 0 ? field.value : "";
}

export function EditViewer({
  detectedFields,
  hasFilled = false,
  hasOriginal = false,
  isProcessing = false,
  isDetecting = false,
  renderDocument,
}: EditViewerProps) {
  const viewerRef = React.useRef<PdfViewerHandle>(null);

  const views = React.useMemo(() => {
    const v: EditViewMode[] = [];
    if (hasOriginal) v.push("original");
    if (hasFilled) v.push("filled");
    return v;
  }, [hasFilled, hasOriginal]);

  const [view, setView] = React.useState<EditViewMode>(
    hasFilled ? "filled" : "original",
  );
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  // Hover previews the highlight; the pinned selection persists underneath it.
  const effectiveKey = hoverKey ?? activeKey;

  const fieldByKey = React.useMemo(() => {
    const m = new Map<string, FormField>();
    for (const f of detectedFields) m.set(f.key, f);
    return m;
  }, [detectedFields]);

  const filledCount = React.useMemo(
    () => detectedFields.filter(isFilled).length,
    [detectedFields],
  );

  const selectField = React.useCallback(
    (key: string) => {
      setActiveKey(key);
      const field = fieldByKey.get(key);
      if (!field) return;
      const { bbox } = field;
      viewerRef.current?.scrollToPageArea(bbox.page, {
        top: bbox.top * 100,
        left: bbox.left * 100,
        width: bbox.width * 100,
        height: bbox.height * 100,
      });
    },
    [fieldByKey],
  );

  // One overlay layer per page: paint every field box on that page, lift the
  // active/hovered one, and stamp values in the "filled" view.
  const renderPageOverlay = React.useCallback(
    ({ pageNumber }: PageOverlayProps) => {
      const pageFields = detectedFields.filter((f) => f.bbox.page === pageNumber);
      if (pageFields.length === 0) return null;
      return (
        <>
          {pageFields.map((field) => {
            const accent = TYPE_ACCENT[field.type];
            const active = field.key === effectiveKey;
            const filled = isFilled(field);
            const showValue = view === "filled" && filled;
            return (
              <button
                key={field.key}
                type="button"
                onMouseEnter={() => setHoverKey(field.key)}
                onMouseLeave={() =>
                  setHoverKey((k) => (k === field.key ? null : k))
                }
                onClick={() => selectField(field.key)}
                className={cn(
                  "pointer-events-auto absolute flex items-center overflow-hidden rounded-[2px] border px-1 text-left transition-all",
                  active ? "z-10 border-2 shadow-sm" : "border-dashed",
                )}
                style={{
                  left: `${field.bbox.left * 100}%`,
                  top: `${field.bbox.top * 100}%`,
                  width: `${field.bbox.width * 100}%`,
                  height: `${field.bbox.height * 100}%`,
                  borderColor: accent.line,
                  backgroundColor: active
                    ? accent.tint
                    : showValue
                      ? "transparent"
                      : "transparent",
                  boxShadow: active
                    ? `0 0 0 3px color-mix(in oklab, ${accent.line} 22%, transparent)`
                    : undefined,
                }}
                aria-label={`${field.key}${filled ? `: ${displayValue(field)}` : ""}`}
              >
                {showValue && field.type === "checkbox" ? (
                  <Check
                    className="mx-auto size-3.5"
                    strokeWidth={3}
                    style={{ color: accent.text }}
                  />
                ) : showValue ? (
                  <span
                    className="truncate font-mono text-[10px] leading-none"
                    style={{ color: accent.text }}
                  >
                    {field.value}
                  </span>
                ) : null}
              </button>
            );
          })}
        </>
      );
    },
    [detectedFields, effectiveKey, view, selectField],
  );

  const hasOutput = detectedFields.length > 0 || hasFilled;
  const documentCtx: EditDocumentContext = {
    view,
    viewerRef,
    renderPageOverlay,
  };

  return (
    <div className="relative flex min-h-0 w-full flex-1 overflow-hidden bg-background">
      {(isDetecting || isProcessing) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {isDetecting ? "Detecting form fields..." : "Filling document..."}
            </span>
          </div>
        </div>
      )}

      {!hasOutput ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
          <Pencil className="size-16 text-muted-foreground/70" />
          <p className="text-center text-base">Run edit to see output</p>
          <p className="max-w-sm text-center text-sm text-muted-foreground/80">
            Upload a document, add filling instructions, and click Run Edit
          </p>
        </div>
      ) : (
        <>
          {renderDocument ? (
            <div className="relative min-w-0 flex-1">
              {renderDocument(documentCtx)}
            </div>
          ) : null}

          <FieldPanel
            fields={detectedFields}
            views={views}
            view={view}
            onViewChange={setView}
            filledCount={filledCount}
            effectiveKey={effectiveKey}
            activeKey={activeKey}
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            onHover={setHoverKey}
            onSelect={selectField}
            standalone={!renderDocument}
          />
        </>
      )}
    </div>
  );
}

// ── Field panel ───────────────────────────────────────────────────────────────

function FieldPanel({
  fields,
  views,
  view,
  onViewChange,
  filledCount,
  currentPage,
  effectiveKey,
  activeKey,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  onHover,
  onSelect,
  standalone,
}: {
  fields: FormField[];
  views: EditViewMode[];
  view: EditViewMode;
  onViewChange: (v: EditViewMode) => void;
  filledCount: number;
  effectiveKey: string | null;
  activeKey: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
  standalone: boolean;
}) {
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return fields.filter((f) => {
      if (filter === "filled" && !isFilled(f)) return false;
      if (filter === "empty" && isFilled(f)) return false;
      if (!q) return true;
      return (
        f.key.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        (f.value ?? "").toLowerCase().includes(q)
      );
    });
  }, [fields, query, filter]);

  // Group the visible fields by page, preserving document order within a page.
  const byPage = React.useMemo(() => {
    const groups = new Map<number, FormField[]>();
    for (const f of visible) {
      const list = groups.get(f.bbox.page) ?? [];
      list.push(f);
      groups.set(f.bbox.page, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  return (
    <aside
      className={cn(
        "flex flex-shrink-0 flex-col border-l bg-background",
        standalone ? "min-w-0 flex-1" : "w-[280px]",
      )}
    >
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-sm font-medium">Form fields</h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          <span className="text-success-foreground">{filledCount}</span>
          {" / "}
          {fields.length} filled
        </span>
      </div>

      <div className="flex flex-shrink-0 flex-col gap-2 border-b px-3 py-2.5">
        {views.length > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <Segmented
              options={views}
              value={view}
              onChange={onViewChange}
            />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              page {currentPage}
            </span>
          </div>
        ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search key, description, value…"
            className="h-7 w-full rounded-md border bg-transparent pl-8 pr-2 text-xs outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
          />
        </div>

        <div className="flex items-center gap-1">
          {(["all", "filled", "empty"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilterChange(f)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                filter === f
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No fields match.
          </p>
        ) : (
          byPage.map(([page, pageFields]) => (
            <div key={page}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
                <span>Page {page}</span>
                <span className="tabular-nums">{pageFields.length}</span>
              </div>
              {pageFields.map((field) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  active={field.key === effectiveKey}
                  pinned={field.key === activeKey}
                  onHover={onHover}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))
        )}
      </ScrollArea>
    </aside>
  );
}

function FieldRow({
  field,
  active,
  pinned,
  onHover,
  onSelect,
}: {
  field: FormField;
  active: boolean;
  pinned: boolean;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
}) {
  const accent = TYPE_ACCENT[field.type];
  const filled = isFilled(field);
  const value = displayValue(field);
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(field.key)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(field.key)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(field.key)}
      className={cn(
        "flex w-full flex-col items-start gap-1 border-b border-border/60 px-4 py-2.5 text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span
          className={cn(
            "h-3 w-0.5 flex-shrink-0 rounded-full transition-opacity",
            pinned ? "opacity-100" : "opacity-0",
          )}
          style={{ backgroundColor: accent.line }}
        />
        <span className="truncate font-mono text-[11px] text-foreground">
          {field.key}
        </span>
        <span
          className={cn(
            "ml-auto flex-shrink-0 rounded border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide",
            accent.badge,
          )}
        >
          {field.type}
        </span>
      </div>
      {field.description ? (
        <span className="line-clamp-1 text-[11px] text-muted-foreground">
          {field.description}
        </span>
      ) : null}
      <span
        className={cn(
          "w-full truncate font-mono text-[11px]",
          filled ? "text-success-foreground" : "text-muted-foreground/50 italic",
        )}
      >
        {filled ? value : "— empty —"}
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors",
            value === opt
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
