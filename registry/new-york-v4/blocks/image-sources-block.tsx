"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import {
  AnchoredDocumentProvider,
  useAnchoredDocument,
  useAnchoredFieldLink,
  type AnchoredDocumentTarget,
  type AnchoredItem,
} from "@/components/ui/anchored-document-viewer"
import {
  imageAnchorToTarget,
  rotateImageArea,
} from "@/components/ui/image-source"
import {
  ImageViewer,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
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
const ITEMS: AnchoredItem[] = FIELDS.map((field) => {
  const target = imageAnchorToTarget(field.source.anchor)
  return {
    id: field.key,
    anchor: target
      ? {
          kind: "image-area",
          frameNumber: target.frame,
          left: target.area.left,
          top: target.area.top,
          width: target.area.width,
          height: target.area.height,
        }
      : null,
  }
})

/**
 * Image sources block — extracted fields beside a scanned page image. Hovering a
 * field highlights its image_bbox region and scrolls to it through the anchored
 * document provider.
 */
export function ImageSourcesBlock() {
  const viewerRef = React.useRef<ImageViewerHandle>(null)
  const target = useImageAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider
      items={ITEMS}
      target={target}
      initialItemId={FIELDS[0]?.key}
    >
      <ImageSourcesContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function ImageSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<ImageViewerHandle | null>
}) {
  const link = useAnchoredFieldLink()
  const { activeAnchor, activeItem } = useAnchoredDocument()
  const renderFrameOverlay = React.useCallback(
    ({ frameNumber, rotation }: { frameNumber: number; rotation: number }) => {
      if (
        activeAnchor?.kind !== "image-area" ||
        (activeAnchor.frameNumber ?? 1) !== frameNumber
      ) {
        return null
      }
      const area = rotateImageArea(
        {
          left: activeAnchor.left,
          top: activeAnchor.top,
          width: activeAnchor.width,
          height: activeAnchor.height,
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
    [activeAnchor]
  )

  return (
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
          <ImageViewer
            ref={viewerRef}
            source={{
              kind: "url",
              url: IMAGE_URL,
              fileName: "an-image-is-worth-16x16-words-page-1.png",
            }}
            bare
            className="h-full"
            renderFrameOverlay={renderFrameOverlay}
          />
          <SourceIndicator
            path={link.activePath}
            found={!!activeItem?.anchor}
          />
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

function useImageAnchoredTarget(
  viewerRef: React.RefObject<ImageViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "image-area") return
        viewerRef.current?.scrollToFrameArea(
          anchor.frameNumber ?? 1,
          {
            left: anchor.left,
            top: anchor.top,
            width: anchor.width,
            height: anchor.height,
          },
          options
        )
      },
    }),
    [viewerRef]
  )
}
