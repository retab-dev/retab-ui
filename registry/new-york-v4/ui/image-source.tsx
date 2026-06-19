"use client";

import * as React from "react";

import type { Source, SourceAnchor, SourceArea } from "@/lib/document-source";
import { normalizeRotation, rotateNormalizedBox } from "@/lib/image-geometry";
import {
  type ImageFrameOverlayProps,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer-types";

const HIGHLIGHT_CLASS =
  "pointer-events-none absolute z-10 rounded-[2px] border border-primary/70 bg-primary/12 shadow-[0_4px_16px_rgb(0_0_0_/_8%)]";

export interface SourceTarget {
  scrollTo?: (source: Source, options: { behavior: ScrollBehavior }) => void;
}

export interface ImageSourceTarget {
  frame: number;
  area: SourceArea;
}

/** A normalized image/pdf bbox anchor → the frame and percentage box to target. */
export function imageAnchorToTarget(
  anchor: SourceAnchor,
): ImageSourceTarget | undefined {
  if (anchor.kind === "image_bbox" || anchor.kind === "pdf_bbox") {
    const frame = imageAnchorFrame(anchor);
    if (!isValidNormalizedBox(anchor)) return undefined;
    if (frame === undefined) return undefined;
    return {
      frame,
      area: {
        left: anchor.left * 100,
        top: anchor.top * 100,
        width: anchor.width * 100,
        height: anchor.height * 100,
      },
    };
  }
  return undefined;
}

/**
 * The 1-based frame a bbox anchor lives on, or undefined if it isn't a raster
 * bbox. `image_bbox` defaults to frame 1 (single image); a multi-frame TIFF (or
 * a rasterized slide deck) sets `page` explicitly.
 */
function imageAnchorFrame(anchor: SourceAnchor): number | undefined {
  if (anchor.kind === "image_bbox") {
    const frame = anchor.page ?? 1;
    return isPositiveInteger(frame) ? frame : undefined;
  }
  if (anchor.kind === "pdf_bbox") {
    return isPositiveInteger(anchor.page) ? anchor.page : undefined;
  }
  return undefined;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

function isValidNormalizedBox({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): boolean {
  return (
    Number.isFinite(left) &&
    Number.isFinite(top) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0 &&
    left + width <= 1 &&
    top + height <= 1
  );
}

export function rotateImageArea(
  area: SourceArea,
  rotation: number,
): SourceArea {
  const rotated = rotateNormalizedBox(
    {
      left: area.left / 100,
      top: area.top / 100,
      width: area.width / 100,
      height: area.height / 100,
    },
    normalizeRotation(rotation),
  );
  return {
    left: toPercent(rotated.left),
    top: toPercent(rotated.top),
    width: toPercent(rotated.width),
    height: toPercent(rotated.height),
  };
}

function toPercent(value: number): number {
  return Math.round(value * 100 * 1e10) / 1e10;
}

/** A stable source target over an `ImageViewer` ref. */
export function useImageSourceTarget(
  viewerRef: React.RefObject<ImageViewerHandle | null>,
): SourceTarget {
  return React.useMemo<SourceTarget>(
    () => ({
      scrollTo: (source: Source, options) => {
        const target = imageAnchorToTarget(source.anchor);
        if (target) {
          viewerRef.current?.scrollToFrameArea(
            target.frame,
            target.area,
            options,
          );
        }
      },
    }),
    [viewerRef],
  );
}

/**
 * Build a `renderFrameOverlay` callback that draws a source highlight on the
 * image.
 */
export function renderImageSourceOverlay(
  source: Source | undefined,
): (props: ImageFrameOverlayProps) => React.ReactNode {
  const target = source ? imageAnchorToTarget(source.anchor) : undefined;
  return function ImageSourceOverlay({
    frameNumber,
    rotation,
  }: ImageFrameOverlayProps) {
    if (!target || frameNumber !== target.frame) return null;
    const renderedArea = rotateImageArea(target.area, rotation);
    return (
      <div
        className={HIGHLIGHT_CLASS}
        style={{
          left: `${renderedArea.left}%`,
          top: `${renderedArea.top}%`,
          width: `${renderedArea.width}%`,
          height: `${renderedArea.height}%`,
        }}
      />
    );
  };
}
