"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";

import { joinEffectKey } from "@/lib/effect-key";

export function useCodeProjectionScheduler({
  project,
  rowHostRef,
  viewportRef,
}: {
  project: () => void;
  rowHostRef?: React.RefObject<HTMLPreElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const scheduledProjectionRef = React.useRef(0);
  const scrollInteractionRestoreRef = React.useRef(0);

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
    joinEffectKey([
      "code-project-listeners",
      scheduleProjection,
      rowHostRef,
      viewportRef,
    ]),
    () => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const handleScroll = () => {
        suspendCodeScrollInteractions(rowHostRef?.current);
        if (scrollInteractionRestoreRef.current) {
          window.clearTimeout(scrollInteractionRestoreRef.current);
        }
        scrollInteractionRestoreRef.current = window.setTimeout(() => {
          scrollInteractionRestoreRef.current = 0;
          restoreCodeScrollInteractions(rowHostRef?.current);
        }, 120);
        scheduleProjection();
      };

      viewport.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(scheduleProjection);
      observer?.observe(viewport);

      return () => {
        viewport.removeEventListener("scroll", handleScroll);
        observer?.disconnect();
        cancelScheduledProjection(scheduledProjectionRef);
        if (scrollInteractionRestoreRef.current) {
          window.clearTimeout(scrollInteractionRestoreRef.current);
          scrollInteractionRestoreRef.current = 0;
        }
        restoreCodeScrollInteractions(rowHostRef?.current);
      };
    },
  );
}

function cancelScheduledProjection(ref: React.MutableRefObject<number>) {
  if (!ref.current) return;
  cancelAnimationFrame(ref.current);
  ref.current = 0;
}

function suspendCodeScrollInteractions(rowHost: HTMLPreElement | null | undefined) {
  if (!rowHost) return;
  rowHost.style.pointerEvents = "none";
  if (isMobileSafari()) {
    rowHost.parentElement?.style.setProperty("overflow-x", "hidden");
  }
}

function restoreCodeScrollInteractions(rowHost: HTMLPreElement | null | undefined) {
  if (!rowHost) return;
  rowHost.style.removeProperty("pointer-events");
  rowHost.parentElement?.style.removeProperty("overflow-x");
}

function isMobileSafari() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  return (
    /Safari/i.test(userAgent) &&
    /Mobile/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS/i.test(userAgent)
  );
}
