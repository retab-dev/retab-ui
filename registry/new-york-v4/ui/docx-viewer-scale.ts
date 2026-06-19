/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import {
  clampDocxScale,
  DOCX_ZOOM_STEP,
  normalizeDocxScale,
} from "./docx-viewer-core";

export function useDocxViewerScale({
  containerWidth,
  defaultScale,
  onScaleChange,
  pageWidth,
  resetKey,
  scale: controlledScale,
}: {
  containerWidth: number | null;
  defaultScale?: number;
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

  React.useEffect(() => {
    setManualScale(normalizedDefaultScale);
  }, [normalizedDefaultScale, resetKey]);

  const fitScale =
    containerWidth && pageWidth
      ? clampDocxScale((containerWidth - 32) / pageWidth)
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
