"use client"

import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  SEGMENT_PALETTE,
  segmentsPageCount,
  toSegments,
  type Segment,
} from "@/lib/segments"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { PageRibbon, type RibbonRow } from "@/components/ui/page-ribbon"
import { RunCard } from "@/components/ui/run-card"
import { SegmentLegend } from "@/components/ui/segment-legend"
import type { Source, SourceAnchor } from "@/lib/document-source"
import type { ClassifyResult } from "@/components/viewers/lib/classify-types"
import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import type { SplitView } from "@/components/viewers/lib/split-types"
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
  file: { name: "an-image-is-worth-16x16-words.pdf", type: "application/pdf" },
  result: {
    output: [
      { name: "Title, Abstract & Introduction", pages: [1] },
      { name: "Related Work", pages: [2] },
      { name: "Method", pages: [3] },
      { name: "Experiments", pages: [4, 5, 6, 7, 8] },
      { name: "Conclusion & References", pages: [9, 10, 11, 12] },
      { name: "Appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
    ],
  } satisfies SplitView,
}

const PARTITION = {
  file: { name: "an-image-is-worth-16x16-words.pdf", type: "application/pdf" },
  thumbnail: "/samples/an-image-is-worth-16x16-words-page-1.png",
  result: {
    output: [
      { key: "abstract", pages: [1] },
      { key: "introduction", pages: [1, 2] },
      { key: "related_work", pages: [2] },
      { key: "method", pages: [3, 4] },
      { key: "experiments", pages: [4, 5, 6, 7, 8] },
      { key: "conclusion", pages: [9] },
      { key: "references", pages: [9, 10, 11, 12] },
      { key: "appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
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

// The extracted fields, in the canonical extract shape (a `Source` per value),
// tinted with a palette color for the source box and its legend swatch.
type ExtractField = {
  key: string
  label: string
  value: string
  source: Source
  color: string
}

const EXTRACT = {
  file: { name: "bank-statement.pdf", type: "application/pdf" },
  thumbnail: "/samples/bank-statement-page-1.png",
  fields: (extractSample as Omit<ExtractField, "color">[]).map(
    (field, i): ExtractField => ({
      ...field,
      color: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length],
    })
  ),
}

/** The normalized [0, 1] page box of a source, or null when it isn't a region. */
function anchorBox(anchor: SourceAnchor) {
  if (anchor.kind === "pdf_bbox" || anchor.kind === "image_bbox") {
    const { left, top, width, height } = anchor
    return { left, top, width, height }
  }
  return null
}

/**
 * Primitive run cards — each primitive's result framed as a run card by
 * composing the `RunCard` shell (a `FileThumbnail` + status + overlays) with a
 * per-primitive rendering of the output, all over the source document's page.
 *
 * - Classification: the page with its category badge; reasoning in the footer.
 * - Split: a mini split viewer — the first page with a vertical, color-keyed
 *   page rail beside it; the subdocument names in the footer legend.
 * - Partition: the page, with a keyed-chunk legend and an overlap waterfall (one
 *   ribbon lane per chunk) in the footer.
 * - Parse: the parsed markdown the document was turned into.
 * - Extract: the page with each field's source box drawn where its value came
 *   from; the extracted values are listed in the footer.
 */
export function PrimitiveCardsBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

  return (
    <RunCard
      file={file}
      status="completed"
      media={<FillThumbnail src={thumbnail} fileName={file.name} />}
    >
      <div className="space-y-2 p-3">
        <div className="inline-flex min-h-7 max-w-full items-center rounded-md border bg-background px-2.5 text-sm font-medium">
          <span className="truncate">{result.category}</span>
        </div>
        {result.reasoning ? (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {result.reasoning}
          </p>
        ) : null}
      </div>
    </RunCard>
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
      media={<SplitMiniViewer file={file} segments={segments} />}
    >
      <SegmentLegend
        variant="plain"
        density="compact"
        columns={2}
        segments={segments}
      />
    </RunCard>
  )
}

/**
 * A mini split viewer: the document's first page with a vertical, color-keyed
 * page rail beside it — each subdocument is a colored block spanning its page
 * range, shrunk to fit the card's media frame.
 */
function SplitMiniViewer({
  file,
  segments,
}: {
  file: { name: string; type: string }
  segments: Segment[]
}) {
  const pageCount = segmentsPageCount(segments)

  return (
    <div className="flex size-full bg-muted/30">
      <div className="flex h-full shrink-0 border-r bg-background px-2 py-3">
        <PageRibbon
          orientation="vertical"
          rows={[{ id: "split", segments }]}
          pageCount={pageCount}
          rowThickness={12}
        />
      </div>
      <div className="relative min-w-0 flex-1">
        <FillThumbnail
          src="/samples/an-image-is-worth-16x16-words-page-1.png"
          fileName={file.name}
        />
      </div>
    </div>
  )
}

// ── Partition ─────────────────────────────────────────────────────────────────

function PartitionCard() {
  const { file, thumbnail, result } = PARTITION
  const segments = toSegments(result.output)
  const pageCount = segmentsPageCount(segments)
  // One ribbon lane per chunk over a shared page axis, so chunks that share a
  // page (e.g. method + experiments on page 4) read as an overlap.
  const rows: RibbonRow[] = segments.map((segment) => ({
    id: segment.id,
    label: segment.label,
    segments: [segment],
  }))

  return (
    <RunCard
      file={file}
      status="completed"
      media={<FillThumbnail src={thumbnail} fileName={file.name} />}
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
  )
}

// ── Parse ─────────────────────────────────────────────────────────────────────

// Card-sized renderers for the parsed markdown — headings and a GFM table,
// scaled down to read inside the thumbnail frame.
const PARSE_MARKDOWN_COMPONENTS: Components = {
  h1: (props) => (
    <h1 className="mb-1 text-[11px] font-bold text-foreground" {...props} />
  ),
  h2: (props) => (
    <h2
      className="mt-2 mb-1 text-[10px] font-semibold text-foreground"
      {...props}
    />
  ),
  p: (props) => (
    <p className="mb-1 text-[9px] text-muted-foreground" {...props} />
  ),
  table: (props) => (
    <table className="mb-1 w-full border-collapse text-[8px]" {...props} />
  ),
  th: (props) => (
    <th
      className="border border-border bg-muted/50 px-1 py-0.5 text-left font-medium"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="border border-border px-1 py-0.5 text-muted-foreground"
      {...props}
    />
  ),
}

function ParseCard() {
  const { file, markdown } = PARSE

  return (
    <RunCard
      file={file}
      status="completed"
      media={
        <div className="size-full overflow-hidden bg-card p-3 leading-snug">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={PARSE_MARKDOWN_COMPONENTS}
          >
            {markdown}
          </ReactMarkdown>
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
            {fields.map((field) => {
              const box = anchorBox(field.source.anchor)
              if (!box) return null
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
                  title={`${field.label}: ${field.value}`}
                />
              )
            })}
          </div>
        </div>
      }
    >
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
            <span className="shrink-0 text-muted-foreground">
              {field.label}
            </span>
            <span className="ml-auto truncate font-medium tabular-nums">
              {field.value}
            </span>
          </span>
        ))}
        {rest > 0 ? (
          <span className="text-[10px] text-muted-foreground">
            +{rest} more fields
          </span>
        ) : null}
      </div>
    </RunCard>
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

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
