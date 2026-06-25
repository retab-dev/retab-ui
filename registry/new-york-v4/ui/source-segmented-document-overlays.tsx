"use client";

import * as React from "react";

import type { SegmentedSourceFieldLink } from "@/components/ui/source-field-link";
import { rotateImageArea } from "@/components/ui/image-source";
import type {
  ImageFrameOverlayProps,
  ImageViewerHandle,
} from "@/components/ui/image-viewer";
import {
  PdfHighlight,
  type PageOverlayProps,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import type { SegmentAnchor } from "@/components/ui/segmented-document-model";
import { useSegmentedDocumentViewport } from "@/components/ui/segmented-document-provider";

const SOURCE_HIGHLIGHT_CLASS =
  "pointer-events-none absolute z-10 rounded-[2px] border border-blue-500/80 bg-blue-500/15 shadow-[0_4px_16px_rgb(37_99_235_/_18%)]";

type AnchorWithBounds = SegmentAnchor & {
  bounds: NonNullable<SegmentAnchor["bounds"]>;
};

type SegmentedSourceLink = Pick<SegmentedSourceFieldLink, "activeAnchors">;

function activeAnchorsForPage(
  anchors: readonly SegmentAnchor[],
  pageNumber: number,
): AnchorWithBounds[] {
  return anchors.filter(
    (anchor): anchor is AnchorWithBounds =>
      anchor.bounds != null && anchor.pageNumber === pageNumber,
  );
}

export function useSegmentedPdfViewerHandle() {
  const segmentedViewport = useSegmentedDocumentViewport();

  return React.useCallback(
    (handle: PdfViewerHandle | null) => {
      segmentedViewport.documentHandlers.setDocumentHandle(handle);
    },
    [segmentedViewport.documentHandlers],
  );
}

export function useSegmentedImageViewerHandle() {
  const segmentedViewport = useSegmentedDocumentViewport();

  return React.useCallback(
    (handle: ImageViewerHandle | null) => {
      segmentedViewport.documentHandlers.setDocumentHandle(
        handle
          ? {
              getViewportElement: handle.getViewportElement,
              scrollToPage: (pageNumber, options) => {
                handle.scrollToFrameArea(pageNumber, { top: 0 }, options);
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
                  options,
                );
              },
            }
          : null,
      );
    },
    [segmentedViewport.documentHandlers],
  );
}

export function useSegmentedPdfSourceOverlay(link: SegmentedSourceLink) {
  return React.useCallback(
    ({ pageNumber }: PageOverlayProps) => {
      const anchors = activeAnchorsForPage(link.activeAnchors, pageNumber);
      if (anchors.length === 0) return null;

      return (
        <>
          {anchors.map((anchor) => (
            <PdfHighlight
              key={anchor.id}
              className={SOURCE_HIGHLIGHT_CLASS}
              area={{
                left: anchor.bounds.x * 100,
                top: anchor.bounds.y * 100,
                width: anchor.bounds.width * 100,
                height: anchor.bounds.height * 100,
              }}
            />
          ))}
        </>
      );
    },
    [link.activeAnchors],
  );
}

export function useSegmentedImageSourceOverlay(link: SegmentedSourceLink) {
  return React.useCallback(
    ({ frameNumber, rotation }: ImageFrameOverlayProps) => {
      const anchors = activeAnchorsForPage(link.activeAnchors, frameNumber);
      if (anchors.length === 0) return null;

      return (
        <>
          {anchors.map((anchor) => {
            const area = rotateImageArea(
              {
                left: anchor.bounds.x * 100,
                top: anchor.bounds.y * 100,
                width: anchor.bounds.width * 100,
                height: anchor.bounds.height * 100,
              },
              rotation,
            );

            return (
              <div
                key={anchor.id}
                className={SOURCE_HIGHLIGHT_CLASS}
                style={{
                  left: `${area.left}%`,
                  top: `${area.top}%`,
                  width: `${area.width}%`,
                  height: `${area.height}%`,
                }}
              />
            );
          })}
        </>
      );
    },
    [link.activeAnchors],
  );
}
