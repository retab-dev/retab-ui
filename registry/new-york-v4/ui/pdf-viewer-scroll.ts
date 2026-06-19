import * as React from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

import {
  findPdfPageByOffset,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { clamp } from "./pdf-viewer-scale";
import type { PdfPageAreaTarget } from "./pdf-viewer-types";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

const PDF_SCROLL_TARGET_HEADROOM = 48;
const PDF_SCROLL_TARGET_INLINE_HEADROOM = 32;
const PDF_READING_MARKER_RATIO = 0.2;
const PDF_SCROLL_IDLE_MS = 120;
const PDF_SCROLL_POSITION_EPSILON = 1;

type PdfReadingAnchor =
  | {
      kind: "top";
    }
  | {
      kind: "page";
      pageNumber: number;
      yPercent: number;
    };

type PdfScrollIntent =
  | {
      kind: "idle";
    }
  | {
      kind: "user";
    }
  | {
      kind: "programmatic";
      behavior: ScrollBehavior;
      sequence: number;
      target: PdfPageAreaTarget;
      targetTop: number;
      targetLeft?: number;
    };

type PdfResolvedPageAreaTarget = {
  top: number;
  left?: number;
};

export function usePdfScrollActivity() {
  const [isScrolling, setIsScrolling] = React.useState(false);
  const [scrollDirection, setScrollDirection] = React.useState(1);
  const idleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scrollTopRef = React.useRef(0);

  const handleScrollActivity = React.useCallback((viewport?: HTMLElement) => {
    const scrollTop = viewport?.scrollTop ?? scrollTopRef.current;
    const previousScrollTop = scrollTopRef.current;
    if (scrollTop > previousScrollTop) {
      setScrollDirection(1);
    } else if (scrollTop < previousScrollTop) {
      setScrollDirection(-1);
    }
    scrollTopRef.current = scrollTop;

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    setIsScrolling(true);
    idleTimeoutRef.current = setTimeout(() => {
      idleTimeoutRef.current = null;
      setIsScrolling(false);
    }, PDF_SCROLL_IDLE_MS);
  }, []);

  useMountEffect(() => () => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
  });

  return { isScrolling, scrollDirection, handleScrollActivity };
}

function usePdfScrollIntentController() {
  const scrollIntentRef = React.useRef<PdfScrollIntent>({ kind: "idle" });
  const scrollIntentSequenceRef = React.useRef(0);
  const programmaticScrollIdleTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearProgrammaticScrollIdleTimeout = React.useCallback(() => {
    if (programmaticScrollIdleTimeoutRef.current) {
      clearTimeout(programmaticScrollIdleTimeoutRef.current);
      programmaticScrollIdleTimeoutRef.current = null;
    }
  }, []);

  const reset = React.useCallback(() => {
    clearProgrammaticScrollIdleTimeout();
    scrollIntentRef.current = { kind: "idle" };
  }, [clearProgrammaticScrollIdleTimeout]);

  const completeProgrammatic = React.useCallback(
    (sequence: number) => {
      if (
        scrollIntentRef.current.kind === "programmatic" &&
        scrollIntentRef.current.sequence === sequence
      ) {
        scrollIntentRef.current = { kind: "idle" };
      }
      clearProgrammaticScrollIdleTimeout();
    },
    [clearProgrammaticScrollIdleTimeout],
  );

  const scheduleProgrammaticCompletion = React.useCallback(
    (sequence: number) => {
      clearProgrammaticScrollIdleTimeout();
      programmaticScrollIdleTimeoutRef.current = setTimeout(() => {
        completeProgrammatic(sequence);
      }, PDF_SCROLL_IDLE_MS);
    },
    [clearProgrammaticScrollIdleTimeout, completeProgrammatic],
  );

  const markUser = React.useCallback(() => {
    clearProgrammaticScrollIdleTimeout();
    scrollIntentRef.current = { kind: "user" };
  }, [clearProgrammaticScrollIdleTimeout]);

  const startProgrammatic = React.useCallback(
    ({
      behavior,
      resolvedTarget,
      target,
    }: {
      behavior: ScrollBehavior;
      resolvedTarget: PdfResolvedPageAreaTarget;
      target: PdfPageAreaTarget;
    }) => {
      const sequence = scrollIntentSequenceRef.current + 1;
      scrollIntentSequenceRef.current = sequence;
      clearProgrammaticScrollIdleTimeout();

      const intent: Extract<PdfScrollIntent, { kind: "programmatic" }> = {
        kind: "programmatic",
        behavior,
        sequence,
        target: copyPdfPageAreaTarget(target),
        targetTop: resolvedTarget.top,
        targetLeft: resolvedTarget.left,
      };
      scrollIntentRef.current = intent;
      return intent;
    },
    [clearProgrammaticScrollIdleTimeout],
  );

  const updateProgrammaticTarget = React.useCallback(
    (
      intent: Extract<PdfScrollIntent, { kind: "programmatic" }>,
      target: PdfResolvedPageAreaTarget,
    ) => {
      const targetChanged =
        Math.abs(intent.targetTop - target.top) > PDF_SCROLL_POSITION_EPSILON ||
        Math.abs((intent.targetLeft ?? 0) - (target.left ?? 0)) >
          PDF_SCROLL_POSITION_EPSILON;
      const nextIntent = {
        ...intent,
        targetTop: target.top,
        targetLeft: target.left,
      };
      scrollIntentRef.current = nextIntent;
      return { intent: nextIntent, targetChanged };
    },
    [],
  );

  useKeyedMountEffect(
    joinEffectKey([clearProgrammaticScrollIdleTimeout]),
    () => () => {
      clearProgrammaticScrollIdleTimeout();
    },
  );

  return React.useMemo(
    () => ({
      completeProgrammatic,
      current: () => scrollIntentRef.current,
      markUser,
      reset,
      scheduleProgrammaticCompletion,
      startProgrammatic,
      updateProgrammaticTarget,
    }),
    [
      completeProgrammatic,
      markUser,
      reset,
      scheduleProgrammaticCompletion,
      startProgrammatic,
      updateProgrammaticTarget,
    ],
  );
}

