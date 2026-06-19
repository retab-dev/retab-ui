"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import {
  createPageMeasurementKey,
  findPageMarkdownPageByOffset,
  getPageMarkdownPageLayout,
  type PageMarkdownLayoutModel,
} from "@/components/viewers/page-markdown/page-markdown-layout";
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types";

type PageHeightMeasurement = {
  height: number;
  measurementKey: string;
};

type PageMarkdownScrollAnchor = {
  offsetWithinPage: number;
  pageNumber: number;
};

export function usePageMarkdownMeasurements({
  mode,
  pages,
  scale,
}: {
  mode: PageMarkdownViewMode;
  pages: readonly string[];
  scale: number;
}) {
  const [pageHeightMeasurements, setPageHeightMeasurements] = React.useState<
    Map<number, PageHeightMeasurement>
  >(() => new Map());

  const measuredHeightByPageNumber = React.useMemo(() => {
    const measuredHeightByPageNumber = new Map<number, number>();
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const pageNumber = pageIndex + 1;
      const measurement = pageHeightMeasurements.get(pageNumber);
      if (!measurement) continue;

      const measurementKey = createPageMeasurementKey({
        markdown: pages[pageIndex]!,
        mode,
        scale,
      });
      if (measurement.measurementKey === measurementKey) {
        measuredHeightByPageNumber.set(pageNumber, measurement.height);
      }
    }
    return measuredHeightByPageNumber;
  }, [mode, pageHeightMeasurements, pages, scale]);

  const setPageHeight = React.useCallback(
    (
      pageNumber: number,
      height: number,
      beforeMeasurementChange?: () => void,
    ) => {
      const markdown = pages[pageNumber - 1];
      if (!markdown || !Number.isFinite(height) || height <= 0) return;

      const measurementKey = createPageMeasurementKey({
        markdown,
        mode,
        scale,
      });
      setPageHeightMeasurements((current) => {
        const currentMeasurement = current.get(pageNumber);
        if (
          currentMeasurement?.measurementKey === measurementKey &&
          currentMeasurement.height === height
        ) {
          return current;
        }

        beforeMeasurementChange?.();
        const next = new Map(current);
        next.set(pageNumber, { height, measurementKey });
        return next;
      });
    },
    [mode, pages, scale],
  );

  return {
    measuredHeightByPageNumber,
    setPageHeight,
  };
}

export function usePageMarkdownScrollAnchor({
  layout,
  onRestore,
  viewportElement,
}: {
  layout: PageMarkdownLayoutModel;
  onRestore?: () => void;
  viewportElement: HTMLDivElement | null;
}) {
  const pendingScrollAnchorRef = React.useRef<PageMarkdownScrollAnchor | null>(
    null,
  );
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    viewportElementRef.current = viewportElement;
  }, [viewportElement]);

  const captureScrollAnchor = React.useCallback(() => {
    const currentViewportElement = viewportElementRef.current;
    if (!currentViewportElement) return;

    const pageNumber = findPageMarkdownPageByOffset(
      layout,
      currentViewportElement.scrollTop,
    );
    const pageLayout = getPageMarkdownPageLayout(layout, pageNumber);
    if (!pageLayout) return;

    pendingScrollAnchorRef.current = {
      offsetWithinPage: currentViewportElement.scrollTop - pageLayout.offsetTop,
      pageNumber,
    };
  }, [layout]);

  React.useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    const currentViewportElement = viewportElementRef.current;
    if (!anchor || !currentViewportElement) return;

    pendingScrollAnchorRef.current = null;
    const pageLayout = getPageMarkdownPageLayout(layout, anchor.pageNumber);
    if (!pageLayout) return;

    const nextScrollTop = Math.max(
      0,
      pageLayout.offsetTop + anchor.offsetWithinPage,
    );
    if (Math.abs(currentViewportElement.scrollTop - nextScrollTop) > 0.5) {
      currentViewportElement.scrollTop = nextScrollTop;
    }
    onRestore?.();
  }, [layout, onRestore]);

  return { captureScrollAnchor };
}
