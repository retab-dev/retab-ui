"use client";

import * as React from "react";

import { type SegmentInteraction } from "@/lib/segment-interaction";

export interface ControlledSegmentInteractionOptions {
  previewSegmentId: string | null;
  setPreviewSegmentId: (segmentId: string | null) => void;
}

export function useSegmentInteraction(): SegmentInteraction {
  const [previewSegmentId, setPreviewSegmentId] = React.useState<string | null>(
    null,
  );

  return useSegmentInteractionObject({
    previewSegmentId,
    setPreviewSegmentId,
  });
}

export function useControlledSegmentInteraction(
  options: ControlledSegmentInteractionOptions,
): SegmentInteraction {
  return useSegmentInteractionObject(options);
}

function useSegmentInteractionObject({
  previewSegmentId,
  setPreviewSegmentId,
}: ControlledSegmentInteractionOptions): SegmentInteraction {
  const previewSegment = React.useCallback(
    (segmentId: string) => setPreviewSegmentId(segmentId),
    [setPreviewSegmentId],
  );
  const clearPreview = React.useCallback(
    () => setPreviewSegmentId(null),
    [setPreviewSegmentId],
  );

  return React.useMemo(
    () => ({
      previewSegmentId,
      previewSegment,
      clearPreview,
    }),
    [clearPreview, previewSegment, previewSegmentId],
  );
}
