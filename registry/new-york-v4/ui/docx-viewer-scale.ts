import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";

import {
  clampDocxScale,
  DOCX_ZOOM_STEP,
  normalizeDocxScale,
} from "./docx-viewer-core";
import { joinEffectKey } from "@/lib/effect-key";

export function useDocxViewerScale({
  defaultScale,
  layoutInlineSize,
  onScaleChange,
  pageWidth,
  resetKey,
  scale: controlledScale,
}: {
  defaultScale?: number;
  layoutInlineSize: number | null;
  onScaleChange?: (scale: number | null) => void;
  pageWidth: number | null;
  resetKey: string;
  scale?: number;
}) {
  const normalizedControlledScale = normalizeDocxScale(controlledScale);
  const isScaleControlled = controlledScale != null;
  const normalizedDefaultScale = normalizeDocxScale(defaultScale);
  const [manualScale, setManualScale] = React.useState<number | null>(
    normalizedDefaultScale,
  );

  useKeyedMountEffect(
    joinEffectKey(["docx-scale-reset", normalizedDefaultScale, resetKey]),
    () => {
      setManualScale(normalizedDefaultScale);
    },
  );

  const fitScale =
    layoutInlineSize && pageWidth
      ? clampDocxScale((layoutInlineSize - 32) / pageWidth)
      : 1;
  const scale = normalizedControlledScale ?? manualScale ?? fitScale;

  const setViewerScale = React.useCallback(
    (nextScale: number | null) => {
      const normalized =
        nextScale == null ? null : normalizeDocxScale(nextScale);
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
    setViewerScale(clampDocxScale(scale * DOCX_ZOOM_STEP));
  }, [scale, setViewerScale]);

  const zoomOut = React.useCallback(() => {
    setViewerScale(clampDocxScale(scale / DOCX_ZOOM_STEP));
  }, [scale, setViewerScale]);

  const fitWidth = React.useCallback(() => {
    setViewerScale(null);
  }, [setViewerScale]);

  return {
    fitWidth,
    isScaleControlled,
    scale,
    setViewerScale,
    zoomIn,
    zoomOut,
  };
}
