"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import {
  findClosestViewerBody,
  readViewerElementSize,
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
  ViewerSurfaceMeasurement,
  ViewerSurfaceProps,
  ViewerViewportProps,
} from "./viewer-types";

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
