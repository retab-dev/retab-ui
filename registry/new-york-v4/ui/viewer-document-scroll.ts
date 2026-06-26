import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

import type {
  ViewerDocumentLayoutModel,
  ViewerDocumentPhysicalScrollPosition,
  ViewerDocumentResolvedScrollTarget,
  ViewerDocumentScrollMapper,
  ViewerDocumentScrollMetrics,
  ViewerDocumentScrollTargetResolver,
} from "./viewer-types";

const VIEWER_DOCUMENT_SCROLL_IDLE_MS = 120;
const VIEWER_DOCUMENT_SCROLL_POSITION_EPSILON = 1;

type ViewerDocumentScrollIntent<Target> =
  | {
      kind: "idle";
    }
  | {
      kind: "user";
    }
  | {
      behavior: ScrollBehavior;
      kind: "programmatic";
      sequence: number;
      target: Target;
      targetLeft?: number;
      targetTop: number;
    };

export function useViewerDocumentScroll<Anchor, Target>({
  copyScrollTarget,
  layout,
  resetKey,
  resolveScrollTarget,
  scrollMapper,
}: {
  copyScrollTarget?: (target: Target) => Target;
  layout: ViewerDocumentLayoutModel<Anchor>;
  resetKey?: unknown;
  resolveScrollTarget?: ViewerDocumentScrollTargetResolver<Anchor, Target>;
  scrollMapper: ViewerDocumentScrollMapper;
}) {
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null);
  const scrollPageOffsetRef = React.useRef(0);
  const viewportResetKeyRef = React.useRef<unknown>(resetKey);
  const didMountResetEffectRef = React.useRef(false);
  const committedLayoutRef = React.useRef(layout);
  const committedResetKeyRef = React.useRef<unknown>(resetKey);
  const scrollIntent = useViewerDocumentScrollIntentController<Target>();
  const [viewportElement, setViewportElementState] =
    React.useState<HTMLDivElement | null>(null);

  const resetViewportForKey = React.useCallback(
    (element: HTMLDivElement, key: unknown) => {
      viewportResetKeyRef.current = key;
      scrollPageOffsetRef.current = 0;
      scrollIntent.reset();
      setViewportPhysicalScrollTop(element, 0);
      element.scrollTo?.({ top: 0, behavior: "auto" });
    },
    [scrollIntent],
  );

  const setViewportElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportElementRef.current = element;
      if (element && !Object.is(viewportResetKeyRef.current, resetKey)) {
        resetViewportForKey(element, resetKey);
      }
      setViewportElementState(element);
    },
    [resetKey, resetViewportForKey],
  );

  const readScrollMetrics = React.useCallback(
    () =>
      readViewerDocumentScrollMetrics({
        layout,
        scrollMapper,
        scrollPageOffset: scrollPageOffsetRef.current,
        viewportElement: viewportElementRef.current,
      }),
    [layout, scrollMapper],
  );

  const syncViewportScrollPosition = React.useCallback(
    (viewportElement: HTMLDivElement, blockSize = layout.blockSize) => {
      const metrics = readViewerDocumentScrollMetrics({
        layout: {
          ...layout,
          blockSize,
        },
        scrollMapper,
        scrollPageOffset: scrollPageOffsetRef.current,
        viewportElement,
      });

      if (metrics.physicalScrollSize >= blockSize) {
        scrollPageOffsetRef.current = 0;
        return {
          ...metrics,
          scrollPageOffset: 0,
        };
      }

      const position = scrollMapper.resolvePhysicalScrollPosition({
        blockSize,
        logicalScrollTop: metrics.scrollTop,
        scrollPageOffset: metrics.scrollPageOffset,
        viewportBlockSize: metrics.viewportBlockSize,
      });
      scrollPageOffsetRef.current = position.scrollPageOffset;
      setViewportPhysicalScrollTop(viewportElement, position.physicalScrollTop);

      return {
        ...metrics,
        physicalScrollTop: position.physicalScrollTop,
        scrollPageOffset: position.scrollPageOffset,
      };
    },
    [layout, scrollMapper],
  );

  const syncScrollPosition = React.useCallback(() => {
    const viewportElement = viewportElementRef.current;
    return viewportElement ? syncViewportScrollPosition(viewportElement) : null;
  }, [syncViewportScrollPosition]);

  const scrollViewportToLogicalTop = React.useCallback(
    (
      viewportElement: HTMLDivElement,
      targetTop: number,
      options?: ScrollToOptions,
    ) => {
      const position = scrollMapper.resolvePhysicalScrollPosition({
        blockSize: layout.blockSize,
        logicalScrollTop: targetTop,
        scrollPageOffset: scrollPageOffsetRef.current,
        viewportBlockSize: viewportElement.clientHeight,
      });
      scrollPageOffsetRef.current = position.scrollPageOffset;
      scrollViewportToPhysicalTop(viewportElement, position.physicalScrollTop, {
        behavior: "auto",
        ...options,
      });
    },
    [layout.blockSize, scrollMapper],
  );

  const scrollViewportToResolvedTarget = React.useCallback(
    (
      viewportElement: HTMLDivElement,
      target: ViewerDocumentResolvedScrollTarget,
      options: ScrollToOptions,
    ) => {
      const physicalScrollSize = scrollMapper.getPhysicalScrollSize({
        blockSize: layout.blockSize,
        viewportBlockSize: viewportElement.clientHeight,
      });
      const position =
        physicalScrollSize < layout.blockSize
          ? scrollMapper.resolvePhysicalScrollPosition({
              blockSize: layout.blockSize,
              logicalScrollTop: target.top,
              scrollPageOffset: scrollPageOffsetRef.current,
              viewportBlockSize: viewportElement.clientHeight,
            })
          : {
              physicalScrollTop: Math.max(0, target.top),
              scrollPageOffset: 0,
            };
      scrollPageOffsetRef.current = position.scrollPageOffset;
      viewportElement.scrollTo({
        top: position.physicalScrollTop,
        ...(target.left == null ? null : { left: target.left }),
        ...options,
      });
    },
    [layout.blockSize, scrollMapper],
  );

  useKeyedLayoutEffect(
    joinEffectKey([
      copyScrollTarget,
      layout,
      resetKey,
      resolveScrollTarget,
      scrollIntent,
      scrollMapper,
      scrollViewportToLogicalTop,
      scrollViewportToResolvedTarget,
      syncViewportScrollPosition,
    ]),
    () => {
      const previousLayout = committedLayoutRef.current;
      const previousResetKey = committedResetKeyRef.current;
      committedLayoutRef.current = layout;
      committedResetKeyRef.current = resetKey;

      if (!Object.is(previousResetKey, resetKey)) return;
      if (Object.is(previousLayout, layout)) return;

      const viewportElement = viewportElementRef.current;
      if (!viewportElement) return;

      const activeIntent = scrollIntent.current();
      if (activeIntent.kind === "programmatic" && resolveScrollTarget) {
        const metrics = syncViewportScrollPosition(viewportElement);
        const target = resolveScrollTarget({
          layout,
          scrollTop: metrics.scrollTop,
          target: activeIntent.target,
          viewportElement,
        });
        if (!target) return;

        const { intent, targetChanged } = scrollIntent.updateProgrammaticTarget(
          activeIntent,
          target,
        );

        if (targetChanged) {
          scrollViewportToResolvedTarget(viewportElement, target, {
            behavior: intent.behavior,
          });
          scrollIntent.scheduleProgrammaticCompletion(intent.sequence);
        }
        return;
      }

      const previousLogicalScrollTop = scrollMapper.getLogicalScrollTop({
        blockSize: previousLayout.blockSize,
        physicalScrollTop: viewportElement.scrollTop,
        scrollPageOffset: scrollPageOffsetRef.current,
        viewportBlockSize: viewportElement.clientHeight,
      });
      const viewportBlockSize = viewportElement.clientHeight;
      const anchor = previousLayout.captureReadingAnchor({
        scrollTop: previousLogicalScrollTop,
        viewportBlockSize,
      });
      if (!anchor) return;

      const targetTop = layout.getReadingAnchorScrollTop({
        anchor,
        viewportBlockSize,
      });
      if (targetTop != null) {
        scrollViewportToLogicalTop(viewportElement, targetTop);
      }
    },
  );

  const handleScroll = React.useCallback(() => {
    const viewportElement = viewportElementRef.current;
    if (viewportElement) {
      syncViewportScrollPosition(viewportElement);
    }

    const activeIntent = scrollIntent.current();
    if (activeIntent.kind === "programmatic") {
      scrollIntent.scheduleProgrammaticCompletion(activeIntent.sequence);
    } else {
      scrollIntent.markUser();
    }
  }, [scrollIntent, syncViewportScrollPosition]);

  useKeyedMountEffect(joinEffectKey([resetKey, resetViewportForKey]), () => {
    if (!didMountResetEffectRef.current) {
      didMountResetEffectRef.current = true;
      return;
    }
    const viewportElement = viewportElementRef.current;
    if (viewportElement) {
      resetViewportForKey(viewportElement, resetKey);
    }
  });

  useKeyedMountEffect(joinEffectKey([scrollIntent, viewportElement]), () => {
    const viewportElement = viewportElementRef.current;
    if (!viewportElement) return;

    const handleScrollEnd = () => {
      const activeIntent = scrollIntent.current();
      if (activeIntent.kind === "programmatic") {
        scrollIntent.completeProgrammatic(activeIntent.sequence);
      } else {
        scrollIntent.reset();
      }
    };

    viewportElement.addEventListener?.("wheel", scrollIntent.markUser, {
      passive: true,
    });
    viewportElement.addEventListener?.("touchstart", scrollIntent.markUser, {
      passive: true,
    });
    viewportElement.addEventListener?.("pointerdown", scrollIntent.markUser);
    viewportElement.addEventListener?.("keydown", scrollIntent.markUser);
    viewportElement.addEventListener?.("scrollend", handleScrollEnd);

    return () => {
      viewportElement.removeEventListener?.("wheel", scrollIntent.markUser);
      viewportElement.removeEventListener?.(
        "touchstart",
        scrollIntent.markUser,
      );
      viewportElement.removeEventListener?.(
        "pointerdown",
        scrollIntent.markUser,
      );
      viewportElement.removeEventListener?.("keydown", scrollIntent.markUser);
      viewportElement.removeEventListener?.("scrollend", handleScrollEnd);
    };
  });

  const scrollToTarget = React.useCallback(
    (target: Target, options?: ScrollToOptions) => {
      const viewportElement = viewportElementRef.current;
      const metrics = readScrollMetrics();
      const resolvedTarget =
        viewportElement && resolveScrollTarget
          ? resolveScrollTarget({
              layout,
              scrollTop: metrics.scrollTop,
              target,
              viewportElement,
            })
          : null;
      if (!viewportElement || !resolvedTarget) return;

      const behavior = options?.behavior ?? "smooth";
      const intent = scrollIntent.startProgrammatic({
        behavior,
        copyScrollTarget,
        resolvedTarget,
        target,
      });
      scrollViewportToResolvedTarget(viewportElement, resolvedTarget, {
        behavior: "smooth",
        ...options,
      });
      scrollIntent.scheduleProgrammaticCompletion(intent.sequence);
    },
    [
      copyScrollTarget,
      layout,
      readScrollMetrics,
      resolveScrollTarget,
      scrollIntent,
      scrollViewportToResolvedTarget,
    ],
  );
  const getViewportElement = React.useCallback(
    () => viewportElementRef.current,
    [],
  );

  useMountEffect(() => () => {
    scrollIntent.clearProgrammaticTimeout();
  });

  return React.useMemo(
    () => ({
      getScrollMetrics: readScrollMetrics,
      getViewportElement,
      handleScroll,
      scrollToTarget,
      scrollViewportToLogicalTop,
      setViewportElement,
      syncScrollPosition,
      viewportElement,
    }),
    [
      getViewportElement,
      handleScroll,
      readScrollMetrics,
      scrollToTarget,
      scrollViewportToLogicalTop,
      setViewportElement,
      syncScrollPosition,
      viewportElement,
    ],
  );
}

