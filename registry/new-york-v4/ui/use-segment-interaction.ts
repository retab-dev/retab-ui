"use client"

import * as React from "react"

import { type SegmentInteraction } from "@/lib/segment-interaction"
import { type Segment } from "@/lib/segments"

export interface ControlledSegmentInteractionOptions {
  hoveredId: string | null
  focusedId: string | null
  selectedId: string | null
  setHoveredId: (id: string | null) => void
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
}

export function useSegmentInteraction(): SegmentInteraction {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null)
  const [focusedId, setFocusedId] = React.useState<string | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  return useSegmentInteractionObject({
    hoveredId,
    focusedId,
    selectedId,
    setHoveredId,
    setFocusedId,
    setSelectedId,
  })
}

export function useControlledSegmentInteraction(
  options: ControlledSegmentInteractionOptions
): SegmentInteraction {
  return useSegmentInteractionObject(options)
}

function useSegmentInteractionObject({
  hoveredId,
  focusedId,
  selectedId,
  setHoveredId,
  setFocusedId,
  setSelectedId,
}: ControlledSegmentInteractionOptions): SegmentInteraction {
  const selectSegment = React.useCallback(
    (segment: Segment) => {
      setSelectedId(segment.id)
    },
    [setSelectedId]
  )

  const clearSelection = React.useCallback(() => {
    setSelectedId(null)
  }, [setSelectedId])

  return React.useMemo(
    () => ({
      hoveredId,
      focusedId,
      selectedId,
      setHoveredId,
      setFocusedId,
      setSelectedId,
      selectSegment,
      clearSelection,
    }),
    [
      clearSelection,
      focusedId,
      hoveredId,
      selectedId,
      selectSegment,
      setFocusedId,
      setHoveredId,
      setSelectedId,
    ]
  )
}
