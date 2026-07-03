"use client";

import * as React from "react";
import { flushSync } from "react-dom";

import { FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT } from "./file-viewer-elements";
import {
  areFileViewerMotionFramesEqual,
  areFileViewerMotionRestFramesEqual,
  createFileViewerIdleMotionFrame,
  createFileViewerMotionPlan,
  createFileViewerMotionRestFrame,
  type FileViewerMotionFrame,
  type FileViewerMotionPlan,
  type FileViewerMotionRestFrame,
  type FileViewerMotionTarget,
} from "./file-viewer-motion-plan";

// The kernel is the single owner of sidebar motion. It holds the clock (one
// rAF loop from slide start through settle), writes the continuous inline
// styles, and publishes to React subscribers only at phase edges
// (idle → sliding → settling → idle). Everything discrete — data attributes,
// inert/aria, the overlay translate classes — is owned by React renders.
export type FileViewerMotionKernel = {
  getInteractiveSnapshot: () => FileViewerMotionFrame;
  getSnapshot: () => FileViewerMotionFrame;
  setDocumentSurface: (surface: FileViewerDocumentSurface | null) => void;
  setSidebarGapElement: (element: HTMLElement | null) => void;
  startMotion: (target: FileViewerMotionTarget) => void;
  subscribe: (listener: () => void) => () => void;
  syncTarget: (target: FileViewerMotionTarget) => void;
};

export type FileViewerDocumentSurface = {
  element: HTMLElement;
  resolveMotionStyle?: FileViewerDocumentSurfaceMotionResolver | null;
};

export type FileViewerDocumentSurfaceMotionStyle = {
  customProperties?: Readonly<Record<string, string | null>>;
  transform: string;
  transformOrigin: string;
  willChange: string;
};

export type FileViewerDocumentSurfaceMotionResolver = (
  frame: FileViewerMotionFrame,
) => FileViewerDocumentSurfaceMotionStyle | null;

type FileViewerActiveMotion = {
  durationMs: number;
  from: FileViewerMotionRestFrame;
  id: number;
  startedAt: number;
  to: FileViewerMotionRestFrame;
};

export const DEFAULT_FILE_VIEWER_MOTION_FRAME: FileViewerMotionFrame = {
  shellInlineSize: 0,
  durationMs: 150,
  fallbackSurfaceScale: 1,
  fromInlineSize: 0,
  layoutInlineSize: 0,
  mode: "overlay",
  motionId: null,
  motionProgress: 1,
  open: false,
  phase: "idle",
  side: "left",
  sidebarInlineSize: 0,
  sidebarWidth: 0,
  toInlineSize: 0,
};