function useViewerDocumentScrollIntentController<Target>() {
  const scrollIntentRef = React.useRef<ViewerDocumentScrollIntent<Target>>({
    kind: "idle",
  });
  const scrollIntentSequenceRef = React.useRef(0);
  const programmaticScrollIdleTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearProgrammaticTimeout = React.useCallback(() => {
    if (programmaticScrollIdleTimeoutRef.current) {
      clearTimeout(programmaticScrollIdleTimeoutRef.current);
      programmaticScrollIdleTimeoutRef.current = null;
    }
  }, []);

  const reset = React.useCallback(() => {
    clearProgrammaticTimeout();
    scrollIntentRef.current = { kind: "idle" };
  }, [clearProgrammaticTimeout]);

  const completeProgrammatic = React.useCallback(
    (sequence: number) => {
      if (
        scrollIntentRef.current.kind === "programmatic" &&
        scrollIntentRef.current.sequence === sequence
      ) {
        scrollIntentRef.current = { kind: "idle" };
      }
      clearProgrammaticTimeout();
    },
    [clearProgrammaticTimeout],
  );

  const scheduleProgrammaticCompletion = React.useCallback(
    (sequence: number) => {
      clearProgrammaticTimeout();
      programmaticScrollIdleTimeoutRef.current = setTimeout(() => {
        completeProgrammatic(sequence);
      }, VIEWER_DOCUMENT_SCROLL_IDLE_MS);
    },
    [clearProgrammaticTimeout, completeProgrammatic],
  );

  const markUser = React.useCallback(() => {
    clearProgrammaticTimeout();
    scrollIntentRef.current = { kind: "user" };
  }, [clearProgrammaticTimeout]);

  const startProgrammatic = React.useCallback(
    ({
      behavior,
      copyScrollTarget,
      resolvedTarget,
      target,
    }: {
      behavior: ScrollBehavior;
      copyScrollTarget?: (target: Target) => Target;
      resolvedTarget: ViewerDocumentResolvedScrollTarget;
      target: Target;
    }) => {
      const sequence = scrollIntentSequenceRef.current + 1;
      scrollIntentSequenceRef.current = sequence;
      clearProgrammaticTimeout();

      const intent: Extract<
        ViewerDocumentScrollIntent<Target>,
        { kind: "programmatic" }
      > = {
        behavior,
        kind: "programmatic",
        sequence,
        target: copyScrollTarget ? copyScrollTarget(target) : target,
        targetLeft: resolvedTarget.left,
        targetTop: resolvedTarget.top,
      };
      scrollIntentRef.current = intent;
      return intent;
    },
    [clearProgrammaticTimeout],
  );

  const updateProgrammaticTarget = React.useCallback(
    (
      intent: Extract<
        ViewerDocumentScrollIntent<Target>,
        { kind: "programmatic" }
      >,
      target: ViewerDocumentResolvedScrollTarget,
    ) => {
      const targetChanged =
        Math.abs(intent.targetTop - target.top) >
          VIEWER_DOCUMENT_SCROLL_POSITION_EPSILON ||
        Math.abs((intent.targetLeft ?? 0) - (target.left ?? 0)) >
          VIEWER_DOCUMENT_SCROLL_POSITION_EPSILON;
      const nextIntent = {
        ...intent,
        targetLeft: target.left,
        targetTop: target.top,
      };
      scrollIntentRef.current = nextIntent;
      return { intent: nextIntent, targetChanged };
    },
    [],
  );

  useKeyedMountEffect(joinEffectKey([clearProgrammaticTimeout]), () => () => {
    clearProgrammaticTimeout();
  });

  return React.useMemo(
    () => ({
      clearProgrammaticTimeout,
      completeProgrammatic,
      current: () => scrollIntentRef.current,
      markUser,
      reset,
      scheduleProgrammaticCompletion,
      startProgrammatic,
      updateProgrammaticTarget,
    }),
    [
      clearProgrammaticTimeout,
      completeProgrammatic,
      markUser,
      reset,
      scheduleProgrammaticCompletion,
      startProgrammatic,
      updateProgrammaticTarget,
    ],
  );
}

