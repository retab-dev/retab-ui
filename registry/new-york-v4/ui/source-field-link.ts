"use client"

import * as React from "react"

import type { DocumentSegment, SegmentAnchor } from "./segmented-document-model"
import { useSegmentedItemLink } from "./segmented-item-link"

export type SourceFieldLink = {
  activeSourcePath: string | null
  onSourceHover: (path: string | null) => void
  selectSourcePath?: (path: string) => void
}

export type SegmentedSourceFieldLink = SourceFieldLink & {
  activeAnchor: SegmentAnchor | null
  activeAnchors: readonly SegmentAnchor[]
  activeSegment: DocumentSegment | null
  selectedSourcePath: string | null
}

export type SegmentedSourceFieldLinkOptions = {
  initialSourcePath?: string | null
}

export function useSegmentedSourceFieldLink(
  options: SegmentedSourceFieldLinkOptions = {}
): SegmentedSourceFieldLink {
  const link = useSegmentedItemLink({
    initialItemId: options.initialSourcePath,
  })

  const onSourceHover = React.useCallback(
    (path: string | null) => {
      if (!path) {
        link.previewItem(null)
        return
      }

      link.previewItem(path)
      link.navigateItem(path, { behavior: "auto", clearPreview: false })
    },
    [link]
  )

  const selectSourcePath = React.useCallback(
    (path: string) => {
      link.selectItem(path)
      link.navigateItem(path, { behavior: "smooth", clearPreview: false })
    },
    [link]
  )

  return React.useMemo(
    () => ({
      activeAnchor: link.activeAnchor,
      activeAnchors: link.activeAnchors,
      activeSourcePath: link.activeItemId,
      activeSegment: link.activeSegment,
      onSourceHover,
      selectSourcePath,
      selectedSourcePath: link.selectedItemId,
    }),
    [
      link.activeAnchor,
      link.activeAnchors,
      link.activeItemId,
      link.activeSegment,
      link.selectedItemId,
      onSourceHover,
      selectSourcePath,
    ]
  )
}
