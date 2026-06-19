"use client";

import type React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  SEGMENT_PALETTE,
  segmentsPageCount,
  type Segment,
} from "@/lib/segments";
import { FileThumbnail } from "@/components/ui/file-thumbnail";
import { PageRibbon, type RibbonRow } from "@/components/ui/page-ribbon";
import { RunCard, type RunStatus } from "@/components/ui/run-card";
import { SegmentLegend } from "@/components/ui/segment-legend";
import type { Source, SourceAnchor } from "@/lib/document-source";

/**
 * Prop-driven primitive run cards — one card per Retab primitive (classify,
 * split, partition, parse, extract), each framing the source document with that
 * primitive's result over the shared {@link RunCard} shell. Presentational: the
 * caller resolves the result (a category, `Segment[]`, markdown, or extract
 * fields) and passes it in, so the same cards render a static demo or a live
 * workflow run's per-block result.
 */

// The sample pages are US-Letter; one page aspect lets coordinate-anchored
// overlays (the extract source boxes) map onto the cropped thumbnail.
const PAGE_ASPECT = 800 / 1036;

export type PrimitiveRunCardFile = { name: string; type: string };

interface PrimitiveRunCardBase {
  /** Source document the run was over. */
  file: PrimitiveRunCardFile;
  /** Run lifecycle pill; defaults to "completed". */
  status?: RunStatus | null;
  /** Makes the whole card a button. */
  onClick?: () => void;
}

// ── Classification ────────────────────────────────────────────────────────────

export interface ClassificationRunCardProps extends PrimitiveRunCardBase {
  /** Page image rendered behind the result. */
  previewImageUrl?: string;
  /**
   * Custom media rendered in the shared RunCard frame. Use this when a consumer
   * owns document loading/cropping behavior but still wants the shared
   * classification footer and run-card shell.
   */
  media?: React.ReactNode;
  /** Aspect ratio for custom media; defaults to the RunCard media frame. */
  mediaAspectRatio?: number;
  category: string;
  reasoning?: string;
}

export function ClassificationRunCard({
  file,
  previewImageUrl,
  media,
  mediaAspectRatio,
  category,
  reasoning,
  status = "completed",
  onClick,
}: ClassificationRunCardProps) {
  const defaultMedia = previewImageUrl ? (
    <FillThumbnail file={file} src={previewImageUrl} />
  ) : undefined;

  return (
    <RunCard
      file={file}
      status={status ?? undefined}
      onClick={onClick}
      previewAspectRatio={mediaAspectRatio}
      media={media ?? defaultMedia}
    >
      <div className="space-y-2 p-3">
        <div className="bg-background inline-flex min-h-7 max-w-full items-center rounded-md border px-2.5 text-sm font-medium">
          <span className="truncate">{category}</span>
        </div>
        {reasoning ? (
          <p className="text-muted-foreground line-clamp-3 text-xs">
            {reasoning}
          </p>
        ) : null}
      </div>
    </RunCard>
  );
}

// ── Split ─────────────────────────────────────────────────────────────────────

export interface SplitRunCardProps extends PrimitiveRunCardBase {
  /** First-page image shown beside the page rail. */
  previewImageUrl: string;
  /** Subdocuments as the shared segment model. */
  segments: Segment[];
}

export function SplitRunCard({
  file,
  previewImageUrl,
  segments,
  status = "completed",
  onClick,
}: SplitRunCardProps) {
  return (
    <RunCard
      file={file}
      status={status ?? undefined}
      onClick={onClick}
      media={
        <SplitMiniViewer
          file={file}
          previewImageUrl={previewImageUrl}
          segments={segments}
        />
      }
    >
      <SegmentLegend
        variant="plain"
        density="compact"
        columns={2}
        segments={segments}
      />
    </RunCard>
  );
}

/**
 * A mini split viewer: the document's first page with a vertical, color-keyed
 * page rail beside it — each subdocument is a colored block spanning its page
 * range, shrunk to fit the card's media frame.
 */
