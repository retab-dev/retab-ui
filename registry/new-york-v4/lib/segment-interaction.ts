import { type Segment } from "@/lib/segments"

export interface SegmentInteraction {
  hoveredId: string | null
  focusedId: string | null
  selectedId: string | null
  setHoveredId: (id: string | null) => void
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  clearSelection: () => void
  selectSegment: (segment: Segment) => void
}

export interface SegmentInteractionSnapshot {
  isHovered: boolean
  isFocused: boolean
  isSelected: boolean
  isHighlighted: boolean
  isCurrent: boolean
  isDimmed: boolean
}

export interface SegmentSurfaceProps {
  state: SegmentInteractionSnapshot
  eventHandlers: {
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocus: () => void
    onBlur: () => void
    onClick: () => void
  }
  ariaProps: {
    "aria-pressed": boolean
  }
  dataProps: {
    "data-highlighted": boolean
    "data-current": boolean
    "data-selected": boolean
  }
}

export function resolveHighlightedSegmentId(
  interaction?: Partial<
    Pick<SegmentInteraction, "hoveredId" | "focusedId" | "selectedId">
  > | null
): string | null {
  return (
    interaction?.hoveredId ??
    interaction?.focusedId ??
    interaction?.selectedId ??
    null
  )
}

export function scopeSegmentInteraction(
  interaction: SegmentInteraction | null | undefined,
  segmentIds: Iterable<string>
): SegmentInteraction | null | undefined {
  if (!interaction) return interaction

  const knownIds = new Set(segmentIds)
  const hoveredId = knownSegmentId(interaction.hoveredId, knownIds)
  const focusedId = knownSegmentId(interaction.focusedId, knownIds)
  const selectedId = knownSegmentId(interaction.selectedId, knownIds)

  if (
    hoveredId === interaction.hoveredId &&
    focusedId === interaction.focusedId &&
    selectedId === interaction.selectedId
  ) {
    return interaction
  }

  return {
    ...interaction,
    hoveredId,
    focusedId,
    selectedId,
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
  return currentPage != null && segment.pages.includes(currentPage)
}

export function getSegmentInteractionState({
  segment,
  interaction,
  currentPage,
  isCurrent,
}: {
  segment: Segment
  interaction?: SegmentInteraction | null
  currentPage?: number | null
  isCurrent?: boolean
}): SegmentInteractionSnapshot {
  const highlightedSegmentId = resolveHighlightedSegmentId(interaction)
  const current = isCurrent ?? isSegmentCurrentPage(segment, currentPage)
  const isHovered = interaction?.hoveredId === segment.id
  const isFocused = interaction?.focusedId === segment.id
  const isSelected = interaction?.selectedId === segment.id
  const isHighlighted = highlightedSegmentId === segment.id

  return {
    isHovered,
    isFocused,
    isSelected,
    isHighlighted,
    isCurrent: current,
    isDimmed: highlightedSegmentId != null && !isHighlighted,
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
  const state = getSegmentInteractionState({
    segment,
    interaction,
    currentPage,
    isCurrent,
  })

  return {
    state,
    eventHandlers: {
      onMouseEnter: () => interaction?.setHoveredId(segment.id),
      onMouseLeave: () => interaction?.setHoveredId(null),
      onFocus: () => interaction?.setFocusedId(segment.id),
      onBlur: () => interaction?.setFocusedId(null),
      onClick: () => {
        interaction?.selectSegment(segment)
        onSelect?.(segment)
      },
    },
    ariaProps: {
      "aria-pressed": state.isSelected,
    },
    dataProps: {
      "data-highlighted": state.isHighlighted,
      "data-current": state.isCurrent,
      "data-selected": state.isSelected,
    },
  }
}
