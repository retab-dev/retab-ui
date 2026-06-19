import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";

export const PDF_RENDERED_PAGE_CACHE_MAX_ENTRIES = 6;
export const PDF_RENDERED_PAGE_CACHE_MAX_PIXELS = 24_000_000;

export type PdfRenderedPageSignature = {
  pageNumber: number;
  scale: number;
  rotation: number;
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type PdfRenderedPageCache = {
  clock: number;
  entries: Map<string, PdfRenderedPageCacheEntry>;
  resetKey: unknown;
};

export type PdfRenderedPageCacheEntry = PdfRenderedPageSignature & {
  canvas: HTMLCanvasElement;
  lastUsed: number;
  pixels: number;
};

export function usePdfRenderedPageCache(resetKey: unknown) {
  const cacheRef = React.useRef<PdfRenderedPageCache>({
    clock: 0,
    entries: new Map(),
    resetKey,
  });
  if (!Object.is(cacheRef.current.resetKey, resetKey)) {
    clearPdfRenderedPageCache(cacheRef.current);
    cacheRef.current.resetKey = resetKey;
  }

  useMountEffect(() => () => clearPdfRenderedPageCache(cacheRef.current));

  return cacheRef.current;
}

export function readPdfRenderedPageCache(
  cache: PdfRenderedPageCache | undefined,
  requested: PdfRenderedPageSignature,
) {
  if (!cache) return null;

  let bestEntry: PdfRenderedPageCacheEntry | null = null;
  for (const entry of cache.entries.values()) {
    if (!doesRenderedPageSatisfyRequest(entry, requested)) continue;
    if (
      !bestEntry ||
      entry.devicePixelRatio < bestEntry.devicePixelRatio ||
      (entry.devicePixelRatio === bestEntry.devicePixelRatio &&
        entry.lastUsed > bestEntry.lastUsed)
    ) {
      bestEntry = entry;
    }
  }

  if (!bestEntry) return null;
  cache.clock += 1;
  bestEntry.lastUsed = cache.clock;
  return bestEntry;
}

export function writePdfRenderedPageCache({
  cache,
  rendered,
  sourceCanvas,
}: {
  cache: PdfRenderedPageCache | undefined;
  rendered: PdfRenderedPageSignature;
  sourceCanvas: HTMLCanvasElement;
}) {
  if (!cache || sourceCanvas.width <= 0 || sourceCanvas.height <= 0) return;

  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const context = canvas.getContext("2d");
  if (!context || typeof context.drawImage !== "function") return;

  context.drawImage(sourceCanvas, 0, 0);
  cache.clock += 1;
  const key = getPdfRenderedPageCacheKey(rendered);
  cache.entries.set(key, {
    ...rendered,
    canvas,
    lastUsed: cache.clock,
    pixels: canvas.width * canvas.height,
  });
  evictPdfRenderedPageCache(cache, key);
}

export function clearPdfRenderedPageCache(cache: PdfRenderedPageCache) {
  cache.clock = 0;
  cache.entries.clear();
}

function evictPdfRenderedPageCache(
  cache: PdfRenderedPageCache,
  retainedKey: string,
) {
  let totalPixels = getTotalCachedPixels(cache);

  while (
    cache.entries.size > PDF_RENDERED_PAGE_CACHE_MAX_ENTRIES ||
    totalPixels > PDF_RENDERED_PAGE_CACHE_MAX_PIXELS
  ) {
    const evicted = findPdfRenderedPageCacheEviction(cache, retainedKey);
    if (!evicted) return;

    totalPixels -= evicted.entry.pixels;
    cache.entries.delete(evicted.key);
  }
}

function findPdfRenderedPageCacheEviction(
  cache: PdfRenderedPageCache,
  retainedKey: string,
) {
  let oldest: { key: string; entry: PdfRenderedPageCacheEntry } | null = null;

  for (const [key, entry] of cache.entries) {
    if (key === retainedKey) continue;
    if (!oldest || entry.lastUsed < oldest.entry.lastUsed) {
      oldest = { key, entry };
    }
  }

  return oldest;
}

function getTotalCachedPixels(cache: PdfRenderedPageCache) {
  let pixels = 0;
  for (const entry of cache.entries.values()) {
    pixels += entry.pixels;
  }
  return pixels;
}

function doesRenderedPageSatisfyRequest(
  rendered: PdfRenderedPageSignature,
  requested: PdfRenderedPageSignature,
) {
  return (
    rendered.pageNumber === requested.pageNumber &&
    rendered.scale === requested.scale &&
    rendered.rotation === requested.rotation &&
    rendered.viewportWidth === requested.viewportWidth &&
    rendered.viewportHeight === requested.viewportHeight &&
    rendered.devicePixelRatio >= requested.devicePixelRatio
  );
}

function getPdfRenderedPageCacheKey(rendered: PdfRenderedPageSignature) {
  return [
    rendered.pageNumber,
    rendered.scale,
    rendered.rotation,
    rendered.devicePixelRatio,
    rendered.viewportWidth,
    rendered.viewportHeight,
  ].join(":");
}
