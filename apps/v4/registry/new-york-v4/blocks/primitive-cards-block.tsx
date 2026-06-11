"use client"

import * as React from "react"

import {
  buildColorMap,
  formatPageRanges,
  toSegments,
  type Segment,
} from "@/lib/segments"
import { FileThumbnail } from "@/components/ui/file-thumbnail"
import { RunCard } from "@/components/ui/run-card"
import type { ClassifyResult } from "@/components/viewers/lib/classify-types"
import type { SplitView } from "@/components/viewers/lib/split-types"

// Each primitive's result, framed as a "run" — the same shape the workflow test
// runner shows. The thumbnail is the source document's first page; the card body
// renders the primitive's output.
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

// First page of each subdocument → its rendered thumbnail. A real app would
// generate these from the split output; here they're prerendered pages.
function subdocumentThumbnail(segment: Segment): string {
  return `/samples/attention-page-${segment.pages[0]}.png`
}

/**
 * Primitive run cards — one card per primitive result, built by composing the
 * `RunCard` shell (a `FileThumbnail` + status + body) with each primitive's own
 * result rendering.
 *
 * - Classification reduces to one document, so its card shows one thumbnail.
 * - A split fans one document into several subdocuments, so its card swaps the
 *   single thumbnail for a *bundle* — a row of much smaller `FileThumbnail`s, one
 *   per subdocument, color-keyed to the legend below.
 */
export function PrimitiveCardsBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <ClassificationCard />
          <SplitCard />
        </div>
      </div>
    </div>
  )
}

function ClassificationCard() {
  const { file, thumbnail, result } = CLASSIFICATION
  const color = buildColorMap([result.category]).get(result.category) ?? "#4E79A7"

  return (
    <RunCard
      file={file}
      status="completed"
      meta="Classify"
      media={
        <ClassifiedThumbnail
          thumbnail={thumbnail}
          fileName={file.name}
          category={result.category}
          color={color}
        />
      }
    >
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Reasoning</FieldLabel>
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {result.reasoning}
        </p>
      </div>
    </RunCard>
  )
}

/** The source document with its single category as a legend badge on top. */
function ClassifiedThumbnail({
  thumbnail,
  fileName,
  category,
  color,
}: {
  thumbnail: string
  fileName: string
  category: string
  color: string
}) {
  return (
    <div className="relative size-full">
      <FileThumbnail
        file={{ name: fileName, type: "application/pdf" }}
        previewImageUrl={thumbnail}
        previewClassName="object-top"
        className="absolute inset-0 size-full rounded-none border-0"
      />
      <span
        className="absolute top-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center truncate rounded-md px-2 py-1 text-[11px] font-semibold shadow-sm"
        style={{ backgroundColor: color, color: readableTextColor(color) }}
        title={category}
      >
        {category}
      </span>
    </div>
  )
}

function SplitCard() {
  const { file, result } = SPLIT
  const segments = toSegments(result.output)

  return (
    <RunCard
      file={file}
      status="completed"
      meta="Split"
      media={<SubdocumentBundle segments={segments} />}
    >
      <FieldLabel>Subdocuments · {segments.length}</FieldLabel>
    </RunCard>
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
        {/* The legend badge sits on top of the page, color-keyed to the split. */}
        <span
          className="absolute inset-x-0.5 top-0.5 truncate rounded px-1 py-0.5 text-center text-[9px] font-semibold shadow-sm"
          style={{
            backgroundColor: segment.color,
            color: readableTextColor(segment.color),
          }}
          title={segment.label}
        >
          {segment.label}
        </span>
      </div>
      <span className="text-muted-foreground w-full truncate text-center text-[9px] tabular-nums">
        {formatPageRanges(segment.pages)}
      </span>
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
      {children}
    </span>
  )
}

