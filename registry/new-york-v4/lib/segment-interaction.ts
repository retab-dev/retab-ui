import { type Segment } from "@/lib/segments"

export interface SegmentInteraction {
  previewSegmentId: string | null
  previewSegment: (segmentId: string) => void
  clearPreview: () => void
}

export interface SegmentInteractionState {
  currentPage: number | null
  currentSegmentId: string | null
  currentSegmentIds: readonly string[]
  previewSegmentId: string | null
  highlightedSegmentId: string | null
  highlightedSegmentIds: readonly string[]
}

export interface SegmentViewState {
  isPreviewed: boolean
  isCurrent: boolean
  isHighlighted: boolean
  isDimmed: boolean
}

export interface SegmentSurfaceProps {
  state: SegmentViewState
  eventHandlers: {
    onPointerEnter: () => void
    onPointerLeave: () => void
    onClick: () => void
  }
  dataProps: {
    "data-previewed": boolean
    "data-current": boolean
    "data-highlighted": boolean
  }
}

export function resolvePreviewedSegmentId(
  interaction?: Partial<Pick<SegmentInteraction, "previewSegmentId">> | null
): string | null {
  return interaction?.previewSegmentId ?? null
}

export function getSegmentInteractionState({
  segments,
  currentPage,
  interaction,
}: {
  segments: Segment[]
  currentPage?: number | null
  interaction?: SegmentInteraction | null
}): SegmentInteractionState {
  const segmentIds = new Set(segments.map((segment) => segment.id))
  const previewSegmentId = knownSegmentId(
    resolvePreviewedSegmentId(interaction),
    segmentIds
  )
  const resolvedCurrentPage = normalizeCurrentPage(currentPage)
  const currentSegmentIds =
    resolvedCurrentPage == null
      ? []
      : resolveCurrentSegmentIds(segments, resolvedCurrentPage)
  const highlightedSegmentIds =
    previewSegmentId != null ? [previewSegmentId] : currentSegmentIds

  return {
    currentPage: resolvedCurrentPage,
    currentSegmentId: currentSegmentIds[0] ?? null,
    currentSegmentIds,
    previewSegmentId,
    highlightedSegmentId: highlightedSegmentIds[0] ?? null,
    highlightedSegmentIds,
  }
}

export function scopeSegmentInteraction(
  interaction: SegmentInteraction | null | undefined,
  segmentIds: Iterable<string>
): SegmentInteraction | null | undefined {
  if (!interaction) return interaction

  const knownIds = new Set(segmentIds)
  const previewSegmentId = knownSegmentId(
    interaction.previewSegmentId,
    knownIds
  )

  if (previewSegmentId === interaction.previewSegmentId) {
    return interaction
  }

  return {
    ...interaction,
    previewSegmentId,
  }
}

function knownSegmentId(
  id: string | null,
  knownIds: ReadonlySet<string>
): string | null {
  return id != null && knownIds.has(id) ? id : null
}

export function isSegmentCurrentPage(
  segment: Segment,
  currentPage?: number | null
): boolean {
  return (
    currentPage != null &&
    Number.isInteger(currentPage) &&
    currentPage > 0 &&
    Array.isArray(segment.pages) &&
    segment.pages.includes(currentPage)
  )
}

function normalizeCurrentPage(currentPage?: number | null): number | null {
  return currentPage != null &&
    Number.isInteger(currentPage) &&
    currentPage > 0
    ? currentPage
    : null
}

function resolveCurrentSegmentIds(
  segments: Segment[],
  currentPage: number
): string[] {
  return segments
    .filter((segment) => isSegmentCurrentPage(segment, currentPage))
    .map((segment) => segment.id)
}

export function getSegmentViewState({
  segment,
  interactionState,
  isCurrent,
}: {
  segment: Segment
  interactionState: SegmentInteractionState
  isCurrent?: boolean
}): SegmentViewState {
  const current =
    isCurrent ??
    (interactionState.currentSegmentIds.includes(segment.id) &&
      isSegmentCurrentPage(segment, interactionState.currentPage))
  const isPreviewed = interactionState.previewSegmentId === segment.id
  const isHighlighted =
    interactionState.highlightedSegmentIds.includes(segment.id) &&
    (interactionState.previewSegmentId != null ? isPreviewed : current)

  return {
    isPreviewed,
    isCurrent: current,
    isHighlighted,
    isDimmed: interactionState.previewSegmentId != null && !isPreviewed,
  }
}

export function getSegmentSurfaceProps({
  segment,
  interaction,
  interactionState,
  isCurrent,
  onSelect,
}: {
  segment: Segment
  interaction?: SegmentInteraction | null
  interactionState: SegmentInteractionState
  isCurrent?: boolean
  onSelect?: (segment: Segment) => void
}): SegmentSurfaceProps {
  const state = getSegmentViewState({
    segment,
    interactionState,
    isCurrent,
  })

  return {
    state,
    eventHandlers: {
      onPointerEnter: () => interaction?.previewSegment(segment.id),
      onPointerLeave: () => interaction?.clearPreview(),
      onClick: () => {
        interaction?.clearPreview()
        onSelect?.(segment)
      },
    },
    dataProps: {
      "data-previewed": state.isPreviewed,
      "data-current": state.isCurrent,
      "data-highlighted": state.isHighlighted,
    },
  }
}
