"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";

import { PAGE_MARKDOWN_PAGE_WIDTH } from "./page-markdown-layout";

export const PAGE_MARKDOWN_SCALE_MIN = 0.35;
export const PAGE_MARKDOWN_SCALE_MAX = 3;
export const PAGE_MARKDOWN_FIT_SCALE_MAX = 1.5;
export const PAGE_MARKDOWN_FIT_HORIZONTAL_PADDING = 32;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampPageScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return clamp(scale, PAGE_MARKDOWN_SCALE_MIN, PAGE_MARKDOWN_SCALE_MAX);
}

export function fitPageScale(containerWidth: number | null): number {
  if (!containerWidth || !Number.isFinite(containerWidth)) return 1;
  return clamp(
    (containerWidth - PAGE_MARKDOWN_FIT_HORIZONTAL_PADDING) /
      PAGE_MARKDOWN_PAGE_WIDTH,
    PAGE_MARKDOWN_SCALE_MIN,
    PAGE_MARKDOWN_FIT_SCALE_MAX,
  );
}

export function zoomPageScale(scale: number, factor: number): number {
  return clampPageScale(scale * factor);
}

export function usePageMarkdownScale({
  containerWidth,
  defaultScale,
  onScaleChange,
  pageWidth = PAGE_MARKDOWN_PAGE_WIDTH,
  resetKey,
  scale: controlledScale,
}: {
  containerWidth: number | null;
  defaultScale?: number;
  onScaleChange?: (scale: number | null) => void;
  pageWidth?: number;
  resetKey?: string;
  scale?: number;
}) {
  const normalizedControlledScale = normalizeOptionalPageScale(controlledScale);
  const isScaleControlled = controlledScale != null;
  const normalizedDefaultScale = normalizeOptionalPageScale(defaultScale);
  const [manualScale, setManualScale] = React.useState<number | null>(
    normalizedDefaultScale,
  );

  useKeyedMountEffect(
    `page-markdown-scale:${resetKey ?? ""}:${normalizedDefaultScale ?? "fit"}`,
    () => {
      setManualScale(normalizedDefaultScale);
    },
  );

  const fitScale =
    containerWidth && Number.isFinite(containerWidth)
      ? clamp(
          (containerWidth - PAGE_MARKDOWN_FIT_HORIZONTAL_PADDING) / pageWidth,
          PAGE_MARKDOWN_SCALE_MIN,
          PAGE_MARKDOWN_FIT_SCALE_MAX,
        )
      : 1;
  const scale = normalizedControlledScale ?? manualScale ?? fitScale;

  const setViewerScale = React.useCallback(
    (nextScale: number | null) => {
      const normalized =
        nextScale == null ? null : normalizeOptionalPageScale(nextScale);
      if (isScaleControlled) {
        onScaleChange?.(normalized);
        return;
      }
      setManualScale(normalized);
      onScaleChange?.(normalized);
    },
    [isScaleControlled, onScaleChange],
  );

  const zoomIn = React.useCallback(() => {
    setViewerScale(zoomPageScale(scale, 1.2));
  }, [scale, setViewerScale]);

  const zoomOut = React.useCallback(() => {
    setViewerScale(zoomPageScale(scale, 1 / 1.2));
  }, [scale, setViewerScale]);

  const fitWidth = React.useCallback(() => {
    setViewerScale(null);
  }, [setViewerScale]);

  return {
    fitWidth,
    scale,
    setViewerScale,
    zoomIn,
    zoomOut,
  };
}

function normalizeOptionalPageScale(scale: number | undefined) {
  return scale == null ? null : clampPageScale(scale);
}
