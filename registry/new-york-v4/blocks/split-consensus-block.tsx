"use client"

import * as React from "react"
import { Layers } from "lucide-react"

import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

/** One contiguous run of pages a voter (or the consensus) assigned to a type. */
export type SplitSegment = {
  /** Subdocument type, e.g. `invoice`, `remittance`, `id_card`. */
  type: string
  /** First page of the run (0-indexed, inclusive). */
  startPage: number
  /** Last page of the run (0-indexed, inclusive). */
  endPage: number
}

/** A single voter's proposed split of the document. */
export type SplitVoter = {
  /** Display label, e.g. `gpt-4o` or `run 2`. Defaults to `Voter N`. */
  label?: string
  segments: SplitSegment[]
}

/** A document split N times, reconciled into a consensus. */
export type SplitConsensusDoc = {
  /** Total pages in the document. */
  pageCount: number
  /** The reconciled split every voter is compared against. */
  consensus: SplitSegment[]
  /** The individual voter splits. */
  voters: SplitVoter[]
  /** Optional document name shown in the header. */
  filename?: string
}

// ── Color map ────────────────────────────────────────────────────────────────

// Tableau 20 — stable, readable categorical palette.
const PALETTE = [
  "#4E79A7",
  "#F28E2B",
  "#59A14F",
  "#B6992D",
  "#499894",
  "#E15759",
  "#79706E",
  "#D37295",
  "#B07AA1",
  "#9D7660",
  "#A0CBE8",
  "#FFBE7D",
  "#8CD17D",
  "#F1CE63",
  "#86BCB6",
  "#FF9D9A",
  "#BAB0AC",
  "#FABFD2",
  "#D4A6C8",
  "#D7B5A6",
]

