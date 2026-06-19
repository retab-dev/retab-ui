import type * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";

export function useElevatedVirtualRow({
  cellRootRef,
  isElevated,
}: {
  cellRootRef: React.RefObject<HTMLDivElement | null>;
  isElevated: boolean;
}) {
  const rowElevationKey = isElevated ? "elevated" : "normal";
  useKeyedMountEffect(rowElevationKey, () => {
    const rowEl = cellRootRef.current?.closest<HTMLElement>("[data-index]");
    if (!rowEl) return;
    rowEl.style.zIndex = isElevated ? "20" : "";
    return () => {
      rowEl.style.zIndex = "";
    };
  });
}