function SplitMiniViewer({
  file,
  previewImageUrl,
  segments,
}: {
  file: PrimitiveRunCardFile;
  previewImageUrl: string;
  segments: Segment[];
}) {
  const pageCount = segmentsPageCount(segments);

  return (
    <div className="bg-muted/30 flex size-full">
      <div className="bg-background flex h-full shrink-0 border-r px-2 py-3">
        <PageRibbon
          orientation="vertical"
          rows={[{ id: "split", segments }]}
          pageCount={pageCount}
          rowThickness={12}
        />
      </div>
      <div className="relative min-w-0 flex-1">
        <FillThumbnail file={file} src={previewImageUrl} />
      </div>
    </div>
  );
}

// ── Partition ─────────────────────────────────────────────────────────────────

export interface PartitionRunCardProps extends PrimitiveRunCardBase {
  previewImageUrl: string;
  /** Keyed chunks as the shared segment model. */
  segments: Segment[];
}

export function PartitionRunCard({
  file,
  previewImageUrl,
  segments,
  status = "completed",
  onClick,
}: PartitionRunCardProps) {
  const pageCount = segmentsPageCount(segments);
  // One ribbon lane per chunk over a shared page axis, so chunks that share a
  // page (e.g. method + experiments on page 4) read as an overlap.
  const rows: RibbonRow[] = segments.map((segment) => ({
    id: segment.id,
    label: segment.label,
    segments: [segment],
  }));

  return (
    <RunCard
      file={file}
      status={status ?? undefined}
      onClick={onClick}
      media={<FillThumbnail file={file} src={previewImageUrl} />}
    >
      <div className="space-y-2">
        <SegmentLegend
          variant="plain"
          density="compact"
          columns={2}
          segments={segments}
        />
        <PageRibbon
          orientation="horizontal"
          rows={rows}
          pageCount={pageCount}
          rowThickness={7}
        />
      </div>
    </RunCard>
  );
}

// ── Parse ─────────────────────────────────────────────────────────────────────

// Card-sized renderers for the parsed markdown — headings and a GFM table,
// scaled down to read inside the thumbnail frame.
const PARSE_MARKDOWN_COMPONENTS: Components = {
  h1: (props) => (
    <h1 className="text-foreground mb-1 text-[11px] font-bold" {...props} />
  ),
  h2: (props) => (
    <h2
      className="text-foreground mt-2 mb-1 text-[10px] font-semibold"
      {...props}
    />
  ),
  p: (props) => (
    <p className="text-muted-foreground mb-1 text-[9px]" {...props} />
  ),
  table: (props) => (
    <table className="mb-1 w-full border-collapse text-[8px]" {...props} />
  ),
  th: (props) => (
    <th
      className="border-border bg-muted/50 border px-1 py-0.5 text-left font-medium"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="border-border text-muted-foreground border px-1 py-0.5"
      {...props}
    />
  ),
};

export interface ParseRunCardProps extends PrimitiveRunCardBase {
  /** Parsed markdown to preview in the card frame. */
  markdown: string;
}

export function ParseRunCard({
  file,
  markdown,
  status = "completed",
  onClick,
}: ParseRunCardProps) {
  return (
    <RunCard
      file={file}
      status={status ?? undefined}
      onClick={onClick}
      media={
        <div className="bg-card size-full overflow-hidden p-3 leading-snug">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={PARSE_MARKDOWN_COMPONENTS}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      }
    />
  );
}

// ── Extract ───────────────────────────────────────────────────────────────────

export interface ExtractRunCardField {
  key: string;
  /** Where the value came from — its source box is drawn over the page. */
  source: Source;
  /**
   * Field label/value for the footer list. Omit both for a boxes-only card that
   * shows just a count — the canvas-card style, where the source geometry is
   * known but the field name/value isn't projected.
   */
  label?: string;
  value?: string;
  /** Overlay/legend color; defaults to a palette color by field order. */
  color?: string;
}