function buildColorMap(doc: SplitConsensusDoc): Map<string, string> {
  const all = [
    ...doc.consensus,
    ...doc.voters.flatMap((v) => v.segments),
  ]
  const types = Array.from(new Set(all.map((s) => s.type))).sort((a, b) =>
    a.localeCompare(b)
  )
  const map = new Map<string, string>()
  types.forEach((t, i) => map.set(t, PALETTE[i % PALETTE.length]))
  return map
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Expand segments into a per-page type lookup (null where unassigned). */
function pageTypes(
  segments: SplitSegment[],
  pageCount: number
): (string | null)[] {
  const out: (string | null)[] = new Array(pageCount).fill(null)
  for (const seg of segments) {
    const lo = Math.max(0, seg.startPage)
    const hi = Math.min(pageCount - 1, seg.endPage)
    for (let p = lo; p <= hi; p++) out[p] = seg.type
  }
  return out
}

/** Fraction of voters whose type matches the consensus, per page. */
function perPageAgreement(doc: SplitConsensusDoc): number[] {
  const consensus = pageTypes(doc.consensus, doc.pageCount)
  const voters = doc.voters.map((v) => pageTypes(v.segments, doc.pageCount))
  if (voters.length === 0) return new Array(doc.pageCount).fill(0)
  return consensus.map((c, p) => {
    const agree = voters.filter((vt) => vt[p] === c).length
    return agree / voters.length
  })
}

/** Mean per-page agreement — the document's overall consensus score (0–1). */
export function splitAgreementScore(doc: SplitConsensusDoc): number {
  const per = perPageAgreement(doc)
  if (per.length === 0) return 0
  return per.reduce((s, v) => s + v, 0) / per.length
}

type Contested = { startPage: number; endPage: number }

/** Contiguous page ranges where at least one voter disagrees with consensus. */
function contestedRanges(doc: SplitConsensusDoc): Contested[] {
  const consensus = pageTypes(doc.consensus, doc.pageCount)
  const voters = doc.voters.map((v) => pageTypes(v.segments, doc.pageCount))
  const ranges: Contested[] = []
  let start = -1
  for (let p = 0; p <= doc.pageCount; p++) {
    const contested =
      p < doc.pageCount && voters.some((vt) => vt[p] !== consensus[p])
    if (contested && start === -1) start = p
    else if (!contested && start !== -1) {
      ranges.push({ startPage: start, endPage: p - 1 })
      start = -1
    }
  }
  return ranges
}

function scoreTone(score: number): string {
  if (score >= 0.9)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
  if (score >= 0.7)
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
  return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function TypeLegend({ colorMap }: { colorMap: Map<string, string> }) {
  const entries = Array.from(colorMap.entries())
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {entries.map(([type, color]) => (
        <div key={type} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-3 shrink-0 rounded-sm ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-[11px] text-muted-foreground">
            {type}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * One row of the waterfall: a voter's (or the consensus') segments drawn as
 * proportional blocks. Because every lane sums to `pageCount`, page boundaries
 * line up across rows.
 */
function Lane({
  segments,
  pageCount,
  colorMap,
  highlight,
  emphasis,
  onHoverRange,
}: {
  segments: SplitSegment[]
  pageCount: number
  colorMap: Map<string, string>
  highlight: Contested | null
  emphasis?: boolean
  onHoverRange?: (range: Contested | null) => void
}) {
  const sorted = [...segments].sort((a, b) => a.startPage - b.startPage)
  return (
    <div className="flex h-7 w-full overflow-hidden rounded-md">
      {sorted.map((seg, i) => {
        const span = seg.endPage - seg.startPage + 1
        const color = colorMap.get(seg.type) ?? "#888"
        const dimmed =
          highlight !== null &&
          (seg.endPage < highlight.startPage ||
            seg.startPage > highlight.endPage)
        return (
          <div
            key={i}
            className={cn(
              "flex min-w-0 items-center justify-center border-r border-background/70 px-1 text-[10px] font-medium whitespace-nowrap transition-opacity last:border-r-0",
              dimmed ? "opacity-25" : "opacity-100"
            )}
            style={{
              flexGrow: span,
              flexBasis: 0,
              backgroundColor: emphasis ? color : color + "33",
              color: emphasis ? "#fff" : color,
            }}
            title={`${seg.type} · pp ${seg.startPage}–${seg.endPage}`}
            onMouseEnter={() =>
              onHoverRange?.({ startPage: seg.startPage, endPage: seg.endPage })
            }
            onMouseLeave={() => onHoverRange?.(null)}
          >
            <span className="truncate">
              {span > 1 ? seg.type : seg.type.slice(0, 3)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Per-page agreement heat strip below the lanes. */
function AgreementStrip({
  agreement,
  highlight,
}: {
  agreement: number[]
  highlight: Contested | null
}) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      {agreement.map((a, p) => {
        const dimmed =
          highlight !== null &&
          (p < highlight.startPage || p > highlight.endPage)
        // green (agree) → amber → red (split)
        const hue = Math.round(a * 140) // 0 = red, 140 = green
        return (
          <div
            key={p}
            className="flex-1 transition-opacity"
            style={{
              backgroundColor: `hsl(${hue} 70% 45%)`,
              opacity: dimmed ? 0.3 : 1,
            }}
            title={`page ${p}: ${Math.round(a * 100)}% agree`}
          />
        )
      })}
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

const ROW_LABEL =
  "w-20 shrink-0 truncate pr-2 text-right font-mono text-[11px] leading-7"

/**
 * Split Consensus — a page-axis waterfall comparing how several voters split a
 * document into typed subdocuments against the reconciled consensus. The
 * consensus lane sits on top; each voter lane below aligns to the same page
 * axis, so boundary and type disagreements read at a glance. A heat strip shows
 * per-page agreement, and the contested ranges are listed as chips you can hover
 * to isolate. Presentation only — pass a {@link SplitConsensusDoc}.
 */
export function SplitConsensusView({ doc }: { doc: SplitConsensusDoc }) {
  const [highlight, setHighlight] = React.useState<Contested | null>(null)

  const colorMap = React.useMemo(() => buildColorMap(doc), [doc])
  const agreement = React.useMemo(() => perPageAgreement(doc), [doc])
  const contested = React.useMemo(() => contestedRanges(doc), [doc])
  const score = React.useMemo(() => splitAgreementScore(doc), [doc])

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-xs text-foreground/80">
            {doc.filename ?? "document"}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            · {doc.pageCount} pages · {doc.voters.length} voters
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-medium",
            scoreTone(score)
          )}
        >
          {Math.round(score * 100)}% agreement
        </span>
      </div>

      <TypeLegend colorMap={colorMap} />

      {/* Waterfall */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center">
          <span className={cn(ROW_LABEL, "font-semibold text-foreground")}>
            consensus
          </span>
          <Lane
            segments={doc.consensus}
            pageCount={doc.pageCount}
            colorMap={colorMap}
            highlight={highlight}
            emphasis
            onHoverRange={setHighlight}
          />
        </div>

        <div className="my-0.5 ml-20 border-t border-dashed" />

        {doc.voters.map((voter, i) => (
          <div key={i} className="flex items-center">
            <span className={cn(ROW_LABEL, "text-muted-foreground")}>
              {voter.label ?? `voter ${i + 1}`}
            </span>
            <Lane
              segments={voter.segments}
              pageCount={doc.pageCount}
              colorMap={colorMap}
              highlight={highlight}
              onHoverRange={setHighlight}
            />
          </div>
        ))}

        {/* Agreement heat strip */}
        <div className="mt-1.5 flex items-center">
          <span className={cn(ROW_LABEL, "text-muted-foreground")}>
            agreement
          </span>
          <AgreementStrip agreement={agreement} highlight={highlight} />
        </div>
      </div>

      {/* Contested ranges */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Contested ranges · {contested.length}
        </p>
        {contested.length === 0 ? (
          <p className="rounded-md border bg-muted/40 py-4 text-center font-mono text-[11px] text-muted-foreground">
            Every voter agrees on every page.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {contested.map((range, i) => {
              const active =
                highlight !== null &&
                highlight.startPage === range.startPage &&
                highlight.endPage === range.endPage
              const label =
                range.startPage === range.endPage
                  ? `pp ${range.startPage}`
                  : `pp ${range.startPage}–${range.endPage}`
              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHighlight(range)}
                  onMouseLeave={() => setHighlight(null)}
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                    active
                      ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      : "border-border bg-background text-muted-foreground hover:border-amber-300"
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Block (self-contained demo with sample data) ─────────────────────────────

const SAMPLE_DOC: SplitConsensusDoc = {
  filename: "claims-packet-2417.pdf",
  pageCount: 12,
  consensus: [
    { type: "invoice", startPage: 0, endPage: 2 },
    { type: "remittance", startPage: 3, endPage: 5 },
    { type: "id_card", startPage: 6, endPage: 6 },
    { type: "claim_form", startPage: 7, endPage: 11 },
  ],
  voters: [
    {
      label: "gpt-4o",
      segments: [
        { type: "invoice", startPage: 0, endPage: 2 },
        { type: "remittance", startPage: 3, endPage: 5 },
        { type: "id_card", startPage: 6, endPage: 6 },
        { type: "claim_form", startPage: 7, endPage: 11 },
      ],
    },
    {
      label: "sonnet",
      segments: [
        { type: "invoice", startPage: 0, endPage: 2 },
        { type: "remittance", startPage: 3, endPage: 4 },
        { type: "id_card", startPage: 5, endPage: 6 },
        { type: "claim_form", startPage: 7, endPage: 11 },
      ],
    },
    {
      label: "gemini",
      segments: [
        { type: "invoice", startPage: 0, endPage: 1 },
        { type: "cover_letter", startPage: 2, endPage: 2 },
        { type: "remittance", startPage: 3, endPage: 5 },
        { type: "id_card", startPage: 6, endPage: 6 },
        { type: "claim_form", startPage: 7, endPage: 11 },
      ],
    },
    {
      label: "mistral",
      segments: [
        { type: "invoice", startPage: 0, endPage: 2 },
        { type: "remittance", startPage: 3, endPage: 5 },
        { type: "id_card", startPage: 6, endPage: 7 },
        { type: "claim_form", startPage: 8, endPage: 11 },
      ],
    },
  ],
}

/**
 * Split Consensus block — the waterfall preloaded with a sample multi-voter
 * split. Pass your own {@link SplitConsensusDoc} via the `doc` prop to inspect a
 * real consensus run.
 */
export function SplitConsensusBlock({
  doc = SAMPLE_DOC,
}: {
  doc?: SplitConsensusDoc
}) {
  return (
    <div className="h-full min-h-[420px] bg-background">
      <SplitConsensusView doc={doc} />
    </div>
  )
}
