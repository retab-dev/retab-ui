"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

// Preserve the reader's place across a fit-width resize.
//
// When the sidebar toggles, a document that fits its width re-fits to the new
// inset: a wider page is a taller document, so its absolute scroll size changes
// and a frozen scrollTop would drop the reader to a different place. The fix is
// format-agnostic: continuously record the *fraction* of the document at the
// viewport (0 = top, 1 = bottom), and the moment the layout changes, restore
// scrollTop to that fraction of the new scroll range — synchronously, before
// paint, so the reading position never visibly jumps.
//
// Renderers that already carry a richer per-page reading anchor (PDF, DOCX)
// keep theirs; this is for the ones whose content simply scales with width
// (image, PPTX, markdown), where the document fraction is the reading position.
export function useReadingFractionRebase({
  scrollerRef,
  layoutKey,
  enabled = true,
}: {
  scrollerRef: React.RefObject<HTMLElement | null>;
  // Anything that changes when the document re-fits (the fit width or scale).
  // The rebase restores the captured fraction whenever this changes.
  layoutKey: unknown;
  enabled?: boolean;
}) {
  const fractionRef = React.useRef(0);
  const committedKeyRef = React.useRef(layoutKey);

  const captureReadingFraction = React.useCallback(() => {
    const viewport = scrollerRef.current;
    if (!viewport) return;
    const range = viewport.scrollHeight - viewport.clientHeight;
    fractionRef.current = range > 0 ? viewport.scrollTop / range : 0;
  }, [scrollerRef]);

  useKeyedLayoutEffect(
    joinEffectKey(["reading-fraction-rebase", layoutKey]),
    () => {
      const previousKey = committedKeyRef.current;
      committedKeyRef.current = layoutKey;
      if (!enabled) return;
      if (Object.is(previousKey, layoutKey)) return;

      const viewport = scrollerRef.current;
      if (!viewport) return;
      const range = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTop = fractionRef.current * range;
    },
  );

  return { captureReadingFraction };
}
