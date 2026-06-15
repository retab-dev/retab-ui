"use client"

import type { Source } from "@/lib/document-source"
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link"
import { ImageViewer } from "@/components/ui/image-viewer"
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
  useSegmentedImageSourceOverlay,
  useSegmentedImageViewerHandle,
} from "@/components/ui/source-segmented-document-overlays"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
import imageSample from "@/components/viewers/sample-data/image-sources.json"

const IMAGE_URL = "/samples/an-image-is-worth-16x16-words-page-1.png"

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
  const link = useSegmentedSourceFieldLink({ initialPath: FIELDS[0]?.key })
  const { documentHandlers } = useSegmentedDocumentViewport()
  const renderFrameOverlay = useSegmentedImageSourceOverlay(link)
  const setImageViewerHandle = useSegmentedImageViewerHandle()

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
            onScrollProgressChange={documentHandlers.onScrollProgressChange}
            onVisibleFrameChange={documentHandlers.onCurrentPageChange}
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