function readViewerDocumentScrollMetrics<Anchor>({
  layout,
  scrollMapper,
  scrollPageOffset,
  viewportElement,
}: {
  layout: ViewerDocumentLayoutModel<Anchor>;
  scrollMapper: ViewerDocumentScrollMapper;
  scrollPageOffset: number;
  viewportElement: HTMLDivElement | null;
}): ViewerDocumentScrollMetrics {
  const viewportBlockSize = viewportElement?.clientHeight ?? 0;
  const physicalScrollTop = viewportElement?.scrollTop ?? 0;
  const physicalScrollSize = scrollMapper.getPhysicalScrollSize({
    blockSize: layout.blockSize,
    viewportBlockSize,
  });
  const isRebased = physicalScrollSize < layout.blockSize;

  return {
    physicalScrollSize,
    physicalScrollTop,
    scrollPageOffset: isRebased ? scrollPageOffset : 0,
    scrollTop: isRebased
      ? scrollMapper.getLogicalScrollTop({
          blockSize: layout.blockSize,
          physicalScrollTop,
          scrollPageOffset,
          viewportBlockSize,
        })
      : Math.max(0, physicalScrollTop),
    viewportBlockSize,
  };
}

function scrollViewportToPhysicalTop(
  viewportElement: HTMLDivElement,
  targetTop: number,
  options: ScrollToOptions,
) {
  if (
    Math.abs(viewportElement.scrollTop - targetTop) <=
    VIEWER_DOCUMENT_SCROLL_POSITION_EPSILON
  ) {
    return;
  }

  if (typeof viewportElement.scrollTo === "function") {
    viewportElement.scrollTo({
      top: targetTop,
      ...options,
    });
    return;
  }

  setViewportPhysicalScrollTop(viewportElement, targetTop);
}

function setViewportPhysicalScrollTop(
  viewportElement: HTMLDivElement,
  targetTop: number,
) {
  if (
    Math.abs(viewportElement.scrollTop - targetTop) <=
    VIEWER_DOCUMENT_SCROLL_POSITION_EPSILON
  ) {
    return;
  }

  viewportElement.scrollTop = targetTop;
}
