"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type StableElementSize<Element extends HTMLElement = HTMLElement> = {
  element: Element | null;
  hasMeasured: boolean;
  height: number | null;
  setElement: React.RefCallback<Element>;
  width: number | null;
};

export type StableElementSizeOptions = {
  retainLastNonZero?: boolean;
};

type MeasuredSize = {
  height: number | null;
  width: number | null;
};

type RawMeasuredSize = {
  height: number;
  width: number;
};

function readElementSize(element: HTMLElement): RawMeasuredSize {
  const rect =
    typeof element.getBoundingClientRect === "function"
      ? element.getBoundingClientRect()
      : null;

  return {
    height: rect?.height || element.clientHeight,
    width: rect?.width || element.clientWidth,
  };
}

function resolveMeasuredElementSize({
  currentSize,
  nextSize,
  retainLastNonZero,
}: {
  currentSize: MeasuredSize;
  nextSize: RawMeasuredSize;
  retainLastNonZero: boolean;
}): MeasuredSize {
  const width =
    Number.isFinite(nextSize.width) &&
    (!retainLastNonZero || nextSize.width > 0)
      ? nextSize.width
      : currentSize.width;
  const height =
    Number.isFinite(nextSize.height) &&
    (!retainLastNonZero || nextSize.height > 0)
      ? nextSize.height
      : currentSize.height;

  if (currentSize.width === width && currentSize.height === height) {
    return currentSize;
  }

  return { height, width };
}

export function useStableElementSize<Element extends HTMLElement = HTMLElement>(
  options: StableElementSizeOptions = {},
): StableElementSize<Element> {
  const retainLastNonZero = options.retainLastNonZero ?? false;
  const [element, setElementState] = React.useState<Element | null>(null);
  const [size, setSize] = React.useState<MeasuredSize>({
    height: null,
    width: null,
  });
  const hasMeasured = size.height !== null || size.width !== null;

  const setElement = React.useCallback((nextElement: Element | null) => {
    setElementState(nextElement);
  }, []);

  useKeyedLayoutEffect(
    element ? joinEffectKey([element, retainLastNonZero]) : null,
    () => {
      if (!element) return;

      setSize((currentSize) =>
        resolveMeasuredElementSize({
          currentSize,
          nextSize: readElementSize(element),
          retainLastNonZero,
        }),
      );

      const ResizeObserverConstructor = globalThis.ResizeObserver;
      if (typeof ResizeObserverConstructor === "undefined") return;

      let frame = 0;
      let latestSize = readElementSize(element);
      const observer = new ResizeObserverConstructor((entries) => {
        for (const entry of entries) {
          latestSize = readElementSize(entry.target as HTMLElement);
        }

        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          setSize((currentSize) =>
            resolveMeasuredElementSize({
              currentSize,
              nextSize: latestSize,
              retainLastNonZero,
            }),
          );
        });
      });

      observer.observe(element);

      return () => {
        if (frame) cancelAnimationFrame(frame);
        observer.disconnect();
      };
    },
  );

  return React.useMemo(
    () => ({
      element,
      hasMeasured,
      height: size.height,
      setElement,
      width: size.width,
    }),
    [element, hasMeasured, setElement, size.height, size.width],
  );
}
