"use client";

import type {
  MarkdownGreenfieldBlock,
  MarkdownGreenfieldChunk,
  MarkdownGreenfieldDocument,
} from "./markdown-greenfield-document";

const DOCUMENT_PADDING_Y = 32;
const CHUNK_PADDING_X = 32;
const MIN_CHUNK_HEIGHT = 64;
// Tuned to the rendered typography (15.5px body at leading-relaxed ≈ 25px,
// 14px mono code at leading-5 = 20px) so estimates track measured heights and
// scroll correction stays minimal.
const BODY_LINE_HEIGHT = 25;
const MONO_LINE_HEIGHT = 20;
const APPROX_BODY_CHAR_WIDTH = 7.9;
const APPROX_MONO_CHAR_WIDTH = 7.8;
export const MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION =
  "greenfield-layout-rich-blocks-v4";
const LAYOUT_CACHE_LIMIT = 64;

const markdownGreenfieldLayoutDocumentIds = new WeakMap<
  MarkdownGreenfieldDocument,
  number
>();
const markdownGreenfieldLayoutCache = new Map<
  string,
  {
    document: MarkdownGreenfieldDocument;
    frame: MarkdownGreenfieldFrame;
  }
>();
let nextMarkdownGreenfieldLayoutDocumentId = 1;

export type MarkdownGreenfieldFrame = {
  chunks: MarkdownGreenfieldChunkFrame[];
  totalHeight: number;
  width: number;
};

export type MarkdownGreenfieldChunkFrame = {
  bottom: number;
  height: number;
  id: string;
  index: number;
  measuredHeight: number | null;
  sourceEndLine: number;
  sourceStartLine: number;
  top: number;
};

export type MarkdownGreenfieldMeasuredHeights = {
  cacheKey?: string;
  get(
    chunk: MarkdownGreenfieldChunk,
    context: MarkdownGreenfieldMeasurementContext,
  ): number | undefined;
};

export type MarkdownGreenfieldMeasurementContext = {
  fontScale: number;
  policyVersion: string;
  width: number;
};

export function layoutMarkdownGreenfieldDocument({
  contentWidth,
  document,
  fontScale,
  measuredHeights,
}: {
  contentWidth: number;
  document: MarkdownGreenfieldDocument;
  fontScale: number;
  measuredHeights?: MarkdownGreenfieldMeasuredHeights;
}): MarkdownGreenfieldFrame {
  const width = Math.max(1, contentWidth);
  const context = {
    fontScale,
    policyVersion: MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
    width,
  };
  const measuredHeightByChunkId = readMarkdownGreenfieldMeasuredHeights({
    context,
    document,
    measuredHeights,
  });
  const cacheKey = markdownGreenfieldLayoutCacheKey({
    context,
    document,
    measuredHeightByChunkId,
    measuredHeightsCacheKey: measuredHeights?.cacheKey,
  });
  const cached = markdownGreenfieldLayoutCache.get(cacheKey);
  if (cached?.document === document) {
    markdownGreenfieldLayoutCache.delete(cacheKey);
    markdownGreenfieldLayoutCache.set(cacheKey, cached);
    return cached.frame;
  }

  const blocksById = new Map(document.blocks.map((block) => [block.id, block]));
  const chunks: MarkdownGreenfieldChunkFrame[] = [];
  let y = DOCUMENT_PADDING_Y;

  for (const chunk of document.chunks) {
    const estimatedHeight = estimateMarkdownGreenfieldChunkHeight({
      blocks: chunk.blockIds
        .map((blockId) => blocksById.get(blockId))
        .filter((block): block is MarkdownGreenfieldBlock => Boolean(block)),
      fontScale,
      width,
    });
    const measuredHeight = measuredHeightByChunkId.get(chunk.id) ?? null;
    const height = Math.max(
      MIN_CHUNK_HEIGHT,
      measuredHeight == null ? estimatedHeight : measuredHeight,
    );
    chunks.push({
      bottom: y + height,
      height,
      id: chunk.id,
      index: chunk.index,
      measuredHeight,
      sourceEndLine: chunk.sourceEndLine,
      sourceStartLine: chunk.sourceStartLine,
      top: y,
    });
    y += height;
  }

  const frame = freezeMarkdownGreenfieldFrame({
    chunks,
    totalHeight: chunks.length ? y + DOCUMENT_PADDING_Y : 0,
    width,
  });
  markdownGreenfieldLayoutCache.set(cacheKey, { document, frame });
  while (markdownGreenfieldLayoutCache.size > LAYOUT_CACHE_LIMIT) {
    const oldestKey = markdownGreenfieldLayoutCache.keys().next().value;
    if (!oldestKey) break;
    markdownGreenfieldLayoutCache.delete(oldestKey);
  }
  return frame;
}

