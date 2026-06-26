"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import {
  findClosestViewerBody,
  readViewerElementSize,
  useOptionalViewerSidebarRegistration,
  useOptionalViewerSurfaceMeasurementContext,
  useViewerDevelopmentLayoutWarning,
  useViewerViewportPresence,
  ViewerSurfaceMeasurementProvider,
  ViewerViewportPresenceProvider,
} from "./viewer-internals";
import { useOptionalViewerRootDiagnostics } from "./viewer-root";
import { warnViewerDevelopmentOnce } from "./viewer-diagnostics";
import { useStableElementSize } from "./viewer-measurement";
import type {
  ViewerDocumentFrameAlign,
  ViewerDocumentFrameProps,
  ViewerSidebarLayoutSnapshot,
  ViewerSidebarLayoutStore,
  ViewerSurfaceMeasurement,
  ViewerSurfaceProps,
  ViewerViewportProps,
} from "./viewer-types";

export type ViewerDocumentFrameLayoutTransitionSample = {
  inlineSize: number;
  isTransitioning: boolean;
  maxInlineSize: number;
  progress: number;
  targetInlineSize: number;
};

export type ViewerDocumentFrameLayoutTransition = {
  getSnapshot: () => ViewerDocumentFrameLayoutTransitionSample | null;
  subscribe: (listener: () => void) => () => void;
};

export type ViewerDocumentFrameState = {
  align: ViewerDocumentFrameAlign;
  element: HTMLDivElement | null;
  inlineSize: number | null;
  layoutTransition: ViewerDocumentFrameLayoutTransition | null;
};

const ViewerDocumentFrameContext =
  React.createContext<ViewerDocumentFrameState | null>(null);

function getDocumentFrameAlignClass(align: ViewerDocumentFrameAlign) {
  switch (align) {
    case "center":
      return "mx-auto";
    case "end":
      return "ml-auto";
    case "start":
      return "mr-auto";
  }
}

export function useOptionalViewerDocumentFrame(): ViewerDocumentFrameState | null {
  return React.useContext(ViewerDocumentFrameContext);
}

export function ViewerDocumentFrame({
  align = "start",
  children,
  className,
  maxInlineSize,
  style,
  ...props
}: ViewerDocumentFrameProps) {
  const size = useStableElementSize<HTMLDivElement>({
    retainLastNonZero: true,
  });
  const sidebarRegistration = useOptionalViewerSidebarRegistration();
  const layoutTransition = useViewerDocumentFrameLayoutTransition({
    element: size.element,
    layoutStore: sidebarRegistration?.layoutStore ?? null,
  });
  const value = React.useMemo<ViewerDocumentFrameState>(
    () => ({
      align,
      element: size.element,
      inlineSize: size.width,
      layoutTransition,
    }),
    [align, layoutTransition, size.element, size.width],
  );

  return (
    <ViewerDocumentFrameContext.Provider value={value}>
      <div
        ref={size.setElement}
        data-slot="viewer-document-frame"
        className={cn(
          "[container-type:inline-size] relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col",
          getDocumentFrameAlignClass(align),
          className,
        )}
        style={
          {
            maxInlineSize,
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </div>
    </ViewerDocumentFrameContext.Provider>
  );
}

function useViewerDocumentFrameLayoutTransition({
  element,
  layoutStore,
}: {
  element: HTMLDivElement | null;
  layoutStore: ViewerSidebarLayoutStore | null;
}): ViewerDocumentFrameLayoutTransition | null {
  const getSnapshot = React.useCallback(() => {
    if (!element || !layoutStore) return null;

    return getViewerDocumentFrameLayoutTransitionSample(
      element,
      layoutStore.getSnapshot(),
    );
  }, [element, layoutStore]);

  const subscribe = React.useCallback(
    (listener: () => void) => {
      if (!layoutStore) return () => {};
      return layoutStore.subscribe(listener);
    },
    [layoutStore],
  );

  return React.useMemo(() => {
    if (!element || !layoutStore) return null;
    return { getSnapshot, subscribe };
  }, [element, getSnapshot, layoutStore, subscribe]);
}

function getViewerDocumentFrameLayoutTransitionSample(
  element: HTMLDivElement,
  sidebar: ViewerSidebarLayoutSnapshot,
): ViewerDocumentFrameLayoutTransitionSample | null {
  const inlineSize = getViewerDocumentFrameVisualInlineSize(element, sidebar);
  const targetInlineSize = getViewerDocumentFrameTargetInlineSize(
    element,
    sidebar,
  );
  if (inlineSize === null) return null;

  return {
    inlineSize,
    isTransitioning: sidebar.isTransitioning,
    maxInlineSize: getViewerDocumentFrameMaxInlineSize(element, sidebar),
    progress: sidebar.progress,
    targetInlineSize: targetInlineSize ?? inlineSize,
  };
}

function getViewerDocumentFrameTargetInlineSize(
  element: HTMLDivElement,
  sidebar: ViewerSidebarLayoutSnapshot,
) {
  const targetProgress =
    sidebar.mode === "inline" && sidebar.open && sidebar.sidebarWidth > 0
      ? 1
      : 0;

  return getViewerDocumentFrameVisualInlineSize(element, {
    ...sidebar,
    progress: targetProgress,
  });
}

function getViewerDocumentFrameMaxInlineSize(
  element: HTMLDivElement,
  sidebar: ViewerSidebarLayoutSnapshot,
) {
  const collapsedInlineSize = getViewerDocumentFrameVisualInlineSize(element, {
    ...sidebar,
    progress: 0,
  });
  const expandedInlineSize = getViewerDocumentFrameVisualInlineSize(element, {
    ...sidebar,
    progress: sidebar.mode === "inline" && sidebar.sidebarWidth > 0 ? 1 : 0,
  });

  return Math.max(
    collapsedInlineSize ?? 0,
    expandedInlineSize ?? 0,
    getViewerDocumentFrameVisualInlineSize(element, sidebar) ?? 0,
    1,
  );
}

function getViewerDocumentFrameVisualInlineSize(
  element: HTMLDivElement,
  sidebar: ViewerSidebarLayoutSnapshot,
) {
  const measuredFrameWidth = readViewerElementSize(element).width;

  if (
    sidebar.mode !== "inline" ||
    sidebar.sidebarGapTransition !== "width" ||
    sidebar.sidebarWidth <= 0
  ) {
    return measuredFrameWidth > 0 ? measuredFrameWidth : null;
  }

  const bodyElement = findClosestViewerBody(element);
  const measuredBodyWidth = readViewerElementSize(bodyElement).width;
  const bodyWidth =
    measuredBodyWidth > 0
      ? measuredBodyWidth
      : measuredFrameWidth + sidebar.sidebarWidth * sidebar.progress;
  const availableWidth = Math.max(
    1,
    bodyWidth - sidebar.sidebarWidth * sidebar.progress,
  );
  const maxInlineSize = readViewerDocumentFrameMaxInlineSize(element);

  return maxInlineSize == null
    ? availableWidth
    : Math.min(availableWidth, maxInlineSize);
}

function readViewerDocumentFrameMaxInlineSize(element: HTMLElement) {
  if (typeof window === "undefined") return null;

  const value = window.getComputedStyle(element).maxInlineSize;
  if (!value || value === "none") return null;

  const size = Number.parseFloat(value);
  return Number.isFinite(size) && size > 0 ? size : null;
}

function useViewerSurfaceMeasurementValue(): ViewerSurfaceMeasurement {
  const size = useStableElementSize<HTMLDivElement>({
    retainLastNonZero: true,
  });

  return React.useMemo(
    () => ({
      hasMeasured: size.hasMeasured,
      setViewportElement: size.setElement,
      viewportElement: size.element,
      viewportHeight: size.height,
      viewportWidth: size.width,
    }),
    [size.element, size.hasMeasured, size.height, size.setElement, size.width],
  );
}

export function useOptionalViewerSurfaceMeasurement(): ViewerSurfaceMeasurement | null {
  return useOptionalViewerSurfaceMeasurementContext();
}

export function useViewerSurfaceMeasurement(): ViewerSurfaceMeasurement {
  const context = useOptionalViewerSurfaceMeasurement();
  if (!context) {
    throw new Error(
      "useViewerSurfaceMeasurement must be used within a ViewerSurface.",
    );
  }
  return context;
}

export function useIsInsideViewerViewport(): boolean {
  return useViewerViewportPresence();
}

export function ViewerSurface({ className, ...props }: ViewerSurfaceProps) {
  const measurement = useViewerSurfaceMeasurementValue();

  return (
    <ViewerSurfaceMeasurementProvider value={measurement}>
      <div
        data-slot="viewer-surface"
        data-viewer-surface="inset"
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          className,
        )}
        {...props}
      />
    </ViewerSurfaceMeasurementProvider>
  );
}

