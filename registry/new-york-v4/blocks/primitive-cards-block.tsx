"use client"

import { type ReactNode } from "react"

import {
  SEGMENT_PALETTE,
  buildColorMap,
  formatPageRanges,
  toSegments,
  type Segment,
} from "@/lib/segments"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { RunCard } from "@/components/ui/run-card"
import type { ClassifyResult } from "@/components/viewers/lib/classify-types"
import type { SplitView } from "@/components/viewers/lib/split-types"
import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import extractSample from "@/components/viewers/sample-data/extract.json"
import parseSample from "@/components/viewers/sample-data/parse.json"

// The sample pages are all US-Letter, so one page aspect lets coordinate-anchored
// overlays (the extract source boxes) map onto a cropped thumbnail.
const PAGE_ASPECT = 800 / 1036

// ── Per-primitive sample results, each framed as a completed "run". ───────────

const CLASSIFICATION = {
  file: { name: "loan-application.pdf", type: "application/pdf" },
  thumbnail: "/samples/loan-application-page-1.png",
  result: {
    category: "Loan Application",
    reasoning:
      "A Uniform Residential Loan Application (Form 1003): borrower, employment, and property details for a mortgage request.",
  } satisfies ClassifyResult,
}

const SPLIT = {
  file: { name: "attention.pdf", type: "application/pdf" },
  result: {
    output: [
      { name: "Title & Abstract", pages: [1] },
      { name: "Introduction", pages: [2, 3] },
      { name: "Model Architecture", pages: [4, 5, 6] },
      { name: "Results", pages: [7, 8] },
      { name: "References", pages: [9, 10, 11] },
    ],
  } satisfies SplitView,
}

const PARTITION = {
  file: { name: "attention.pdf", type: "application/pdf" },
  thumbnail: "/samples/attention-page-1.png",
  result: {
    output: [
      { key: "abstract", pages: [1] },
      { key: "introduction", pages: [2] },
      { key: "model_architecture", pages: [2, 3, 4, 5, 6] },
      { key: "training", pages: [7, 8] },
      { key: "results", pages: [8, 9, 10] },
      { key: "references", pages: [10, 11, 12] },
    ],
  } satisfies Pick<PartitionResult, "output">,
}

const PARSE = {
  file: { name: "bank-statement.pdf", type: "application/pdf" },
  thumbnail: "/samples/bank-statement-page-1.png",
  markdown: (parseSample.output.pages[0] as string)
    .split("\n")
    .slice(0, 18)
    .join("\n"),
}

type ExtractField = {
  key: string
  label: string
  value: string
  anchor: { left: number; top: number; width: number; height: number }
  color: string
}

const EXTRACT = {
  file: { name: "bank-statement.pdf", type: "application/pdf" },
  thumbnail: "/samples/bank-statement-page-1.png",
  fields: (
    extractSample as Array<{
      key: string
      label: string
      value: string
      source: { anchor: ExtractField["anchor"] }
    }>
  ).map(
    (field, i): ExtractField => ({
      key: field.key,
      label: field.label,
      value: field.value,
      anchor: field.source.anchor,
      color: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length],
    })
  ),
}

// First page of each subdocument → its rendered thumbnail.
function subdocumentThumbnail(segment: Segment): string {
  return `/samples/attention-page-${segment.pages[0]}.png`
}

/**
 * Primitive run cards — each primitive's result framed as a run card by
 * composing the `RunCard` shell (a `FileThumbnail` + status + overlays) with a
 * per-primitive rendering of the output, all over the source document's page.
 *
 * - Classification: one category badge + the reasoning, over one page.
 * - Split: a bundle of per-subdocument thumbnails, name-badged and color-keyed.
 * - Partition: the page under a keyed-chunk legend and a proportion bar.
 * - Parse: the page beside the markdown it parsed to.
 * - Extract: the page with each field's source box drawn where its value came
 *   from, plus the extracted values.
 */
