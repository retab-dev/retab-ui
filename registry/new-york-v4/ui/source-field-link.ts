"use client"

import * as React from "react"

import type { AnchoredItemId } from "./anchored-document-viewer"
import { useAnchoredItemLink } from "./anchored-document-viewer"
import type { DocumentSegment, SegmentAnchor } from "./segmented-document-model"
import { useSegmentedItemLink } from "./segmented-item-link"

export type SourceFieldLink = {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField?: (path: string) => void
}

export type SegmentedSourceFieldLink = SourceFieldLink & {
  activeAnchor: SegmentAnchor | null
  activeAnchors: readonly SegmentAnchor[]
  activeSegment: DocumentSegment | null
  selectedPath: string | null
}

export type SegmentedSourceFieldLinkOptions = {
  initialPath?: string | null
}

export function useAnchoredSourceFieldLink(): SourceFieldLink {
  const { activateItem, activeItemId, previewItem } = useAnchoredItemLink()
  return React.useMemo(
    () => ({
      activePath: activeItemId,
      onFieldHover: (path: string | null) => {
        previewItem(path as AnchoredItemId | null)
      },
      selectField: (path: string) => {
        activateItem(path)
      },
    }),
    [activateItem, activeItemId, previewItem]
  )
}

export function useSegmentedSourceFieldLink(
  options: SegmentedSourceFieldLinkOptions = {}
): SegmentedSourceFieldLink {
  const link = useSegmentedItemLink({ initialItemId: options.initialPath })

  const onFieldHover = React.useCallback(
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

  const selectField = React.useCallback(
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
      activePath: link.activeItemId,
      activeSegment: link.activeSegment,
      onFieldHover,
      selectField,
      selectedPath: link.selectedItemId,
    }),
    [
      link.activeAnchor,
      link.activeAnchors,
      link.activeItemId,
      link.activeSegment,
      link.selectedItemId,
      onFieldHover,
      selectField,
    ]
  )
}
