import { type Segment } from "@/lib/segments"

export interface SegmentInteraction {
  hoveredSegmentId: string | null
  focusedSegmentId: string | null
  previewSegment: (segmentId: string) => void
  clearPreview: () => void
  focusSegment: (segmentId: string) => void
  clearFocus: () => void
}

export interface SegmentViewState {
  isHovered: boolean
  isFocused: boolean
  isPreviewed: boolean
  isCurrent: boolean
  isActive: boolean
  isDimmed: boolean
}

export interface SegmentSurfaceProps {
  state: SegmentViewState
  eventHandlers: {
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocus: () => void
    onBlur: () => void
    onClick: () => void
  }
  dataProps: {
    "data-previewed": boolean
    "data-current": boolean
    "data-active": boolean
  }
}

export function resolvePreviewedSegmentId(
  interaction?: Partial<
    Pick<SegmentInteraction, "hoveredSegmentId" | "focusedSegmentId">
  > | null
): string | null {
  return interaction?.hoveredSegmentId ?? interaction?.focusedSegmentId ?? null
}

export function scopeSegmentInteraction(
  interaction: SegmentInteraction | null | undefined,
  segmentIds: Iterable<string>
): SegmentInteraction | null | undefined {
  if (!interaction) return interaction

  const knownIds = new Set(segmentIds)
  const hoveredSegmentId = knownSegmentId(
    interaction.hoveredSegmentId,
    knownIds
  )
  const focusedSegmentId = knownSegmentId(
    interaction.focusedSegmentId,
    knownIds
  )

  if (
    hoveredSegmentId === interaction.hoveredSegmentId &&
    focusedSegmentId === interaction.focusedSegmentId
  ) {
    return interaction
  }

  return {
    ...interaction,
    hoveredSegmentId,
    focusedSegmentId,
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

export function getSegmentViewState({
  segment,
  interaction,
  currentPage,
  isCurrent,
}: {
  segment: Segment
  interaction?: SegmentInteraction | null
  currentPage?: number | null
  isCurrent?: boolean
}): SegmentViewState {
  const previewedSegmentId = resolvePreviewedSegmentId(interaction)
  const current = isCurrent ?? isSegmentCurrentPage(segment, currentPage)
  const isHovered = interaction?.hoveredSegmentId === segment.id
  const isFocused = interaction?.focusedSegmentId === segment.id
  const isPreviewed = previewedSegmentId === segment.id

  return {
    isHovered,
    isFocused,
    isPreviewed,
    isCurrent: current,
    isActive: current || isPreviewed,
    isDimmed: previewedSegmentId != null && !isPreviewed,
  }
}

export function getSegmentSurfaceProps({
  segment,
  interaction,
  currentPage,
  isCurrent,
  onSelect,
}: {
  segment: Segment
  interaction?: SegmentInteraction | null
  currentPage?: number | null
  isCurrent?: boolean
  onSelect?: (segment: Segment) => void
}): SegmentSurfaceProps {
  const state = getSegmentViewState({
    segment,
    interaction,
    currentPage,
    isCurrent,
  })

  return {
    state,
    eventHandlers: {
      onMouseEnter: () => interaction?.previewSegment(segment.id),
      onMouseLeave: () => interaction?.clearPreview(),
      onFocus: () => interaction?.focusSegment(segment.id),
      onBlur: () => interaction?.clearFocus(),
      onClick: () => {
        interaction?.clearPreview()
        interaction?.clearFocus()
        onSelect?.(segment)
      },
    },
    dataProps: {
      "data-previewed": state.isPreviewed,
      "data-current": state.isCurrent,
      "data-active": state.isActive,
    },
  }
}
