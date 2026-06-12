/**
 * Shared model for page-segmented document results — Retab "partition" (keyed
 * chunks) and "split" (named subdocuments). Both reduce to the same `Segment[]`:
 * a label, the pages it owns, a deterministic color, and optional confidence.
 *
 * The legend, sidebar, and timeline primitives all consume `Segment[]`, so a
 * partition and a split render through the exact same components.
 */

// Tableau 20 — the palette Retab's dashboard uses, so colors match.
export const SEGMENT_PALETTE = [
  "#4E79A7",
  "#A0CBE8",
  "#F28E2B",
  "#FFBE7D",
  "#59A14F",
  "#8CD17D",
  "#B6992D",
  "#F1CE63",
  "#499894",
  "#86BCB6",
  "#E15759",
  "#FF9D9A",
  "#79706E",
  "#BAB0AC",
  "#D37295",
  "#FABFD2",
  "#B07AA1",
  "#D4A6C8",
  "#9D7660",
  "#D7B5A6",
] as const

export interface Segment {
  /** Stable id (label + occurrence, since a split name can repeat). */
  id: string
  /** Display label — the partition key or the subdocument name. */
  label: string
  /** Sorted, de-duplicated 1-based pages owned by this segment. */
  pages: number[]
  /** Deterministic color (by label, so the same label is always one color). */
  color: string
  /** Render order. */
  index: number
  /** Optional consensus confidence in [0, 1]. */
  confidence?: number | null
}

export interface SegmentChunk {
  key?: string
  name?: string
  pages: number[]
}

export function segmentDisplayLabel(label: string): string {
  const trimmed = label.trim()
  return trimmed || "unnamed"
}

/** Assign one palette color per distinct label, ordered by sorted label. */
export function buildColorMap(labels: string[]): Map<string, string> {
  const distinct = Array.from(new Set(labels)).sort((a, b) =>
    a.localeCompare(b)
  )
  const map = new Map<string, string>()
  distinct.forEach((label, i) => {
    map.set(label, SEGMENT_PALETTE[i % SEGMENT_PALETTE.length])
  })
  return map
}

function normalizePages(pages: number[]): number[] {
  return Array.from(
    new Set((pages ?? []).filter((p) => Number.isInteger(p) && p > 0))
  ).sort((a, b) => a - b)
}

/** Normalize partition/split output into the shared `Segment[]` model. */
export function toSegments(
  output: SegmentChunk[] | null | undefined,
  confidences?: (number | null | undefined)[],
  /** Reuse a shared color map (e.g. so partition votes match the consensus). */
  colorOverride?: Map<string, string>
): Segment[] {
  if (!output) return []
  const labels = output.map((c) => c.key ?? c.name ?? "")
  const colors = colorOverride ?? buildColorMap(labels)
  return output.map((chunk, index) => {
    const label = labels[index]
    return {
      id: `${label}#${index}`,
      label,
      pages: normalizePages(chunk.pages),
      color: colors.get(label) ?? "#888888",
      index,
      confidence: confidences?.[index] ?? null,
    }
  })
}

/** Total page count implied by a set of segments (max page seen). */
export function segmentsPageCount(segments: Segment[]): number {
  let max = 0
  for (const s of segments) for (const p of s.pages) max = Math.max(max, p)
  return max
}

/** Map every 1-based page to the segment indexes that own it (handles overlap). */
export function pageOwners(segments: Segment[]): Map<number, number[]> {
  const owners = new Map<number, number[]>()
  segments.forEach((segment) => {
    segment.pages.forEach((page) => {
      const list = owners.get(page) ?? []
      list.push(segment.index)
      owners.set(page, list)
    })
  })
  return owners
}

/** Collapse a page list into contiguous runs, e.g. [1,2,3,5] -> [[1,3],[5,5]]. */
export function buildPageRuns(pages: number[]): Array<[number, number]> {
  const sorted = normalizePages(pages)
  if (sorted.length === 0) return []
  const runs: Array<[number, number]> = []
  let start = sorted[0]
  let end = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      runs.push([start, end])
      start = sorted[i]
      end = sorted[i]
    }
  }
  runs.push([start, end])
  return runs
}

/** Format a page list as compact ranges, e.g. [1,2,3,5] -> "1–3, 5". */
export function formatPageRanges(pages: number[]): string {
  const runs = buildPageRuns(pages)
  if (runs.length === 0) return "—"
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ")
}

export type ConfidenceLevel = "high" | "medium" | "low"

export function confidenceLevel(
  value: number | null | undefined
): ConfidenceLevel | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value >= 0.9) return "high"
  if (value >= 0.7) return "medium"
  return "low"
}

/** Average a per-page likelihood array into a single segment confidence. */
export function meanConfidence(values: number[] | undefined): number | null {
  const finiteValues = values?.filter((value) => Number.isFinite(value)) ?? []
  if (finiteValues.length === 0) return null
  return finiteValues.reduce((a, b) => a + b, 0) / finiteValues.length
}
