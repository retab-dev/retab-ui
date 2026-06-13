"use client"

import * as React from "react"

import type { Source, SourceMap } from "@/lib/document-source"
import { useSourceLink } from "@/hooks/use-source-link"
import {
  renderImageSourceOverlay,
  useImageSourceTarget,
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
import imageSample from "@/components/viewers/sample-data/image-sources.json"

const IMAGE_URL = "/samples/an-image-is-worth-16x16-words-page-1.png"

type ImageField = SourceField & { source: Source }

// Real values read off the scanned page with normalized image_bbox anchors.
const FIELDS = imageSample as ImageField[]
const SOURCES: SourceMap = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.source])
)

/**
 * Image sources block — extracted fields beside a scanned page image. Hovering a
 * field highlights its image_bbox region and scrolls to it. Same source-link
 * abstraction as the PDF block, swapping in the image viewer + its adapter.
 */
export function ImageSourcesBlock() {
  const viewerRef = React.useRef<ImageViewerHandle>(null)
  const target = useImageSourceTarget(viewerRef)
  const link = useSourceLink({
    sources: SOURCES,
    target,
    initialField: FIELDS[0]?.key,
  })

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="relative min-w-0 flex-1">
        <ImageViewer
          ref={viewerRef}
          source={{
            kind: "url",
            url: IMAGE_URL,
            fileName: "an-image-is-worth-16x16-words-page-1.png",
          }}
          bare
          className="h-full"
          renderFrameOverlay={renderImageSourceOverlay(link.activeSource)}
        />
        <SourceIndicator path={link.activePath} found={!!link.activeSource} />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}
