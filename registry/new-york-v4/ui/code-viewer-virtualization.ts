import { CODE_VIEWER_BLOCK_PADDING } from "./code-viewer-scale";

export interface CodeVirtualLine {
  index: number;
  key: number;
  size: number;
  start: number;
}

export interface CodeVirtualLineWindow {
  lineCount: number;
  lineHeight: number;
  overscan: number;
  paddingStart: number;
  scrollTop: number;
  viewportHeight: number;
}

export function getCodeVirtualLines({
  lineCount,
  lineHeight,
  overscan,
  paddingStart,
  scrollTop,
  viewportHeight,
}: CodeVirtualLineWindow): CodeVirtualLine[] {
  const safeLineCount = safeCount(lineCount);
  const safeLineHeight = safeSize(lineHeight);
  if (safeLineCount === 0) return [];

  const safeOverscan = safeCount(overscan);
  const safeScrollTop = Math.max(0, finiteNumber(scrollTop));
  const safeViewportHeight = Math.max(0, finiteNumber(viewportHeight));
  const safePaddingStart = safePadding(paddingStart);
  const firstVisibleLine = clamp(
    Math.floor(Math.max(0, safeScrollTop - safePaddingStart) / safeLineHeight),
    0,
    safeLineCount - 1,
  );
  const visibleLineCount = Math.max(
    1,
    Math.ceil(safeViewportHeight / safeLineHeight),
  );
  const start = Math.max(0, firstVisibleLine - safeOverscan);
  const end = Math.min(
    safeLineCount,
    firstVisibleLine + visibleLineCount + safeOverscan * 2,
  );

  return Array.from({ length: end - start }, (_, offset) => {
    const index = start + offset;
    return {
      index,
      key: index,
      size: safeLineHeight,
      start: safePaddingStart + index * safeLineHeight,
    };
  });
}

export function getCodeVirtualTotalSize({
  lineCount,
  lineHeight,
  paddingEnd = CODE_VIEWER_BLOCK_PADDING,
  paddingStart = CODE_VIEWER_BLOCK_PADDING,
}: {
  lineCount: number;
  lineHeight: number;
  paddingEnd?: number;
  paddingStart?: number;
}) {
  return (
    safePadding(paddingStart) +
    safeCount(lineCount) * safeSize(lineHeight) +
    safePadding(paddingEnd)
  );
}

function finiteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function safeCount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function safeSize(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function safePadding(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