export function PrimitiveCardsBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ClassificationCard />
          <SplitCard />
          <PartitionCard />
          <ParseCard />
          <ExtractCard />
        </div>
      </div>
    </div>
  )
}

// ── Classification ────────────────────────────────────────────────────────────

function ClassificationCard() {
  const { file, thumbnail, result } = CLASSIFICATION
  const color = buildColorMap([result.category]).get(result.category) ?? "#4E79A7"

  return (
    <RunCard
      file={file}
      status="completed"
      media={
        <ClassifiedThumbnail
          thumbnail={thumbnail}
          fileName={file.name}
          category={result.category}
          reasoning={result.reasoning}
          color={color}
        />
      }
    />
  )
}

function ClassifiedThumbnail({
  thumbnail,
  fileName,
  category,
  reasoning,
  color,
}: {
  thumbnail: string
  fileName: string
  category: string
  reasoning?: string
  color: string
}) {
  return (
    <div className="relative size-full">
      <FillThumbnail src={thumbnail} fileName={fileName} />
      <LegendBadge label={category} color={color} className="top-2 left-2" />
      {reasoning ? (
        <BottomScrim>
          <p className="line-clamp-3 text-[11px] leading-snug text-white/95">
            {reasoning}
          </p>
        </BottomScrim>
      ) : null}
    </div>
  )
}

// ── Split ─────────────────────────────────────────────────────────────────────

function SplitCard() {
  const { file, result } = SPLIT
  const segments = toSegments(result.output)

  return (
    <RunCard
      file={file}
      status="completed"
      media={<SubdocumentBundle segments={segments} />}
    />
  )
}

/** A centered row of small per-subdocument thumbnails — the split "bundle". */
function SubdocumentBundle({ segments }: { segments: Segment[] }) {
  return (
    <div className="bg-muted/40 flex size-full items-center justify-center gap-2 overflow-x-auto px-3 py-2">
      {segments.map((segment) => (
        <SubdocumentThumbnail key={segment.id} segment={segment} />
      ))}
    </div>
  )
}

function SubdocumentThumbnail({ segment }: { segment: Segment }) {
  const multiPage = segment.pages.length > 1

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <div className="relative w-full">
        {/* Offset layers behind the page imply a multi-page bundle. */}
        {multiPage ? (
          <>
            <span className="bg-card absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-[4px] border" />
            <span className="bg-card absolute inset-0 translate-x-[1.5px] translate-y-[1.5px] rounded-[4px] border" />
          </>
        ) : null}
        <FileThumbnail
          file={{ name: `${segment.label}.pdf`, type: "application/pdf" }}
          previewImageUrl={subdocumentThumbnail(segment)}
          previewAspectRatio={3 / 4}
          previewClassName="object-top"
          className="relative w-full rounded-[4px] shadow-sm"
        />
        <LegendBadge
          label={segment.label}
          color={segment.color}
          className="inset-x-0.5 top-0.5"
        />
      </div>
      <span className="text-muted-foreground w-full truncate text-center text-[9px] tabular-nums">
        {formatPageRanges(segment.pages)}
      </span>
    </div>
  )
}

// ── Partition ─────────────────────────────────────────────────────────────────

