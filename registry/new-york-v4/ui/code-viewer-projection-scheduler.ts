"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";

import { joinEffectKey } from "@/lib/effect-key";

export function useCodeProjectionScheduler({
  project,
  viewportRef,
}: {
  project: () => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const scheduledProjectionRef = React.useRef(0);

  const scheduleProjection = React.useCallback(() => {
    if (scheduledProjectionRef.current) return;
    scheduledProjectionRef.current = requestAnimationFrame(() => {
      scheduledProjectionRef.current = 0;
      project();
    });
  }, [project]);

  useKeyedMountEffect(joinEffectKey(["code-project", project]), () => {
    project();
    return () => {
      cancelScheduledProjection(scheduledProjectionRef);
    };
  });

  useKeyedMountEffect(
    joinEffectKey(["code-project-listeners", scheduleProjection, viewportRef]),
    () => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      viewport.addEventListener("scroll", scheduleProjection, {
        passive: true,
      });
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(scheduleProjection);
      observer?.observe(viewport);

      return () => {
        viewport.removeEventListener("scroll", scheduleProjection);
        observer?.disconnect();
        cancelScheduledProjection(scheduledProjectionRef);
      };
    },
  );
}

function cancelScheduledProjection(ref: React.MutableRefObject<number>) {
  if (!ref.current) return;
  cancelAnimationFrame(ref.current);
  ref.current = 0;
}
