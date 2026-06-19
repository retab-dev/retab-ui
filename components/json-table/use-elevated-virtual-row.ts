/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

export function useElevatedVirtualRow({
  cellRootRef,
  isElevated,
}: {
  cellRootRef: React.RefObject<HTMLDivElement | null>;
  isElevated: boolean;
}) {
  React.useEffect(() => {
    const rowEl = cellRootRef.current?.closest<HTMLElement>("[data-index]");
    if (!rowEl) return;
    rowEl.style.zIndex = isElevated ? "20" : "";
    return () => {
      rowEl.style.zIndex = "";
    };
  }, [cellRootRef, isElevated]);
}
