/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import {
  resolveDocxTarget,
  targetKey,
  type DocxRenderIndex,
} from "./docx-viewer-targets";
import type { DocxTarget } from "./docx-viewer-types";

export function useDocxHighlight({
  highlight,
  renderIndex,
  ready,
}: {
  highlight?: DocxTarget | null;
  renderIndex: DocxRenderIndex | null;
  ready: boolean;
}) {
  const highlightName = "docx-src-" + React.useId().replace(/:/g, "");
  const highlightKey = targetKey(highlight);

  React.useEffect(() => {
    const registry =
      typeof CSS !== "undefined" && "highlights" in CSS ? CSS.highlights : null;
    if (!registry || typeof Highlight === "undefined") return;
    const deleteHighlight = () => {
      try {
        registry.delete(highlightName);
      } catch {
        // Highlighting is an enhancement; registry failures must not hide the document.
      }
    };
    if (!highlight || !ready || !renderIndex) {
      deleteHighlight();
      return;
    }
    try {
      const range = resolveDocxTarget(renderIndex, highlight);
      if (range) registry.set(highlightName, new Highlight(range));
      else deleteHighlight();
    } catch {
      deleteHighlight();
    }
    return deleteHighlight;
    // highlight is read through the stable value key; object identity would thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightKey, ready, highlightName, renderIndex]);

  return highlightName;
}
