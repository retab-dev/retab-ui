"use client"

import * as React from "react"

import type { AnchoredItemId } from "./anchored-document-viewer"
import { useAnchoredItemLink } from "./anchored-document-viewer"
import type { DocumentSegment, SegmentAnchor } from "./segmented-document-model"
import { useSegmentedDocument } from "./segmented-document-provider"

export type FieldAnchorLink = {
  activePath: string | null
  onFieldHover: (path: string | null) => void
  selectField?: (path: string) => void
}

export type SegmentedFieldAnchorLink = FieldAnchorLink & {
  activeAnchor: SegmentAnchor | null
  activeSegment: DocumentSegment | null
  selectedPath: string | null
}

export type SegmentedFieldLinkOptions = {
  initialPath?: string | null
}

export function useAnchoredFieldLink(): FieldAnchorLink {
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

export function useSegmentedFieldLink(
  options: SegmentedFieldLinkOptions = {}
): SegmentedFieldAnchorLink {
  const { model, viewport } = useSegmentedDocument()
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)
  const segmentByPath = React.useMemo(
    () =>
      new Map(
        model.segments.map((segment) => [
          segment.sourceId ?? segment.id,
          segment,
        ])
      ),
    [model.segments]
  )
  const anchorBySegmentId = React.useMemo(
    () =>
      new Map(
        (model.anchors ?? []).map((anchor) => [anchor.segmentId, anchor])
      ),
    [model.anchors]
  )
  const previewSegment =
    model.segments.find(
      (segment) => segment.id === viewport.model.previewSegmentId
    ) ?? null
  const selectedSegment = selectedPath
    ? (segmentByPath.get(selectedPath) ?? null)
    : null
  const activeSegment = previewSegment ?? selectedSegment
  const activePath = activeSegment?.sourceId ?? selectedPath
  const activeAnchor = activeSegment
    ? (anchorBySegmentId.get(activeSegment.id) ?? null)
    : null

  React.useEffect(() => {
    if (selectedPath && !segmentByPath.has(selectedPath)) {
      setSelectedPath(null)
    }
  }, [segmentByPath, selectedPath])

  React.useEffect(() => {
    const initialPath = options.initialPath ?? null
    if (
      !initialPath ||
      selectedPath != null ||
      !segmentByPath.has(initialPath)
    ) {
      return
    }
    setSelectedPath(initialPath)
  }, [options.initialPath, segmentByPath, selectedPath])

  const navigateSegment = React.useCallback(
    (
      segment: DocumentSegment,
      options?: { behavior?: ScrollBehavior; clearPreview?: boolean }
    ) => {
      const anchor = anchorBySegmentId.get(segment.id)
      if (anchor) {
        viewport.navigation.scrollToAnchor(anchor, options)
        return
      }
      viewport.navigation.scrollToSegmentStart(segment, options)
    },
    [anchorBySegmentId, viewport.navigation]
  )

  const onFieldHover = React.useCallback(
    (path: string | null) => {
      if (!path) {
        viewport.interaction.clearPreview()
        return
      }

      const segment = segmentByPath.get(path)
      if (!segment) return

      viewport.interaction.previewSegment(segment.id)
      navigateSegment(segment, { behavior: "auto", clearPreview: false })
    },
    [navigateSegment, segmentByPath, viewport.interaction]
  )

  const selectField = React.useCallback(
    (path: string) => {
      const segment = segmentByPath.get(path)
      if (!segment) return

      setSelectedPath(path)
      viewport.interaction.clearPreview()
      navigateSegment(segment, { behavior: "smooth", clearPreview: false })
    },
    [navigateSegment, segmentByPath, viewport.interaction]
  )

  return React.useMemo(
    () => ({
      activeAnchor,
      activePath,
      activeSegment,
      onFieldHover,
      selectField,
      selectedPath,
    }),
    [
      activeAnchor,
      activePath,
      activeSegment,
      onFieldHover,
      selectField,
      selectedPath,
    ]
  )
}
