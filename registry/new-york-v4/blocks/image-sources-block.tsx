"use client";

import type { Source } from "@/lib/document-source";
import {
  FileViewer,
  FileViewerBody,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerInset,
  FileViewerToolbar,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { ImageViewer } from "@/components/ui/image-viewer";
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider";
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link";
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list";
import { createSourcesSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model";
import {
  useSegmentedImageSourceOverlay,
  useSegmentedImageViewerHandle,
} from "@/components/ui/source-segmented-document-overlays";
import imageSample from "@/components/viewers/sample-data/image-sources.json";

const IMAGE_URL = "/samples/an-image-is-worth-16x16-words-page-1.png";
const IMAGE_SOURCE = {
  kind: "url" as const,
  url: IMAGE_URL,
  fileName: "an-image-is-worth-16x16-words-page-1.png",
};

type ImageField = SourceField & { source: Source };

// Real values read off the scanned page with normalized image_bbox anchors.
const FIELDS = imageSample as ImageField[];
const SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    source: field.source,
  })),
);

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
  );
}

function ImageSourcesContent() {
  const link = useSegmentedSourceFieldLink({
    initialSourcePath: FIELDS[0]?.key,
  });
  const { documentHandlers } = useSegmentedDocumentViewport();
  const renderFrameOverlay = useSegmentedImageSourceOverlay(link);
  const setImageViewerHandle = useSegmentedImageViewerHandle();

  return (
    <FileViewerProvider
      source={IMAGE_SOURCE}
      fallbackFrameSize={{ width: 1224, height: 1584 }}
      defaultSidebarOpen
    >
      <FileViewer
        className="bg-background h-full min-h-[680px]"
        sidebarSide="right"
      >
        <FileViewerHeader>
          <FileViewerHeaderStart>
            <FileViewerIdentity />
          </FileViewerHeaderStart>
          <FileViewerHeaderEnd>
            <FileViewerToolbar />
          </FileViewerHeaderEnd>
        </FileViewerHeader>
        <FileViewerBody>
          <FileViewerInset>
            <FileViewerViewport>
              <ImageViewer
                ref={setImageViewerHandle}
                source={IMAGE_SOURCE}
                bare
                className="h-full"
                controls={false}
                fallbackFrameSize={{ width: 1224, height: 1584 }}
                onScrollProgressChange={documentHandlers.onScrollProgressChange}
                onVisibleFrameChange={documentHandlers.onCurrentPageChange}
                renderFrameOverlay={renderFrameOverlay}
              />
            </FileViewerViewport>
          </FileViewerInset>
          <FileViewerSidebar
            aria-label="Source fields"
            side="right"
            collapsible="none"
            width="360px"
            className="border-l"
          >
            <FileViewerSidebarContent>
              <SourceFieldList fields={FIELDS} link={link} />
            </FileViewerSidebarContent>
          </FileViewerSidebar>
        </FileViewerBody>
      </FileViewer>
    </FileViewerProvider>
  );
}
