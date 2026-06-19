"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

export function useDataCellSelectPopupDismissal({
  anchor,
  popupRef,
  onCancel,
  onOutsidePointerDown,
}: {
  anchor: HTMLElement;
  popupRef: React.RefObject<HTMLElement | null>;
  onCancel: () => void;
  onOutsidePointerDown: (event: PointerEvent) => void;
}) {
  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchor.contains(target) || popupRef.current?.contains(target)) return;

      onOutsidePointerDown(event);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [anchor, onOutsidePointerDown, popupRef]);

  React.useEffect(() => {
    const handleViewportChange = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && popupRef.current?.contains(target)) return;
      onCancel();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [onCancel, popupRef]);
}
