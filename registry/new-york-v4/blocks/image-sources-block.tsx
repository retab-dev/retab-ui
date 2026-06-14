"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import {
  useSegmentedFieldLink,
  type SegmentedFieldAnchorLink,
} from "@/components/ui/field-anchor-link"
import { rotateImageArea } from "@/components/ui/image-source"
import {
  ImageViewer,
  type ImageFrameOverlayProps,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { sourceFieldsToSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
import imageSample from "@/components/viewers/sample-data/image-sources.json"

const IMAGE_URL = "/samples/an-image-is-worth-16x16-words-page-1.png"
const HIGHLIGHT_CLASS =
  "pointer-events-none absolute z-10 rounded-[2px] border border-primary/70 bg-primary/12 shadow-[0_4px_16px_rgb(0_0_0_/_8%)]"

type ImageField = SourceField & { source: Source }

// Real values read off the scanned page with normalized image_bbox anchors.
const FIELDS = imageSample as ImageField[]
const SEGMENTED_DOCUMENT = sourceFieldsToSegmentedDocumentModel(
  FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    source: field.source,
  }))
)

/**
 * Image sources block — extracted fields beside a scanned page image. Hovering a
 * field highlights its image_bbox region and scrolls to it through the segmented
 * document provider.
 */
export function ImageSourcesBlock() {
  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <ImageSourcesContent />
    </SegmentedDocumentProvider>
  )
}

function ImageSourcesContent() {
  const link = useSegmentedFieldLink({ initialPath: FIELDS[0]?.key })
  const segmentedViewport = useSegmentedDocumentViewport()
  const renderFrameOverlay = useSegmentedImageSourceOverlay(link)
  const setImageViewerHandle = React.useCallback(
    (handle: ImageViewerHandle | null) => {
      segmentedViewport.documentHandlers.setDocumentHandle(
        handle
          ? {
              getViewportElement: handle.getViewportElement,
              scrollToPage: (pageNumber, options) => {
                handle.scrollToFrameArea(pageNumber, { top: 0 }, options)
              },
              scrollToPageArea: (target, options) => {
                handle.scrollToFrameArea(
                  target.pageNumber,
                  {
                    left: target.left,
                    top: target.top,
                    width: target.width,
                    height: target.height,
                  },
                  options
                )
              },
            }
          : null
      )
    },
    [segmentedViewport.documentHandlers]
  )

  return (
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
          <ImageViewer
            ref={setImageViewerHandle}
            source={{
              kind: "url",
              url: IMAGE_URL,
              fileName: "an-image-is-worth-16x16-words-page-1.png",
            }}
            bare
            className="h-full"
            onScrollProgressChange={
              segmentedViewport.documentHandlers.onScrollProgressChange
            }
            onVisibleFrameChange={
              segmentedViewport.documentHandlers.onCurrentPageChange
            }
            renderFrameOverlay={renderFrameOverlay}
          />
          <SourceIndicator path={link.activePath} found={!!link.activeAnchor} />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Source fields"
          side="right"
          collapsible="none"
          width="360px"
          className="border-l"
        >
          <SourceFieldList fields={FIELDS} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}

function useSegmentedImageSourceOverlay(link: SegmentedFieldAnchorLink) {
  return React.useCallback(
    ({ frameNumber, rotation }: ImageFrameOverlayProps) => {
      const anchor = link.activeAnchor
      if (!anchor?.bounds || anchor.pageNumber !== frameNumber) return null

      const area = rotateImageArea(
        {
          left: anchor.bounds.x * 100,
          top: anchor.bounds.y * 100,
          width: anchor.bounds.width * 100,
          height: anchor.bounds.height * 100,
        },
        rotation
      )
      return (
        <div
          className={HIGHLIGHT_CLASS}
          style={{
            left: `${area.left}%`,
            top: `${area.top}%`,
            width: `${area.width}%`,
            height: `${area.height}%`,
          }}
        />
      )
    },
    [link.activeAnchor]
  )
}
