import {
  buildColorMap,
  segmentDisplayLabel,
  segmentsPageCount,
} from "@/lib/segments"
import { type RibbonRow } from "@/components/ui/page-ribbon"
import {
  createSegmentedDocumentModel,
  type DocumentSegment,
  type SegmentedDocumentModel,
} from "@/components/ui/segmented-document-model"
import type {
  PartitionChunk,
  PartitionResult,
} from "@/components/viewers/lib/partition-types"

export type PartitionRibbonRowKind = "output" | "vote"

export type PartitionRibbonRow = RibbonRow & {
  kind: PartitionRibbonRowKind
  voteIndex?: number
}

export type PartitionViewerModel = {
  hasOutput: boolean
  legendSegments: DocumentSegment[]
  pageCount: number
  ribbonRows: PartitionRibbonRow[]
  viewportSegments: DocumentSegment[]
}

export function createPartitionViewerModel(
  result: PartitionResult | null
): PartitionViewerModel {
  if (!result) return emptyPartitionViewerModel()

  const voteChoices = result.consensus.choices ?? []
  const colors = buildColorMap([
    ...result.output.map((chunk) => chunk.key),
    ...voteChoices.flat().map((chunk) => chunk.key),
  ])
  const legendSegments = createPartitionLegendSegments(result.output, colors)
  const viewportSegments = legendSegments
  const ribbonRows = createPartitionRibbonRows(result, colors)
  const ribbonSegments = ribbonRows.flatMap((row) => row.segments)

  return {
    hasOutput: result.output.length > 0,
    legendSegments,
    pageCount: segmentsPageCount(ribbonSegments),
    ribbonRows,
    viewportSegments,
  }
}

export function createPartitionLegendSegments(
  output: readonly PartitionChunk[],
  colors: ReadonlyMap<string, string>
): DocumentSegment[] {
  const segmentsByLabel = new Map<string, DocumentSegment>()

  for (const chunk of output) {
    const label = partitionDisplayLabel(chunk.key)
    const existing = segmentsByLabel.get(label)

    if (existing) {
      segmentsByLabel.set(label, {
        ...existing,
        pages: normalizePartitionPages([...existing.pages, ...chunk.pages]),
      })
      continue
    }

    segmentsByLabel.set(label, {
      id: partitionSegmentId(label),
      label,
      pages: normalizePartitionPages(chunk.pages),
      color: partitionColor(chunk.key, colors),
      index: segmentsByLabel.size,
    })
  }

  return [...segmentsByLabel.values()].map((segment, index) => ({
    ...segment,
    index,
  }))
}

export function createPartitionRibbonRows(
  result: PartitionResult,
  colors: ReadonlyMap<string, string>
): PartitionRibbonRow[] {
  const voteChoices = result.consensus.choices ?? []
  return [
    ...result.output.map((chunk, index) => ({
      id: `output:${index}`,
      kind: "output" as const,
      segments: [createPartitionSegment(chunk, index, colors)],
    })),
    ...voteChoices.flatMap((chunks, voteIndex) =>
      chunks.map((chunk, index) => ({
        id: `vote:${voteIndex}:${index}`,
        kind: "vote" as const,
        voteIndex,
        segments: [createPartitionSegment(chunk, index, colors)],
      }))
    ),
  ]
}

export function normalizePartitionPages(pages: readonly number[]): number[] {
  return Array.from(
    new Set((pages ?? []).filter((page) => Number.isInteger(page) && page > 0))
  ).sort((a, b) => a - b)
}

function createPartitionSegment(
  chunk: PartitionChunk,
  index: number,
  colors: ReadonlyMap<string, string>
): DocumentSegment {
  const label = partitionDisplayLabel(chunk.key)

  return {
    id: partitionSegmentId(label),
    label,
    pages: normalizePartitionPages(chunk.pages),
    color: partitionColor(chunk.key, colors),
    index,
  }
}

export function createPartitionSegmentedDocumentModel(
  model: Pick<
    PartitionViewerModel,
    "pageCount" | "ribbonRows" | "viewportSegments"
  >
): SegmentedDocumentModel {
  return createSegmentedDocumentModel({
    pageCount: model.pageCount,
    rows: model.ribbonRows,
    segments: model.viewportSegments,
  })
}

function emptyPartitionViewerModel(): PartitionViewerModel {
  return {
    hasOutput: false,
    legendSegments: [],
    pageCount: 0,
    ribbonRows: [],
    viewportSegments: [],
  }
}

function partitionColor(key: string, colors: ReadonlyMap<string, string>) {
  return (
    colors.get(key) ??
    colors.get(segmentDisplayLabel(key)) ??
    "var(--color-muted-foreground)"
  )
}

function partitionDisplayLabel(key: string) {
  return segmentDisplayLabel(key)
}

function partitionSegmentId(label: string) {
  return `partition:${label}`
}