export const ViewerViewport = React.forwardRef<
  HTMLDivElement,
  ViewerViewportProps
>(function ViewerViewport({ children, className, ...props }, forwardedRef) {
  const measurement = useOptionalViewerSurfaceMeasurement();
  const rootDiagnostics = useOptionalViewerRootDiagnostics();
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const setViewportElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef.current = element;
      measurement?.setViewportElement(element);

      if (typeof forwardedRef === "function") {
        forwardedRef(element);
        return;
      }

      if (forwardedRef) {
        forwardedRef.current = element;
      }
    },
    [forwardedRef, measurement],
  );

  useViewerDevelopmentLayoutWarning({
    enabled: Boolean(rootDiagnostics),
    elements: () => [
      findClosestViewerBody(viewportRef.current),
      viewportRef.current,
    ],
    inspect: () => {
      const viewportElement = viewportRef.current;
      const bodyElement = findClosestViewerBody(viewportElement);
      const bodySize = readViewerElementSize(bodyElement);
      const viewportSize = readViewerElementSize(viewportElement);

      if (bodySize.width > 0 && viewportSize.width === 0) {
        warnViewerDevelopmentOnce({
          code: "viewer_viewport_zero_width",
          message:
            "viewer body has nonzero width but surface viewport width is zero.",
          rootId: rootDiagnostics?.rootId ?? "unknown-root",
          details: {
            bodyHeight: bodySize.height,
            bodySlot: bodyElement?.dataset.slot,
            bodyWidth: bodySize.width,
            viewportHeight: viewportSize.height,
            viewportSlot: viewportElement?.dataset.slot,
            viewportWidth: viewportSize.width,
          },
        });
      }
    },
    keyParts: [
      "viewer-viewport-zero-width",
      rootDiagnostics?.rootId,
      viewportRef.current,
    ],
  });

  return (
    <div
      ref={setViewportElement}
      data-slot="viewer-viewport"
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        className,
      )}
      {...props}
    >
      <ViewerViewportPresenceProvider>
        {children}
      </ViewerViewportPresenceProvider>
    </div>
  );
});