function estimateMarkdownGreenfieldChunkHeight({
  blocks,
  fontScale,
  width,
}: {
  blocks: readonly MarkdownGreenfieldBlock[];
  fontScale: number;
  width: number;
}) {
  const textWidth = Math.max(1, width - CHUNK_PADDING_X * 2);
  const height = blocks.reduce(
    (sum, block) =>
      sum +
      estimateMarkdownGreenfieldBlockHeight({
        block,
        fontScale,
        textWidth,
      }),
    0,
  );
  return Math.max(MIN_CHUNK_HEIGHT, height);
}

function estimateMarkdownGreenfieldBlockHeight({
  block,
  fontScale,
  textWidth,
}: {
  block: MarkdownGreenfieldBlock;
  fontScale: number;
  textWidth: number;
}) {
  if (block.kind === "thematicBreak") return 36 * fontScale;
  if (block.kind === "frontmatter") {
    const lines = Math.max(1, block.sourceLineCount);
    return (72 + lines * MONO_LINE_HEIGHT) * fontScale;
  }
  if (block.kind === "footnotes")
    return estimateTextBlock(block, textWidth, fontScale, 0.9);
  if (block.kind === "heading") {
    return estimateTextBlock(block, textWidth, fontScale, 1.3) + 18 * fontScale;
  }
  if (block.kind === "diagram") return 360 * fontScale;
  if (block.kind === "math") return 120 * fontScale;
  if (block.kind === "component") return 160 * fontScale;
  if (block.kind === "code") {
    const lines = Math.max(1, block.sourceLineCount);
    return 48 * fontScale + lines * MONO_LINE_HEIGHT * fontScale;
  }
  if (block.kind === "table") {
    const rows = Math.max(2, block.sourceLineCount);
    return (48 + rows * 36) * fontScale;
  }
  if (block.kind === "image") return 280 * fontScale;
  if (block.isHostile) return 420 * fontScale;
  return estimateTextBlock(block, textWidth, fontScale, 1);
}

function estimateTextBlock(
  block: MarkdownGreenfieldBlock,
  textWidth: number,
  fontScale: number,
  multiplier: number,
) {
  const charWidth =
    block.kind === "code" ? APPROX_MONO_CHAR_WIDTH : APPROX_BODY_CHAR_WIDTH;
  const columns = Math.max(12, Math.floor(textWidth / (charWidth * fontScale)));
  const visualLines = block.sourceLineLengths.reduce(
    (sum, lineLength) => sum + Math.max(1, Math.ceil(lineLength / columns)),
    0,
  );
  return (
    16 * fontScale + visualLines * BODY_LINE_HEIGHT * fontScale * multiplier
  );
}

function readMarkdownGreenfieldMeasuredHeights({
  context,
  document,
  measuredHeights,
}: {
  context: MarkdownGreenfieldMeasurementContext;
  document: MarkdownGreenfieldDocument;
  measuredHeights?: MarkdownGreenfieldMeasuredHeights;
}) {
  const measuredHeightByChunkId = new Map<string, number>();
  if (!measuredHeights) return measuredHeightByChunkId;

  for (const chunk of document.chunks) {
    const measuredHeight = measuredHeights.get(chunk, context);
    if (
      typeof measuredHeight === "number" &&
      Number.isFinite(measuredHeight) &&
      measuredHeight > 0
    ) {
      measuredHeightByChunkId.set(chunk.id, measuredHeight);
    }
  }
  return measuredHeightByChunkId;
}

function markdownGreenfieldLayoutCacheKey({
  context,
  document,
  measuredHeightByChunkId,
  measuredHeightsCacheKey,
}: {
  context: MarkdownGreenfieldMeasurementContext;
  document: MarkdownGreenfieldDocument;
  measuredHeightByChunkId: ReadonlyMap<string, number>;
  measuredHeightsCacheKey?: string;
}) {
  return [
    markdownGreenfieldLayoutDocumentId(document),
    Math.round(context.width * 100) / 100,
    context.fontScale.toFixed(4),
    context.policyVersion,
    measuredHeightsCacheKey ??
      measuredHeightsDetailedCacheKey(measuredHeightByChunkId),
  ].join(":");
}

function measuredHeightsDetailedCacheKey(
  measuredHeightByChunkId: ReadonlyMap<string, number>,
) {
  return Array.from(measuredHeightByChunkId)
    .map(
      ([chunkId, measuredHeight]) => `${chunkId}:${measuredHeight.toFixed(2)}`,
    )
    .join("|");
}

function markdownGreenfieldLayoutDocumentId(
  document: MarkdownGreenfieldDocument,
) {
  const existing = markdownGreenfieldLayoutDocumentIds.get(document);
  if (existing) return existing;
  const next = nextMarkdownGreenfieldLayoutDocumentId++;
  markdownGreenfieldLayoutDocumentIds.set(document, next);
  return next;
}

function freezeMarkdownGreenfieldFrame(frame: MarkdownGreenfieldFrame) {
  for (const chunk of frame.chunks) Object.freeze(chunk);
  Object.freeze(frame.chunks);
  return Object.freeze(frame);
}
