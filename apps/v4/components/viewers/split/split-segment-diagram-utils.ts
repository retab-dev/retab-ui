import {
  type SplitResult,
  type SplitView,
  getSplitVotes,
} from "@/components/viewers/lib/split-types"

export const SPLIT_SEGMENT_PALETTE = [
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

export interface SplitDiagramSegment {
  id: string
  splitName: string
  startPage: number
  endPage: number
  nPages: number
  color: string
}

export interface SplitDiagramRow {
  id: string
  label: string
  voteIndex: number | null
  segments: SplitDiagramSegment[]
}

function normalizePages(pages: number[]): number[] {
  return Array.from(
    new Set(pages.filter((page) => Number.isInteger(page) && page > 0)),
  ).sort((left, right) => left - right)
}

export function buildPageRuns(
  pages: number[],
): Array<{ start_page: number; end_page: number }> {
  const normalizedPages = normalizePages(pages)

  if (normalizedPages.length === 0) {
    return []
  }

  const runs: Array<{ start_page: number; end_page: number }> = []
  let startPage = normalizedPages[0]
  let endPage = normalizedPages[0]

  for (let index = 1; index < normalizedPages.length; index += 1) {
    const page = normalizedPages[index]
    if (page === endPage + 1) {
      endPage = page
      continue
    }

    runs.push({ start_page: startPage, end_page: endPage })
    startPage = page
    endPage = page
  }

  runs.push({ start_page: startPage, end_page: endPage })
  return runs
}

export function formatSegmentPageRange(
  startPage: number,
  endPage: number,
): string {
  if (startPage === endPage) {
    return `${startPage}`
  }

  return `${startPage}-${endPage}`
}

export function buildSplitDiagramColorMap(
  splitView: SplitView,
): Map<string, string> {
  const splitNames = Array.from(
    new Set(splitView.output.map((split) => split.name)),
  ).sort((left, right) => left.localeCompare(right))
  const colorMap = new Map<string, string>()

  splitNames.forEach((splitName, index) => {
    colorMap.set(
      splitName,
      SPLIT_SEGMENT_PALETTE[index % SPLIT_SEGMENT_PALETTE.length],
    )
  })

  return colorMap
}

function buildSegmentsForPages(
  splitView: SplitView,
  colorMap: Map<string, string>,
  getPages: (
    split: SplitResult,
    splitIndex: number,
  ) => number[] | null | undefined,
): SplitDiagramSegment[] {
  return splitView.output
    .flatMap((split, splitIndex) =>
      buildPageRuns(getPages(split, splitIndex) ?? []).map((run, runIndex) => ({
        id: `${split.name}-${run.start_page}-${run.end_page}-${runIndex}`,
        splitName: split.name,
        startPage: run.start_page,
        endPage: run.end_page,
        nPages: run.end_page - run.start_page + 1,
        color: colorMap.get(split.name) ?? SPLIT_SEGMENT_PALETTE[0],
      })),
    )
    .sort(
      (left, right) =>
        left.startPage - right.startPage || left.endPage - right.endPage,
    )
}

export function buildSplitDiagramRows(splitView: SplitView): SplitDiagramRow[] {
  const colorMap = buildSplitDiagramColorMap(splitView)
  const maxVoteCount = Math.max(
    0,
    ...splitView.output.map(
      (_, splitIndex) => getSplitVotes(splitView, splitIndex).length,
    ),
  )

  const rows: SplitDiagramRow[] = [
    {
      id: "consensus",
      label: maxVoteCount > 0 ? "consensus" : "result",
      voteIndex: null,
      segments: buildSegmentsForPages(
        splitView,
        colorMap,
        (split) => split.pages,
      ),
    },
  ]

  for (let voteIndex = 0; voteIndex < maxVoteCount; voteIndex += 1) {
    const voteSegments = buildSegmentsForPages(
      splitView,
      colorMap,
      (_split, splitIndex) =>
        getSplitVotes(splitView, splitIndex)[voteIndex]?.pages,
    )

    if (voteSegments.length === 0) {
      continue
    }

    rows.push({
      id: `vote-${voteIndex + 1}`,
      label: `vote ${voteIndex + 1}`,
      voteIndex,
      segments: voteSegments,
    })
  }

  return rows.filter((row) => row.segments.length > 0)
}

export function getMaxSplitDiagramPage(
  splitView: SplitView | null | undefined,
): number {
  if (!splitView) {
    return 0
  }

  let maxPage = 0

  for (const [splitIndex, split] of splitView.output.entries()) {
    for (const page of split.pages) {
      if (page > maxPage) {
        maxPage = page
      }
    }

    for (const vote of getSplitVotes(splitView, splitIndex)) {
      for (const page of vote.pages) {
        if (page > maxPage) {
          maxPage = page
        }
      }
    }

    for (const partition of split.partitions ?? []) {
      for (const page of partition.pages) {
        if (page > maxPage) {
          maxPage = page
        }
      }
    }
  }

  return maxPage
}

export function buildSplitDiagramTicks(pageCount: number): number[] {
  if (pageCount <= 0) {
    return []
  }

  if (pageCount <= 12) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]
  const threshold = (pageCount / 12) * 0.8
  const step =
    niceSteps.find((candidate) => candidate >= threshold) ??
    niceSteps[niceSteps.length - 1]
  const ticks: number[] = []

  for (let page = step; page < pageCount; page += step) {
    ticks.push(page)
  }

  if (ticks[ticks.length - 1] !== pageCount) {
    ticks.push(pageCount)
  }

  return ticks
}
