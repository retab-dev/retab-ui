/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import type { PdfPageRenderTiming } from "./pdf-viewer-types";

export const PDF_PAGE_RENDER_CONCURRENCY = 2;

type PdfPageRenderKeyInput = {
  pageNumber: number;
  scale: number;
  rotation: number;
  devicePixelRatio: number;
};

type PdfPageRenderRequest = PdfPageRenderKeyInput;

export function getPdfPageRenderKey({
  pageNumber,
  scale,
  rotation,
  devicePixelRatio,
}: PdfPageRenderKeyInput) {
  return `${pageNumber}:${scale}:${rotation}:${devicePixelRatio}`;
}

export function usePdfPageRenderScheduler({
  pageNumbers,
  lowPriorityPageNumbers = [],
  scale,
  rotation,
  devicePixelRatio,
  resetKey,
  maxRunning = PDF_PAGE_RENDER_CONCURRENCY,
  maxLowPriorityRunning = 1,
}: {
  pageNumbers: readonly number[];
  lowPriorityPageNumbers?: readonly number[];
  scale: number;
  rotation: number;
  devicePixelRatio: number;
  resetKey: unknown;
  maxRunning?: number;
  maxLowPriorityRunning?: number;
}) {
  const requestedRenders = React.useMemo<PdfPageRenderRequest[]>(
    () =>
      mergePdfPageNumbers(pageNumbers).map((pageNumber) => ({
        pageNumber,
        scale,
        rotation,
        devicePixelRatio,
      })),
    [devicePixelRatio, pageNumbers, rotation, scale],
  );
  const lowPriorityRequestedRenders = React.useMemo<
    PdfPageRenderRequest[]
  >(() => {
    const primaryPageNumberSet = new Set(pageNumbers);
    return mergePdfPageNumbers(lowPriorityPageNumbers)
      .filter((pageNumber) => !primaryPageNumberSet.has(pageNumber))
      .map((pageNumber) => ({
        pageNumber,
        scale,
        rotation,
        devicePixelRatio,
      }));
  }, [devicePixelRatio, lowPriorityPageNumbers, pageNumbers, rotation, scale]);
  const allRequestedRenders = React.useMemo(
    () => [...requestedRenders, ...lowPriorityRequestedRenders],
    [lowPriorityRequestedRenders, requestedRenders],
  );
  const requestedRendersRef = React.useRef(allRequestedRenders);
  const resetKeyRef = React.useRef(resetKey);
  React.useLayoutEffect(() => {
    requestedRendersRef.current = allRequestedRenders;
    resetKeyRef.current = resetKey;
  }, [allRequestedRenders, resetKey]);

  const [state, setState] = React.useState<{
    resetKey: unknown;
    renderedByKey: ReadonlyMap<string, PdfPageRenderRequest>;
  }>(() => ({ resetKey, renderedByKey: new Map() }));
  const emptyRenderedByKey = React.useMemo<
    ReadonlyMap<string, PdfPageRenderRequest>
  >(() => new Map(), []);
  const renderedByKey = Object.is(state.resetKey, resetKey)
    ? state.renderedByKey
    : emptyRenderedByKey;

  React.useEffect(() => {
    setState((previousState) => {
      if (!Object.is(previousState.resetKey, resetKey)) {
        return { resetKey, renderedByKey: new Map() };
      }

      const renderedByKey = new Map<string, PdfPageRenderRequest>();
      for (const [key, rendered] of previousState.renderedByKey) {
        if (
          allRequestedRenders.some((request) =>
            doesRenderedPageSatisfyRequest(rendered, request),
          )
        ) {
          renderedByKey.set(key, rendered);
        }
      }

      return areMapsEqual(previousState.renderedByKey, renderedByKey)
        ? previousState
        : { resetKey, renderedByKey };
    });
  }, [allRequestedRenders, resetKey]);

  const activePageNumbers = React.useMemo(() => {
    const renderedPageNumbers: number[] = [];
    const pendingPageNumbers: number[] = [];
    const lowPriorityRenderedPageNumbers: number[] = [];
    const lowPriorityPendingPageNumbers: number[] = [];

    for (const request of requestedRenders) {
      if (isRenderRequestSatisfied(request, renderedByKey)) {
        renderedPageNumbers.push(request.pageNumber);
      } else {
        pendingPageNumbers.push(request.pageNumber);
      }
    }
    for (const request of lowPriorityRequestedRenders) {
      if (isRenderRequestSatisfied(request, renderedByKey)) {
        lowPriorityRenderedPageNumbers.push(request.pageNumber);
      } else {
        lowPriorityPendingPageNumbers.push(request.pageNumber);
      }
    }

    const activePrimaryPageNumbers = [
      ...renderedPageNumbers,
      ...pendingPageNumbers.slice(0, Math.max(1, maxRunning)),
    ];
    const activeLowPriorityPageNumbers =
      pendingPageNumbers.length > 0
        ? lowPriorityRenderedPageNumbers
        : [
            ...lowPriorityRenderedPageNumbers,
            ...lowPriorityPendingPageNumbers.slice(
              0,
              Math.max(0, maxLowPriorityRunning),
            ),
          ];

    return mergePdfPageNumbers([
      ...activePrimaryPageNumbers,
      ...activeLowPriorityPageNumbers,
    ]);
  }, [
    lowPriorityRequestedRenders,
    maxLowPriorityRunning,
    maxRunning,
    renderedByKey,
    requestedRenders,
  ]);

  const onPageRenderTiming = React.useCallback(
    (timing: PdfPageRenderTiming) => {
      const key = getPdfPageRenderKey(timing);

      setState((previousState) => {
        const resetKey = resetKeyRef.current;
        const previousRenderedByKey = Object.is(
          previousState.resetKey,
          resetKey,
        )
          ? previousState.renderedByKey
          : new Map<string, PdfPageRenderRequest>();
        const nextRenderedByKey = new Map(previousRenderedByKey);
        const rendered: PdfPageRenderRequest = {
          pageNumber: timing.pageNumber,
          scale: timing.scale,
          rotation: timing.rotation,
          devicePixelRatio: timing.devicePixelRatio,
        };

        if (
          timing.status === "rendered" &&
          requestedRendersRef.current.some((request) =>
            doesRenderedPageSatisfyRequest(rendered, request),
          )
        ) {
          nextRenderedByKey.set(key, rendered);
        } else {
          nextRenderedByKey.delete(key);
        }

        return areMapsEqual(previousRenderedByKey, nextRenderedByKey)
          ? previousState
          : { resetKey, renderedByKey: nextRenderedByKey };
      });
    },
    [],
  );

  return { activePageNumbers, onPageRenderTiming };
}

function mergePdfPageNumbers(pageNumbers: readonly number[]) {
  return [...new Set(pageNumbers)].sort((left, right) => left - right);
}

function isRenderRequestSatisfied(
  request: PdfPageRenderRequest,
  renderedByKey: ReadonlyMap<string, PdfPageRenderRequest>,
) {
  for (const rendered of renderedByKey.values()) {
    if (doesRenderedPageSatisfyRequest(rendered, request)) return true;
  }
  return false;
}

function doesRenderedPageSatisfyRequest(
  rendered: PdfPageRenderRequest,
  request: PdfPageRenderRequest,
) {
  return (
    rendered.pageNumber === request.pageNumber &&
    rendered.scale === request.scale &&
    rendered.rotation === request.rotation &&
    rendered.devicePixelRatio >= request.devicePixelRatio
  );
}

function areMapsEqual(
  left: ReadonlyMap<string, PdfPageRenderRequest>,
  right: ReadonlyMap<string, PdfPageRenderRequest>,
) {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
}