export function usePdfScroll({
  pageCount,
  layout,
  resetKey,
  onVisiblePageChange,
  onScrollProgressChange,
}: {
  pageCount: number;
  layout: PdfPageLayoutModel;
  resetKey?: unknown;
  onVisiblePageChange?: (page: number) => void;
  onScrollProgressChange?: (progress: number) => void;
}) {
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null);
  const lastReportedPageRef = React.useRef(0);
  const scrollFrameRef = React.useRef(0);
  const viewportResetKeyRef = React.useRef<unknown>(resetKey);
  const didMountResetEffectRef = React.useRef(false);
  const scrollIntent = usePdfScrollIntentController();
  const [viewportElement, setViewportElementState] =
    React.useState<HTMLDivElement | null>(null);
  const [currentPageState, setCurrentPageState] = React.useState<{
    resetKey: unknown;
    page: number;
  }>(() => ({ resetKey, page: 1 }));
  const currentPage = Object.is(currentPageState.resetKey, resetKey)
    ? currentPageState.page
    : 1;

  const resetViewportForKey = React.useCallback(
    (element: HTMLDivElement, key: unknown) => {
      viewportResetKeyRef.current = key;
      scrollIntent.reset();
      setViewportScrollTop(element, 0);
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

  const measureScroll = React.useCallback(() => {
    scrollFrameRef.current = 0;
    const viewportElement = viewportElementRef.current;
    if (!viewportElement) return;

    const scrollable =
      viewportElement.scrollHeight - viewportElement.clientHeight;
    const progress =
      scrollable > 0 ? clamp(viewportElement.scrollTop / scrollable, 0, 1) : 0;
    onScrollProgressChange?.(progress);

    const markerOffset =
      viewportElement.scrollTop +
      viewportElement.clientHeight * PDF_READING_MARKER_RATIO;
    const visiblePage = findPdfPageByOffset(layout, markerOffset);

    if (
      visiblePage >= 1 &&
      visiblePage <= pageCount &&
      visiblePage !== lastReportedPageRef.current
    ) {
      lastReportedPageRef.current = visiblePage;
      setCurrentPageState((previousState) =>
        Object.is(previousState.resetKey, resetKey) &&
        previousState.page === visiblePage
          ? previousState
          : { resetKey, page: visiblePage },
      );
      onVisiblePageChange?.(visiblePage);
    }
  }, [
    layout,
    onScrollProgressChange,
    onVisiblePageChange,
    pageCount,
    resetKey,
  ]);
  const measureScrollRef = React.useRef(measureScroll);
  useKeyedLayoutEffect(joinEffectKey([measureScroll]), () => {
    measureScrollRef.current = measureScroll;
  });

  const committedLayoutRef = React.useRef(layout);
  const committedResetKeyRef = React.useRef<unknown>(resetKey);

  useKeyedLayoutEffect(
    joinEffectKey([layout, pageCount, resetKey, scrollIntent]),
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
      if (activeIntent.kind === "programmatic") {
        const target = getPdfPageAreaScrollTarget(
          viewportElement,
          layout,
          pageCount,
          activeIntent.target,
        );
        if (!target) return;

        const { intent, targetChanged } = scrollIntent.updateProgrammaticTarget(
          activeIntent,
          target,
        );

        if (targetChanged) {
          scrollViewportToPageAreaTarget(viewportElement, target, {
            behavior: intent.behavior,
          });
          scrollIntent.scheduleProgrammaticCompletion(intent.sequence);
        }
        return;
      }

      const anchor = capturePdfReadingAnchor(previousLayout, viewportElement);
      if (!anchor) return;

      restorePdfReadingAnchor(layout, viewportElement, anchor);
    },
  );

  const handleScroll = React.useCallback(() => {
    const activeIntent = scrollIntent.current();
    if (activeIntent.kind === "programmatic") {
      scrollIntent.scheduleProgrammaticCompletion(activeIntent.sequence);
    } else {
      scrollIntent.markUser();
    }

    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(() =>
      measureScrollRef.current(),
    );
  }, [scrollIntent]);

  useKeyedMountEffect(joinEffectKey([resetKey, resetViewportForKey]), () => {
    if (!didMountResetEffectRef.current) {
      didMountResetEffectRef.current = true;
      return;
    }
    lastReportedPageRef.current = 0;
    setCurrentPageState((previousState) =>
      Object.is(previousState.resetKey, resetKey) && previousState.page === 1
        ? previousState
        : { resetKey, page: 1 },
    );
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

  const scrollToPageArea = React.useCallback(
    (target: PdfPageAreaTarget, options?: ScrollToOptions) => {
      const viewportElement = viewportElementRef.current;
      const pageAreaTarget = viewportElement
        ? getPdfPageAreaScrollTarget(viewportElement, layout, pageCount, target)
        : null;
      if (!viewportElement || !pageAreaTarget) return;

      const behavior = options?.behavior ?? "smooth";
      const intent = scrollIntent.startProgrammatic({
        behavior,
        resolvedTarget: pageAreaTarget,
        target,
      });
      scrollViewportToPageAreaTarget(viewportElement, pageAreaTarget, {
        behavior: "smooth",
        ...options,
      });
      scrollIntent.scheduleProgrammaticCompletion(intent.sequence);
    },
    [layout, pageCount, scrollIntent],
  );
  const scrollToPage = React.useCallback(
    (pageNumber: number, options?: ScrollToOptions) => {
      scrollToPageArea({ pageNumber, top: 0 }, options);
    },
    [scrollToPageArea],
  );
  const getViewportElement = React.useCallback(
    () => viewportElementRef.current,
    [],
  );

  useKeyedMountEffect(joinEffectKey([measureScroll]), () => {
    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = 0;
    }
  });

  useMountEffect(() => () => {
    if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
  });

  return {
    currentPage,
    viewportElement,
    setViewportElement,
    measureScroll,
    handleScroll,
    scrollToPage,
    scrollToPageArea,
    getViewportElement,
  };
}

function getPdfPageAreaScrollTarget(
  viewportElement: HTMLDivElement,
  layout: PdfPageLayoutModel,
  pageCount: number,
  target: PdfPageAreaTarget,
): PdfResolvedPageAreaTarget | null {
  const pageNumber = target.pageNumber;
  if (pageNumber < 1 || pageNumber > pageCount) return null;

  const pageLayout = getPdfPageLayout(layout, pageNumber);
  if (!pageLayout) return null;

  const requestedTop = Number.isNaN(target.top) ? 0 : target.top;
  const targetTopPercent = clamp(requestedTop, 0, 100);
  const targetHeightPercent = normalizeOptionalPercent(target.height);
  const areaTop =
    pageLayout.offsetTop + (targetTopPercent / 100) * pageLayout.height;
  const areaBottom =
    areaTop + ((targetHeightPercent ?? 0) / 100) * pageLayout.height;
  const visibleTop = viewportElement.scrollTop + PDF_SCROLL_TARGET_HEADROOM;
  const visibleBottom =
    viewportElement.scrollTop +
    viewportElement.clientHeight -
    PDF_SCROLL_TARGET_HEADROOM;
  let targetTop = areaTop - PDF_SCROLL_TARGET_HEADROOM;

  if (targetHeightPercent != null && areaTop >= visibleTop) {
    targetTop =
      areaBottom > visibleBottom
        ? areaBottom - viewportElement.clientHeight + PDF_SCROLL_TARGET_HEADROOM
        : viewportElement.scrollTop;
  }

  const targetLeft = getPdfPageAreaScrollLeft(viewportElement, layout, {
    pageLayout,
    left: target.left,
    width: target.width,
  });

  return {
    top: Math.max(0, targetTop),
    ...(targetLeft == null ? null : { left: targetLeft }),
  };
}

function scrollViewportToPageAreaTarget(
  viewportElement: HTMLDivElement,
  target: PdfResolvedPageAreaTarget,
  options: ScrollToOptions,
) {
  const hasTopChange =
    Math.abs(viewportElement.scrollTop - target.top) >
    PDF_SCROLL_POSITION_EPSILON;
  const hasLeftChange =
    target.left != null &&
    Math.abs(viewportElement.scrollLeft - target.left) >
      PDF_SCROLL_POSITION_EPSILON;

  if (!hasTopChange && !hasLeftChange) return;

  viewportElement.scrollTo({
    top: target.top,
    ...(target.left == null ? null : { left: target.left }),
    ...options,
  });
}

function copyPdfPageAreaTarget(target: PdfPageAreaTarget): PdfPageAreaTarget {
  return {
    pageNumber: target.pageNumber,
    top: target.top,
    left: target.left,
    width: target.width,
    height: target.height,
  };
}

function getPdfPageAreaScrollLeft(
  viewportElement: HTMLDivElement,
  layout: PdfPageLayoutModel,
  target: {
    pageLayout: NonNullable<ReturnType<typeof getPdfPageLayout>>;
    left?: number;
    width?: number;
  },
) {
  const targetLeftPercent = normalizeOptionalPercent(target.left);
  const targetWidthPercent = normalizeOptionalPercent(target.width);
  if (targetLeftPercent == null || targetWidthPercent == null) return undefined;

  const documentInlineOffset = Math.max(
    0,
    (viewportElement.clientWidth - layout.maxPageWidth) / 2,
  );
  const pageInlineOffset =
    documentInlineOffset + (layout.maxPageWidth - target.pageLayout.width) / 2;
  const areaLeft =
    pageInlineOffset + (targetLeftPercent / 100) * target.pageLayout.width;
  const areaRight =
    areaLeft + (targetWidthPercent / 100) * target.pageLayout.width;
  const visibleLeft =
    viewportElement.scrollLeft + PDF_SCROLL_TARGET_INLINE_HEADROOM;
  const visibleRight =
    viewportElement.scrollLeft +
    viewportElement.clientWidth -
    PDF_SCROLL_TARGET_INLINE_HEADROOM;

  if (areaLeft < visibleLeft) {
    return Math.max(0, areaLeft - PDF_SCROLL_TARGET_INLINE_HEADROOM);
  }
  if (areaRight > visibleRight) {
    return Math.max(
      0,
      areaRight -
        viewportElement.clientWidth +
        PDF_SCROLL_TARGET_INLINE_HEADROOM,
    );
  }
  return viewportElement.scrollLeft;
}

function normalizeOptionalPercent(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return undefined;
  return clamp(value, 0, 100);
}

function capturePdfReadingAnchor(
  layout: PdfPageLayoutModel,
  viewportElement: HTMLDivElement,
): PdfReadingAnchor | null {
  if (layout.pageCount === 0) return null;
  if (viewportElement.scrollTop <= 0) return { kind: "top" };

  const viewportHeight = viewportElement.clientHeight;
  const markerOffset =
    viewportElement.scrollTop + viewportHeight * PDF_READING_MARKER_RATIO;
  const pageNumber = findPdfPageByOffset(layout, markerOffset);
  const pageLayout = getPdfPageLayout(layout, pageNumber);
  if (!pageLayout || pageLayout.height <= 0) return null;

  return {
    kind: "page",
    pageNumber,
    yPercent: clamp(
      (markerOffset - pageLayout.offsetTop) / pageLayout.height,
      0,
      1,
    ),
  };
}

function restorePdfReadingAnchor(
  layout: PdfPageLayoutModel,
  viewportElement: HTMLDivElement,
  anchor: PdfReadingAnchor,
) {
  if (anchor.kind === "top") {
    setViewportScrollTop(viewportElement, 0);
    return;
  }

  const pageLayout = getPdfPageLayout(layout, anchor.pageNumber);
  if (!pageLayout) return;

  const viewportHeight = viewportElement.clientHeight;
  const targetTop =
    pageLayout.offsetTop +
    pageLayout.height * anchor.yPercent -
    viewportHeight * PDF_READING_MARKER_RATIO;
  const maxScrollTop = Math.max(
    0,
    layout.totalHeight - viewportElement.clientHeight,
  );
  setViewportScrollTop(viewportElement, clamp(targetTop, 0, maxScrollTop));
}

function setViewportScrollTop(
  viewportElement: HTMLDivElement,
  targetTop: number,
) {
  if (
    Math.abs(viewportElement.scrollTop - targetTop) <=
    PDF_SCROLL_POSITION_EPSILON
  ) {
    return;
  }

  viewportElement.scrollTop = targetTop;
}
