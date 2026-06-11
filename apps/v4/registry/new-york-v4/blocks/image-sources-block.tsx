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
import imageSample from "@/components/viewers/sample-data/image-sources.json"

const IMAGE_URL = "/samples/attention-page-1.png"

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
  const link = useSourceLink({ sources: SOURCES, target })

  React.useEffect(() => {
    if (FIELDS[0]) link.selectField(FIELDS[0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="min-w-0 flex-1">
        <ImageViewer
          ref={viewerRef}
          src={IMAGE_URL}
          bare
          downloadFileName="attention-page-1.png"
          className="h-full"
          renderPageOverlay={renderImageSourceOverlay(link.activeSource)}
        />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}