export function createFileViewerMotionKernel(): FileViewerMotionKernel {
  const listeners = new Set<() => void>();
  let contractFrame = DEFAULT_FILE_VIEWER_MOTION_FRAME;
  let interactiveFrame = DEFAULT_FILE_VIEWER_MOTION_FRAME;
  let target: FileViewerMotionTarget = {
    shellInlineSize: 0,
    durationMs: DEFAULT_FILE_VIEWER_MOTION_FRAME.durationMs,
    mode: DEFAULT_FILE_VIEWER_MOTION_FRAME.mode,
    open: DEFAULT_FILE_VIEWER_MOTION_FRAME.open,
    side: DEFAULT_FILE_VIEWER_MOTION_FRAME.side,
    sidebarWidth: 0,
  };
  let documentSurface: FileViewerDocumentSurface | null = null;
  let documentSurfaceCustomProperties = new Set<string>();
  let sidebarGapElement: HTMLElement | null = null;
  let activeMotion: FileViewerActiveMotion | null = null;
  let rafHandle = 0;
  let settleReleaseHandle = 0;
  let motionSequence = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const publishContractFrame = (
    nextFrame: FileViewerMotionFrame,
    { flushSubscribers = false }: { flushSubscribers?: boolean } = {},
  ) => {
    if (areFileViewerMotionFramesEqual(contractFrame, nextFrame)) return;
    contractFrame = nextFrame;

    if (flushSubscribers) {
      flushSync(notify);
      return;
    }

    notify();
  };

  // The gap's inline size and the document surface's counter-scale must land
  // in the same frame: two independent CSS transitions (width on the gap,
  // transform on the surface) can desync under main-thread jank, letting the
  // document edge drift off the sidebar edge mid-slide. The kernel therefore
  // writes both here, once per tick.
  const writeElementStyles = (nextFrame: FileViewerMotionFrame) => {
    writeSidebarGapStyle(nextFrame);
    writeDocumentSurfaceStyle(nextFrame);
  };

  const commit = (
    nextFrame: FileViewerMotionFrame,
    { publish = true }: { publish?: boolean } = {},
  ) => {
    writeElementStyles(nextFrame);
    interactiveFrame = nextFrame;
    if (publish) publishContractFrame(nextFrame);
  };

  const cancelTick = () => {
    if (rafHandle === 0) return;
    getCancelAnimationFrame()(rafHandle);
    rafHandle = 0;
  };

  const cancelSettleRelease = () => {
    if (settleReleaseHandle === 0) return;
    getCancelAnimationFrame()(settleReleaseHandle);
    settleReleaseHandle = 0;
  };

  const readMotionSample = (
    motion: FileViewerActiveMotion,
    now = readNow(),
  ): FileViewerMotionFrame => {
    const motionProgress =
      motion.durationMs <= 0
        ? 1
        : clamp((now - motion.startedAt) / motion.durationMs, 0, 1);
    const sidebarInlineSize = lerp(
      motion.from.sidebarInlineSize,
      motion.to.sidebarInlineSize,
      motionProgress,
    );
    const layoutInlineSize = Math.max(
      0,
      motion.to.shellInlineSize - sidebarInlineSize,
    );
    const fromInlineSize = motion.from.layoutInlineSize;

    return {
      shellInlineSize: motion.to.shellInlineSize,
      durationMs: motion.durationMs,
      fromInlineSize,
      layoutInlineSize,
      mode: motion.to.mode,
      motionId: motion.id,
      motionProgress,
      open: motion.to.open,
      phase: motionProgress < 1 ? "sliding" : "settling",
      side: motion.to.side,
      sidebarInlineSize,
      sidebarWidth: motion.to.sidebarWidth,
      toInlineSize: motion.to.layoutInlineSize,
      fallbackSurfaceScale:
        fromInlineSize > 0 ? layoutInlineSize / fromInlineSize : 1,
    };
  };

  const settle = () => {
    if (!activeMotion) return;
    const finishedMotion = activeMotion;
    activeMotion = null;
    cancelTick();

    const idleFrame = createFileViewerIdleMotionFrame(finishedMotion.to);
    const settlingFrame: FileViewerMotionFrame = {
      ...idleFrame,
      fromInlineSize: finishedMotion.from.layoutInlineSize,
      motionId: finishedMotion.id,
      phase: "settling",
    };

    // Clear the counter-scale and re-lay-out the document at its target width
    // in one synchronous pass, so scroll rebasing never paints against stale
    // geometry.
    commit(settlingFrame, { publish: false });
    publishContractFrame(settlingFrame, { flushSubscribers: true });
    scheduleSettleRelease(idleFrame);
  };

  const tick = () => {
    rafHandle = 0;
    if (!activeMotion) return;
    const sample = readMotionSample(activeMotion);
    if (sample.motionProgress >= 1) {
      settle();
      return;
    }
    commit(sample, { publish: false });
    scheduleTick();
  };

  const scheduleTick = () => {
    if (rafHandle !== 0) return;
    rafHandle = getRequestAnimationFrame()(tick);
  };

  const scheduleSettleRelease = (idleFrame: FileViewerMotionFrame) => {
    cancelSettleRelease();
    // Two frames: the first lets the rebased layout paint while renderers
    // still hold the oversized raster; the second releases the contract to
    // idle so they can drop it.
    settleReleaseHandle = getRequestAnimationFrame()(() => {
      settleReleaseHandle = 0;
      commit(idleFrame, { publish: false });
      settleReleaseHandle = getRequestAnimationFrame()(() => {
        settleReleaseHandle = 0;
        commit(idleFrame);
      });
    });
  };

  const dispatchBeforeLayoutMotion = () => {
    documentSurface?.element.dispatchEvent(
      new Event(FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT),
    );
  };

  const retarget = (nextTarget: FileViewerMotionTarget, animate: boolean) => {
    cancelSettleRelease();
    const currentFrame = activeMotion
      ? readMotionSample(activeMotion)
      : interactiveFrame.shellInlineSize > 0
        ? interactiveFrame
        : createFileViewerIdleMotionFrame(
            createFileViewerMotionRestFrame(target),
          );
    const plan = createFileViewerMotionPlan({
      animate: animate && !prefersReducedMotion(),
      currentFrame,
      nextTarget,
    });
    if (shouldDispatchBeforeLayoutMotion(plan)) {
      dispatchBeforeLayoutMotion();
    }
    target = plan.resolvedTarget;

    if (!plan.shouldAnimate) {
      activeMotion = null;
      cancelTick();
      commit(createFileViewerIdleMotionFrame(plan.nextRestFrame));
      return;
    }

    motionSequence += 1;
    activeMotion = {
      durationMs: plan.resolvedTarget.durationMs,
      from: { ...plan.currentRestFrame, layoutInlineSize: plan.fromInlineSize },
      id: motionSequence,
      startedAt: readNow(),
      to: plan.nextRestFrame,
    };
    commit(readMotionSample(activeMotion, activeMotion.startedAt));
    scheduleTick();
  };

  const syncTarget = (nextTarget: FileViewerMotionTarget) => {
    const nextRestFrame = createFileViewerMotionRestFrame(nextTarget);

    if (activeMotion) {
      target = nextTarget;
      if (areFileViewerMotionRestFramesEqual(activeMotion.to, nextRestFrame)) {
        return;
      }
      retarget(nextTarget, true);
      return;
    }

    cancelSettleRelease();
    target = nextTarget;
    commit(createFileViewerIdleMotionFrame(nextRestFrame));
  };

  return {
    getInteractiveSnapshot: () =>
      activeMotion ? readMotionSample(activeMotion) : interactiveFrame,
    getSnapshot: () => contractFrame,
    setDocumentSurface: (surface) => {
      const previousSurface = documentSurface;
      if (
        previousSurface &&
        (!surface || previousSurface.element !== surface.element)
      ) {
        clearDocumentSurfaceStyle(previousSurface.element);
      }
      documentSurface = surface;
      writeDocumentSurfaceStyle(interactiveFrame);
    },
    setSidebarGapElement: (element) => {
      sidebarGapElement = element;
      writeSidebarGapStyle(interactiveFrame);
    },
    startMotion: (nextTarget) => retarget(nextTarget, true),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    syncTarget,
  };

  function writeSidebarGapStyle(nextFrame: FileViewerMotionFrame) {
    if (!sidebarGapElement) return;

    // Overlay motion is CSS-owned; relinquish the gap so its `w-0` class is
    // the only writer outside inline mode.
    if (nextFrame.mode !== "inline") {
      sidebarGapElement.style.width = "";
      sidebarGapElement.style.flexBasis = "";
      return;
    }

    sidebarGapElement.style.width = `${nextFrame.sidebarInlineSize}px`;
    sidebarGapElement.style.flexBasis = `${nextFrame.sidebarInlineSize}px`;
  }

  function writeDocumentSurfaceStyle(nextFrame: FileViewerMotionFrame) {
    if (!documentSurface) return;

    const { element, resolveMotionStyle } = documentSurface;
    const resolvedStyle = resolveMotionStyle?.(nextFrame);
    if (resolvedStyle) {
      writeDocumentSurfaceCustomProperties(
        element,
        resolvedStyle.customProperties,
      );
      element.style.transform = resolvedStyle.transform;
      element.style.transformOrigin = resolvedStyle.transformOrigin;
      element.style.willChange = resolvedStyle.willChange;
      return;
    }

    writeDocumentSurfaceCustomProperties(element, null);
    const isSliding = nextFrame.phase === "sliding";
    const isScaled = Math.abs(nextFrame.fallbackSurfaceScale - 1) > 0.001;
    element.style.transform =
      isSliding || isScaled ? `scale(${nextFrame.fallbackSurfaceScale})` : "";
    element.style.willChange = isSliding ? "transform" : "";
  }

  function writeDocumentSurfaceCustomProperties(
    element: HTMLElement,
    customProperties:
      | Readonly<Record<string, string | null>>
      | null
      | undefined,
  ) {
    const nextNames = new Set(Object.keys(customProperties ?? {}));
    for (const name of documentSurfaceCustomProperties) {
      if (!nextNames.has(name)) {
        element.style.removeProperty(name);
      }
    }

    for (const [name, value] of Object.entries(customProperties ?? {})) {
      if (value == null) {
        element.style.removeProperty(name);
      } else {
        element.style.setProperty(name, value);
      }
    }

    documentSurfaceCustomProperties = nextNames;
  }

  function clearDocumentSurfaceStyle(element: HTMLElement) {
    element.style.transform = "";
    element.style.transformOrigin = "";
    element.style.willChange = "";
    for (const name of documentSurfaceCustomProperties) {
      element.style.removeProperty(name);
    }
    documentSurfaceCustomProperties = new Set();
  }
}

function shouldDispatchBeforeLayoutMotion({
  currentRestFrame,
  nextRestFrame,
}: FileViewerMotionPlan) {
  return (
    currentRestFrame.mode === "inline" &&
    nextRestFrame.mode === "inline" &&
    Math.abs(
      currentRestFrame.layoutInlineSize - nextRestFrame.layoutInlineSize,
    ) > 0.001
  );
}

export function useFileViewerMotionFrame(
  kernel: FileViewerMotionKernel | null | undefined,
): FileViewerMotionFrame {
  const subscribe = React.useCallback(
    (listener: () => void) => kernel?.subscribe(listener) ?? (() => {}),
    [kernel],
  );
  const getSnapshot = React.useCallback(
    () => kernel?.getSnapshot() ?? DEFAULT_FILE_VIEWER_MOTION_FRAME,
    [kernel],
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function prefersReducedMotion() {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readNow() {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function getRequestAnimationFrame() {
  return (
    globalThis.requestAnimationFrame ??
    ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(readNow()), 16))
  );
}

function getCancelAnimationFrame() {
  return (
    globalThis.cancelAnimationFrame ??
    ((id: number) => {
      window.clearTimeout(id);
    })
  );
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