export interface ExtractRunCardProps extends PrimitiveRunCardBase {
  previewImageUrl?: string;
  /**
   * Custom media rendered in the shared RunCard frame. Use this when a consumer
   * owns document loading/cropping/highlight behavior but still wants the shared
   * extract footer and run-card shell.
   */
  media?: React.ReactNode;
  /** Aspect ratio for custom media; defaults to the RunCard media frame. */
  mediaAspectRatio?: number;
  fields: ExtractRunCardField[];
  /**
   * Footer count for the boxes-only card (fields without labels). Defaults to
   * the number of fields.
   */
  fieldCount?: number;
  /** How many labeled fields to list; the rest collapse to "+N more". */
  maxFields?: number;
  className?: string;
}

export function ExtractRunCard({
  file,
  previewImageUrl,
  media,
  mediaAspectRatio,
  fields,
  fieldCount,
  maxFields = 3,
  status = "completed",
  onClick,
  className,
}: ExtractRunCardProps) {
  const tinted = fields.map((field, i) => ({
    ...field,
    color: field.color ?? SEGMENT_PALETTE[i % SEGMENT_PALETTE.length],
  }));
  // Labeled fields list in the footer; box-only fields collapse to a count
  // chip (the dashboard's canvas-card style — geometry known, names not).
  const labeled = tinted.filter((field) => field.label != null);
  const shown = labeled.slice(0, maxFields);
  const count = fieldCount ?? tinted.length;
  const rest = Math.max(0, count - shown.length);
  const defaultMedia = previewImageUrl ? (
    <div className="relative size-full overflow-hidden">
      {/* The page sits on a full-page-aspect layer so each field's source
          box can use its raw normalized coordinates; the 16/10 frame crops
          it from the top. */}
      <div
        className="absolute inset-x-0 top-0"
        style={{ aspectRatio: String(PAGE_ASPECT) }}
      >
        <FileThumbnail
          file={file}
          previewImageUrl={previewImageUrl}
          previewAspectRatio={PAGE_ASPECT}
          className="absolute inset-0 size-full rounded-none border-0"
        />
        {tinted.map((field) => {
          const box = anchorBox(field.source.anchor);
          if (!box) return null;
          return (
            <span
              key={field.key}
              className="absolute rounded-[2px]"
              style={{
                left: `${box.left * 100}%`,
                top: `${box.top * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
                backgroundColor: withAlpha(field.color, 0.25),
                boxShadow: `0 0 0 1.5px ${field.color}`,
              }}
              title={
                field.label && field.value
                  ? `${field.label}: ${field.value}`
                  : (field.label ?? field.key)
              }
            />
          );
        })}
      </div>
    </div>
  ) : undefined;

  return (
    <RunCard
      file={file}
      status={status ?? undefined}
      onClick={onClick}
      previewAspectRatio={mediaAspectRatio}
      media={media ?? defaultMedia}
      className={className}
    >
      {shown.length > 0 ? (
        <div className="flex flex-col gap-1">
          {shown.map((field) => (
            <span
              key={field.key}
              className="flex items-center gap-1.5 text-[11px]"
            >
              <span
                className="h-3 w-5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: field.color }}
              />
              <span className="text-muted-foreground shrink-0">
                {field.label}
              </span>
              <span className="ml-auto truncate font-medium tabular-nums">
                {field.value}
              </span>
            </span>
          ))}
          {rest > 0 ? (
            <span className="text-muted-foreground text-[10px]">
              +{rest} more fields
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-muted-foreground text-[11px]">
          <span className="text-foreground font-medium tabular-nums">
            {count}
          </span>{" "}
          {count === 1 ? "field extracted" : "fields extracted"}
        </span>
      )}
    </RunCard>
  );
}

// ── Shared overlay primitives ─────────────────────────────────────────────────

/** The normalized [0, 1] page box of a source, or null when it isn't a region. */
function anchorBox(anchor: SourceAnchor) {
  if (anchor.kind === "pdf_bbox" || anchor.kind === "image_bbox") {
    const { left, top, width, height } = anchor;
    return { left, top, width, height };
  }
  return null;
}

/** A `FileThumbnail` that fills its positioned parent, cropped from the top. */
function FillThumbnail({
  file,
  src,
}: {
  file: PrimitiveRunCardFile;
  src: string;
}) {
  return (
    <FileThumbnail
      file={file}
      previewImageUrl={src}
      previewClassName="object-top"
      className="absolute inset-0 size-full rounded-none border-0"
    />
  );
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
