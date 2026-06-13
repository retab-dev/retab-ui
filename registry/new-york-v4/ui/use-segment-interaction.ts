"use client"

import * as React from "react"

import { type SegmentInteraction } from "@/lib/segment-interaction"

export interface ControlledSegmentInteractionOptions {
  hoveredSegmentId: string | null
  focusedSegmentId: string | null
  setHoveredSegmentId: (segmentId: string | null) => void
  setFocusedSegmentId: (segmentId: string | null) => void
}

export function useSegmentInteraction(): SegmentInteraction {
  const [hoveredSegmentId, setHoveredSegmentId] = React.useState<string | null>(
    null
  )
  const [focusedSegmentId, setFocusedSegmentId] = React.useState<string | null>(
    null
  )

  return useSegmentInteractionObject({
    hoveredSegmentId,
    focusedSegmentId,
    setHoveredSegmentId,
    setFocusedSegmentId,
  })
}

export function useControlledSegmentInteraction(
  options: ControlledSegmentInteractionOptions
): SegmentInteraction {
  return useSegmentInteractionObject(options)
}

function useSegmentInteractionObject({
  hoveredSegmentId,
  focusedSegmentId,
  setHoveredSegmentId,
  setFocusedSegmentId,
}: ControlledSegmentInteractionOptions): SegmentInteraction {
  const previewSegment = React.useCallback(
    (segmentId: string) => setHoveredSegmentId(segmentId),
    [setHoveredSegmentId]
  )
  const clearPreview = React.useCallback(
    () => setHoveredSegmentId(null),
    [setHoveredSegmentId]
  )
  const focusSegment = React.useCallback(
    (segmentId: string) => setFocusedSegmentId(segmentId),
    [setFocusedSegmentId]
  )
  const clearFocus = React.useCallback(
    () => setFocusedSegmentId(null),
    [setFocusedSegmentId]
  )

  return React.useMemo(
    () => ({
      hoveredSegmentId,
      focusedSegmentId,
      previewSegment,
      clearPreview,
      focusSegment,
      clearFocus,
    }),
    [
      clearFocus,
      clearPreview,
      focusSegment,
      focusedSegmentId,
      hoveredSegmentId,
      previewSegment,
    ]
  )
}