function PartitionCard() {
  const { file, thumbnail, result } = PARTITION
  const segments = toSegments(result.output)

  return (
    <RunCard
      file={file}
      status="completed"
      media={
        <div className="relative size-full">
          <FillThumbnail src={thumbnail} fileName={file.name} />
          <BottomScrim className="space-y-1.5">
            {/* A proportion bar — each keyed chunk sized by its page count. */}
            <div className="flex h-1.5 overflow-hidden rounded-full">
              {segments.map((segment) => (
                <span
                  key={segment.id}
                  style={{
                    flexGrow: segment.pages.length,
                    backgroundColor: segment.color,
                  }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {segments.map((segment) => (
                <span
                  key={segment.id}
                  className="inline-flex items-center gap-1 text-[9px] text-white/95"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: segment.color }}
                  />
                  {segment.label}
                </span>
              ))}
            </div>
          </BottomScrim>
        </div>
      }
    />
  )
}

// ── Parse ─────────────────────────────────────────────────────────────────────

function ParseCard() {
  const { file, thumbnail, markdown } = PARSE

  return (
    <RunCard
      file={file}
      status="completed"
      media={
        <div className="flex size-full">
          <div className="relative w-1/2 border-r">
            <FillThumbnail src={thumbnail} fileName={file.name} />
          </div>
          <div className="bg-muted/40 relative w-1/2 overflow-hidden p-2">
            <span className="bg-background/80 text-muted-foreground absolute top-1 right-1 rounded px-1 py-0.5 text-[8px] font-medium uppercase">
              Markdown
            </span>
            <pre className="text-muted-foreground font-mono text-[7px] leading-[1.5] break-words whitespace-pre-wrap">
              {markdown}
            </pre>
          </div>
        </div>
      }
    />
  )
}

// ── Extract ───────────────────────────────────────────────────────────────────

function ExtractCard() {
  const { file, thumbnail, fields } = EXTRACT
  const shown = fields.slice(0, 3)
  const rest = fields.length - shown.length

  return (
    <RunCard
      file={file}
      status="completed"
      media={
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
              previewImageUrl={thumbnail}
              previewAspectRatio={PAGE_ASPECT}
              className="absolute inset-0 size-full rounded-none border-0"
            />
            {fields.map((field) => (
              <span
                key={field.key}
                className="absolute rounded-[2px]"
                style={{
                  left: `${field.anchor.left * 100}%`,
                  top: `${field.anchor.top * 100}%`,
                  width: `${field.anchor.width * 100}%`,
                  height: `${field.anchor.height * 100}%`,
                  backgroundColor: withAlpha(field.color, 0.25),
                  boxShadow: `0 0 0 1.5px ${field.color}`,
                }}
                title={`${field.label}: ${field.value}`}
              />
            ))}
          </div>
          <BottomScrim>
            <div className="flex flex-col gap-1">
              {shown.map((field) => (
                <span
                  key={field.key}
                  className="flex items-center gap-1.5 text-[10px] text-white/95"
                >
                  <span
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: field.color }}
                  />
                  <span className="shrink-0 text-white/70">{field.label}</span>
                  <span className="truncate font-medium tabular-nums">
                    {field.value}
                  </span>
                </span>
              ))}
              {rest > 0 ? (
                <span className="text-[9px] text-white/60">
                  +{rest} more fields
                </span>
              ) : null}
            </div>
          </BottomScrim>
        </div>
      }
    />
  )
}

// ── Shared overlay primitives ─────────────────────────────────────────────────

/** A `FileThumbnail` that fills its positioned parent, cropped from the top. */
function FillThumbnail({ src, fileName }: { src: string; fileName: string }) {
  return (
    <FileThumbnail
      file={{ name: fileName, type: "application/pdf" }}
      previewImageUrl={src}
      previewClassName="object-top"
      className="absolute inset-0 size-full rounded-none border-0"
    />
  )
}

/** A color-keyed legend badge, overlaid on a thumbnail. */
function LegendBadge({
  label,
  color,
  className,
}: {
  label: string
  color: string
  className?: string
}) {
  return (
    <span
      className={`absolute inline-flex max-w-[calc(100%-1rem)] items-center truncate rounded px-1.5 py-0.5 text-center text-[9px] font-semibold shadow-sm ${className ?? ""}`}
      style={{ backgroundColor: color, color: readableTextColor(color) }}
      title={label}
    >
      {label}
    </span>
  )
}

/** A bottom gradient scrim for captioning a thumbnail. */
function BottomScrim({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pt-10 pb-2.5 ${className ?? ""}`}
    >
      {children}
    </div>
  )
}

/** Black or white text, whichever reads better on a palette color. */
function readableTextColor(hex: string): string {
  const value = hex.replace("#", "")
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? "#1c1c1c" : "#ffffff"
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

