"use client";

import type * as React from "react";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

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
  useKeyedMountEffect(
    joinEffectKey([anchor, onOutsidePointerDown, popupRef]),
    () => {
      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (anchor.contains(target) || popupRef.current?.contains(target))
          return;

        onOutsidePointerDown(event);
      };

      document.addEventListener("pointerdown", handlePointerDown, true);
      return () =>
        document.removeEventListener("pointerdown", handlePointerDown, true);
    },
  );

  useKeyedMountEffect(joinEffectKey([onCancel, popupRef]), () => {
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
  });
}
