"use client"

import {
  materializeLineRange,
  measureLineStats,
  measureNaturalWidth,
  prepareWithSegments,
  walkLineRanges,
  type LayoutLine,
  type PreparedTextWithSegments,
} from "@chenglou/pretext"
import {
  materializeRichInlineLineRange,
  measureRichInlineStats,
  prepareRichInline,
  walkRichInlineLineRanges,
  type PreparedRichInline,
  type RichInlineLine,
} from "@chenglou/pretext/rich-inline"
import { marked, type Token, type Tokens } from "marked"

import { splitTextLines } from "./text-viewer-resource"

export type TextViewerMode = "markdown" | "text"

export interface TextStyleConfig {
  fontScale: number
}

export interface PreparedTextDocument {
  blocks: PreparedTextBlock[]
  mode: TextViewerMode
  sourceLineCount: number
  wordCount: number
}

export type PreparedTextBlock =
  | PreparedInlineTextBlock
  | PreparedCodeTextBlock
  | PreparedRuleTextBlock

export interface PreparedTextBlockBase {
  contentLeft: number
  marginTop: number
  markerClassName: string | null
  markerLeft: number | null
  markerText: string | null
  quoteRailLefts: number[]
  sourceEndLine: number
  sourceStartLine: number
}

export interface PreparedInlineTextBlock extends PreparedTextBlockBase {
  classNames: string[]
  fallbackText: string
  flow: PreparedRichInline | null
  hrefs: Array<string | null>
  kind: "inline"
  lineHeight: number
  variant: InlineVariant
}

export interface PreparedCodeTextBlock extends PreparedTextBlockBase {
  fallbackText: string
  kind: "code"
  lineHeight: number
  prepared: PreparedTextWithSegments | null
}

export interface PreparedRuleTextBlock extends PreparedTextBlockBase {
  height: number
  kind: "rule"
}

export interface TextDocumentFrame {
  frames: TextBlockFrame[]
  totalHeight: number
  width: number
}

export type TextBlockFrame =
  | InlineTextBlockFrame
  | CodeTextBlockFrame
  | RuleTextBlockFrame

interface TextBlockFrameBase {
  blockIndex: number
  bottom: number
  contentLeft: number
  height: number
  markerClassName: string | null
  markerLeft: number | null
  markerText: string | null
  quoteRailLefts: number[]
  sourceEndLine: number
  sourceStartLine: number
  top: number
}

export interface InlineTextBlockFrame extends TextBlockFrameBase {
  kind: "inline"
  lineCount: number
  lineHeight: number
  usedWidth: number
}

export interface CodeTextBlockFrame extends TextBlockFrameBase {
  kind: "code"
  lineCount: number
  lineHeight: number
  width: number
}

export interface RuleTextBlockFrame extends TextBlockFrameBase {
  kind: "rule"
  width: number
}

export interface InlineFragmentLayout {
  className: string
  href: string | null
  leadingGap: number
  text: string
}

export interface InlineLineLayout {
  fragments: InlineFragmentLayout[]
  top: number
  width: number
}

export interface CodeLineLayout {
  line: LayoutLine
  top: number
}

type InlineVariant = "body" | "heading-1" | "heading-2"

type MarkState = {
  bold: boolean
  italic: boolean
  strike: boolean
  href: string | null
}

type ParseContext = {
  listDepth: number
  quoteDepth: number
}

type InlinePiece = {
  breakMode: "never" | "normal"
  className: string
  extraWidth: number
  font: string
  href: string | null
  text: string
}

const BODY_FONT_PX = 15
const BODY_LINE_PX = 24
const HEADING_ONE_FONT_PX = 22
const HEADING_ONE_LINE_PX = 32
const HEADING_TWO_FONT_PX = 18
const HEADING_TWO_LINE_PX = 28
const CODE_FONT_PX = 13
const CODE_LINE_PX = 20
const MARKER_FONT_PX = 12
const CHIP_FONT_PX = 12
const INLINE_CODE_EXTRA_WIDTH = 12
const IMAGE_EXTRA_WIDTH = 14
const CODE_BLOCK_PADDING_X = 12
const CODE_BLOCK_PADDING_Y = 10
const DOCUMENT_PADDING_Y = 16
const BLOCK_GAP = 12
const RICH_BLOCK_GAP = 6
const HARD_BREAK_GAP = 4
const LIST_ITEM_GAP = 4
const LIST_MARKER_GAP = 10
const LIST_NESTING_INDENT = 20
const BLOCKQUOTE_INDENT = 18
const RAIL_OFFSET = 5
const RULE_HEIGHT = 20
const SANS_FAMILY = "Arial, Helvetica, sans-serif"
const SERIF_FAMILY = "Georgia, Times New Roman, serif"
const MONO_FAMILY = '"SF Mono", Menlo, Monaco, Consolas, monospace'
const EMPTY_MARK_STATE: MarkState = {
  bold: false,
  href: null,
  italic: false,
  strike: false,
}
const markerWidthCache = new Map<string, number>()

export function resolveTextViewerMode({
  fileName,
  mimeType,
}: {
  fileName: string
  mimeType?: string
}): TextViewerMode {
  const lowerName = fileName.toLowerCase()
  const lowerMime = mimeType?.toLowerCase().split(";")[0].trim()
  return lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    lowerName.endsWith(".mdx") ||
    lowerMime === "text/markdown"
    ? "markdown"
    : "text"
}

export function createPreparedTextDocument({
  mode,
  text,
  style,
}: {
  mode: TextViewerMode
  text: string
  style: TextStyleConfig
}): PreparedTextDocument {
  const sourceLineCount = splitTextLines(text).length
  const blocks =
    mode === "markdown"
      ? parseMarkdownBlocks(text, style)
      : buildPlainTextBlocks(text, style)

  return {
    blocks,
    mode,
    sourceLineCount,
    wordCount: countTextWords(text),
  }
}

export function layoutTextDocument({
  contentWidth,
  document,
}: {
  contentWidth: number
  document: PreparedTextDocument
}): TextDocumentFrame {
  const safeContentWidth = safeWidth(contentWidth)
  const frames: TextBlockFrame[] = []
  let y = DOCUMENT_PADDING_Y

  for (let index = 0; index < document.blocks.length; index++) {
    const block = document.blocks[index]!
    y += block.marginTop
    const frame = layoutTextBlock({
      block,
      blockIndex: index,
      contentWidth: safeContentWidth,
      top: y,
    })
    frames.push(frame)
    y = frame.bottom
  }

  return {
    frames,
    totalHeight: y + DOCUMENT_PADDING_Y,
    width: safeContentWidth,
  }
}

export function materializeInlineVisibleLines({
  block,
  frame,
  maxWidth,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedInlineTextBlock
  frame: InlineTextBlockFrame
  maxWidth: number
  viewportBottom: number
  viewportTop: number
}): InlineLineLayout[] {
  const firstLine = Math.max(
    0,
    Math.floor((viewportTop - frame.top) / frame.lineHeight) - 1
  )
  const lastLine = Math.min(
    frame.lineCount - 1,
    Math.ceil((viewportBottom - frame.top) / frame.lineHeight) + 1
  )
  if (lastLine < firstLine) return []

  if (!block.flow) {
    return [
      {
        fragments: [
          {
            className: inlineClassName(block.variant, EMPTY_MARK_STATE),
            href: null,
            leadingGap: 0,
            text: block.fallbackText || " ",
          },
        ],
        top: 0,
        width: frame.usedWidth,
      },
    ]
  }

  const lines: InlineLineLayout[] = []
  const lineWidth = safeWidth(maxWidth - frame.contentLeft)
  let lineIndex = 0
  walkRichInlineLineRanges(block.flow, lineWidth, (range) => {
    if (lineIndex >= firstLine && lineIndex <= lastLine) {
      const line = materializeRichInlineLineRange(block.flow!, range)
      lines.push({
        fragments: richInlineFragments(block, line),
        top: lineIndex * frame.lineHeight,
        width: line.width,
      })
    }
    lineIndex++
  })
  return lines
}

export function materializeCodeVisibleLines({
  block,
  frame,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedCodeTextBlock
  frame: CodeTextBlockFrame
  viewportBottom: number
  viewportTop: number
}): CodeLineLayout[] {
  const firstLine = Math.max(
    0,
    Math.floor(
      (viewportTop - frame.top - CODE_BLOCK_PADDING_Y) / frame.lineHeight
    ) - 1
  )
  const lastLine = Math.min(
    frame.lineCount - 1,
    Math.ceil(
      (viewportBottom - frame.top - CODE_BLOCK_PADDING_Y) / frame.lineHeight
    ) + 1
  )
  if (lastLine < firstLine) return []

  if (!block.prepared) {
    return [
      {
        line: {
          end: { graphemeIndex: 0, segmentIndex: 0 },
          start: { graphemeIndex: 0, segmentIndex: 0 },
          text: block.fallbackText,
          width: frame.width,
        },
        top: CODE_BLOCK_PADDING_Y,
      },
    ]
  }

  const lines: CodeLineLayout[] = []
  let lineIndex = 0
  walkLineRanges(
    block.prepared,
    safeWidth(frame.width - CODE_BLOCK_PADDING_X * 2),
    (range) => {
      if (lineIndex >= firstLine && lineIndex <= lastLine) {
        lines.push({
          line: materializeLineRange(block.prepared!, range),
          top: CODE_BLOCK_PADDING_Y + lineIndex * frame.lineHeight,
        })
      }
      lineIndex++
    }
  )
  return lines
}

export function textFrameIntersectsLineRange({
  frame,
  range,
}: {
  frame: TextBlockFrame
  range: { end: number; start: number } | null
}) {
  return (
    range != null &&
    frame.sourceStartLine <= range.end &&
    frame.sourceEndLine >= range.start
  )
}

function parseMarkdownBlocks(
  markdown: string,
  style: TextStyleConfig
): PreparedTextBlock[] {
  return parseBlockTokens(marked.lexer(markdown, { gfm: true }), {
    ctx: { listDepth: 0, quoteDepth: 0 },
    sourceEndLine: splitTextLines(markdown).length,
    sourceStartLine: 1,
    style,
  })
}

function parseBlockTokens(
  tokens: readonly Token[],
  {
    ctx,
    sourceEndLine,
    sourceStartLine,
    style,
  }: {
    ctx: ParseContext
    sourceEndLine: number
    sourceStartLine: number
    style: TextStyleConfig
  }
): PreparedTextBlock[] {
  const blocks: PreparedTextBlock[] = []
  let cursorLine = sourceStartLine

  for (const token of tokens) {
    const tokenLineCount = Math.max(1, splitTextLines(token.raw ?? "").length)
    const tokenStartLine = cursorLine
    const tokenEndLine = Math.min(
      sourceEndLine,
      cursorLine + tokenLineCount - 1
    )
    cursorLine = tokenEndLine + 1

    switch (token.type) {
      case "space":
      case "def":
        continue

      case "paragraph":
        appendBlockGroup(
          blocks,
          buildInlineBlocks({
            ctx,
            lines: collectInlinePieceLines(token.tokens ?? [], "body", style),
            sourceEndLine: tokenEndLine,
            sourceStartLine: tokenStartLine,
            style,
            variant: "body",
          }),
          BLOCK_GAP
        )
        continue

      case "heading": {
        const variant = headingVariant(token.depth)
        appendBlockGroup(
          blocks,
          buildInlineBlocks({
            ctx,
            lines: collectInlinePieceLines(token.tokens ?? [], variant, style),
            sourceEndLine: tokenEndLine,
            sourceStartLine: tokenStartLine,
            style,
            variant,
          }),
          BLOCK_GAP + 4
        )
        continue
      }

      case "code":
        appendBlockGroup(
          blocks,
          [
            buildCodeBlock({
              ctx,
              sourceEndLine: tokenEndLine,
              sourceStartLine: tokenStartLine,
              style,
              text: token.text,
            }),
          ],
          RICH_BLOCK_GAP
        )
        continue

      case "list":
        appendBlockGroup(
          blocks,
          buildListBlocks({
            ctx,
            sourceEndLine: tokenEndLine,
            sourceStartLine: tokenStartLine,
            style,
            token: token as Tokens.List,
          }),
          BLOCK_GAP
        )
        continue

      case "blockquote":
        appendBlockGroup(
          blocks,
          parseBlockTokens(token.tokens ?? [], {
            ctx: {
              listDepth: ctx.listDepth,
              quoteDepth: ctx.quoteDepth + 1,
            },
            sourceEndLine: tokenEndLine,
            sourceStartLine: tokenStartLine,
            style,
          }),
          RICH_BLOCK_GAP
        )
        continue

      case "hr":
        appendBlockGroup(
          blocks,
          [
            buildRuleBlock({
              ctx,
              sourceEndLine: tokenEndLine,
              sourceStartLine: tokenStartLine,
            }),
          ],
          BLOCK_GAP + 2
        )
        continue

      case "table":
        appendBlockGroup(
          blocks,
          [
            buildCodeBlock({
              ctx,
              sourceEndLine: tokenEndLine,
              sourceStartLine: tokenStartLine,
              style,
              text: formatTable(token as Tokens.Table),
            }),
          ],
          RICH_BLOCK_GAP
        )
        continue

      case "html": {
        const htmlText = token.text.trim().length > 0 ? token.text : token.raw
        if (token.block || ("pre" in token && token.pre === true)) {
          appendBlockGroup(
            blocks,
            [
              buildCodeBlock({
                ctx,
                sourceEndLine: tokenEndLine,
                sourceStartLine: tokenStartLine,
                style,
                text: htmlText,
              }),
            ],
            RICH_BLOCK_GAP
          )
        } else {
          appendPlainTextFallback({
            blocks,
            ctx,
            sourceEndLine: tokenEndLine,
            sourceStartLine: tokenStartLine,
            style,
            text: htmlText,
          })
        }
        continue
      }

      case "text":
        if (Array.isArray(token.tokens) && token.tokens.length > 0) {
          appendBlockGroup(
            blocks,
            buildInlineBlocks({
              ctx,
              lines: collectInlinePieceLines(token.tokens, "body", style),
              sourceEndLine: tokenEndLine,
              sourceStartLine: tokenStartLine,
              style,
              variant: "body",
            }),
            BLOCK_GAP
          )
        } else {
          appendPlainTextFallback({
            blocks,
            ctx,
            sourceEndLine: tokenEndLine,
            sourceStartLine: tokenStartLine,
            style,
            text: token.text,
          })
        }
        continue

      default: {
        const fallbackText = fallbackTextForToken(token)
        if (fallbackText) {
          appendPlainTextFallback({
            blocks,
            ctx,
            sourceEndLine: tokenEndLine,
            sourceStartLine: tokenStartLine,
            style,
            text: fallbackText,
          })
        }
      }
    }
  }

  return blocks
}

function buildPlainTextBlocks(
  text: string,
  style: TextStyleConfig
): PreparedTextBlock[] {
  const lines = splitTextLines(text)
  return lines.map((line, index) =>
    buildInlineBlock({
      ctx: { listDepth: 0, quoteDepth: 0 },
      pieces: [createTextPiece(line || " ", EMPTY_MARK_STATE, "body", style)!],
      sourceEndLine: index + 1,
      sourceStartLine: index + 1,
      style,
      variant: "body",
    })
  )
}

function appendPlainTextFallback({
  blocks,
  ctx,
  sourceEndLine,
  sourceStartLine,
  style,
  text,
}: {
  blocks: PreparedTextBlock[]
  ctx: ParseContext
  sourceEndLine: number
  sourceStartLine: number
  style: TextStyleConfig
  text: string
}) {
  appendBlockGroup(
    blocks,
    buildInlineBlocks({
      ctx,
      lines: [
        [createTextPiece(text, EMPTY_MARK_STATE, "body", style)].filter(
          Boolean
        ) as InlinePiece[],
      ],
      sourceEndLine,
      sourceStartLine,
      style,
      variant: "body",
    }),
    BLOCK_GAP
  )
}

function buildListBlocks({
  ctx,
  sourceEndLine,
  sourceStartLine,
  style,
  token,
}: {
  ctx: ParseContext
  sourceEndLine: number
  sourceStartLine: number
  style: TextStyleConfig
  token: Tokens.List
}): PreparedTextBlock[] {
  const blocks: PreparedTextBlock[] = []
  const itemCtx = {
    listDepth: ctx.listDepth + 1,
    quoteDepth: ctx.quoteDepth,
  }

  for (let index = 0; index < token.items.length; index++) {
    const item = token.items[index]!
    let itemBlocks = parseBlockTokens(item.tokens, {
      ctx: itemCtx,
      sourceEndLine,
      sourceStartLine,
      style,
    })
    if (itemBlocks.length === 0) {
      itemBlocks = buildInlineBlocks({
        ctx: itemCtx,
        lines: [
          [createTextPiece(item.text, EMPTY_MARK_STATE, "body", style)].filter(
            Boolean
          ) as InlinePiece[],
        ],
        sourceEndLine,
        sourceStartLine,
        style,
        variant: "body",
      })
    }

    decorateListItemBlocks(
      itemBlocks,
      resolveListMarkerText(token, item, index),
      resolveListMarkerClassName(token, item),
      style
    )
    appendBlockGroup(blocks, itemBlocks, LIST_ITEM_GAP)
  }

  return blocks
}

function decorateListItemBlocks(
  blocks: PreparedTextBlock[],
  markerText: string,
  markerClassName: string,
  style: TextStyleConfig
) {
  if (blocks.length === 0) return

  const markerArea = measureMarkerWidth(markerText, style) + LIST_MARKER_GAP
  for (let index = 0; index < blocks.length; index++) {
    blocks[index] = shiftBlock(blocks[index]!, markerArea)
  }

  const firstBlock = blocks[0]!
  blocks[0] = {
    ...firstBlock,
    markerClassName,
    markerLeft: firstBlock.contentLeft - markerArea,
    markerText,
  } satisfies PreparedTextBlock
}

function buildInlineBlocks({
  ctx,
  lines,
  sourceEndLine,
  sourceStartLine,
  style,
  variant,
}: {
  ctx: ParseContext
  lines: InlinePiece[][]
  sourceEndLine: number
  sourceStartLine: number
  style: TextStyleConfig
  variant: InlineVariant
}) {
  const blocks: PreparedTextBlock[] = []
  for (const pieces of lines) {
    if (pieces.length === 0) continue
    blocks.push({
      ...buildInlineBlock({
        ctx,
        pieces,
        sourceEndLine,
        sourceStartLine,
        style,
        variant,
      }),
      marginTop: blocks.length === 0 ? 0 : HARD_BREAK_GAP,
    })
  }
  return blocks
}

function buildInlineBlock({
  ctx,
  pieces,
  sourceEndLine,
  sourceStartLine,
  style,
  variant,
}: {
  ctx: ParseContext
  pieces: InlinePiece[]
  sourceEndLine: number
  sourceStartLine: number
  style: TextStyleConfig
  variant: InlineVariant
}): PreparedInlineTextBlock {
  return {
    ...createBlockBase(ctx, sourceStartLine, sourceEndLine),
    classNames: pieces.map((piece) => piece.className),
    fallbackText: pieces.map((piece) => piece.text).join(""),
    flow: prepareRichInlineSafe(pieces),
    hrefs: pieces.map((piece) => piece.href),
    kind: "inline",
    lineHeight: lineHeightForVariant(variant, style),
    variant,
  }
}

function buildCodeBlock({
  ctx,
  sourceEndLine,
  sourceStartLine,
  style,
  text,
}: {
  ctx: ParseContext
  sourceEndLine: number
  sourceStartLine: number
  style: TextStyleConfig
  text: string
}): PreparedCodeTextBlock {
  const code = stripSingleTrailingNewline(text)
  return {
    ...createBlockBase(ctx, sourceStartLine, sourceEndLine),
    fallbackText: code,
    kind: "code",
    lineHeight: CODE_LINE_PX * style.fontScale,
    prepared: prepareWithSegmentsSafe(
      code || " ",
      `500 ${CODE_FONT_PX * style.fontScale}px ${MONO_FAMILY}`,
      {
        whiteSpace: "pre-wrap",
      }
    ),
  }
}

function buildRuleBlock({
  ctx,
  sourceEndLine,
  sourceStartLine,
}: {
  ctx: ParseContext
  sourceEndLine: number
  sourceStartLine: number
}): PreparedRuleTextBlock {
  return {
    ...createBlockBase(ctx, sourceStartLine, sourceEndLine),
    height: RULE_HEIGHT,
    kind: "rule",
  }
}

function createBlockBase(
  ctx: ParseContext,
  sourceStartLine: number,
  sourceEndLine: number
): PreparedTextBlockBase {
  const listIndent = Math.max(0, ctx.listDepth - 1) * LIST_NESTING_INDENT
  const contentLeft = listIndent + ctx.quoteDepth * BLOCKQUOTE_INDENT
  const quoteRailLefts = Array.from({ length: ctx.quoteDepth }, (_, depth) => {
    return listIndent + depth * BLOCKQUOTE_INDENT + RAIL_OFFSET
  })

  return {
    contentLeft,
    marginTop: 0,
    markerClassName: null,
    markerLeft: null,
    markerText: null,
    quoteRailLefts,
    sourceEndLine,
    sourceStartLine,
  }
}

function collectInlinePieceLines(
  tokens: readonly Token[],
  variant: InlineVariant,
  style: TextStyleConfig
): InlinePiece[][] {
  const lines: InlinePiece[][] = [[]]

  function currentLine() {
    return lines[lines.length - 1]!
  }

  function pushLineBreak() {
    lines.push([])
  }

  function pushPiece(piece: InlinePiece | null) {
    if (!piece) return
    const line = currentLine()
    const previous = line[line.length - 1]
    if (previous && canMergeInlinePieces(previous, piece)) {
      previous.text += piece.text
      return
    }
    line.push(piece)
  }

  function walk(tokenList: readonly Token[], marks: MarkState) {
    for (const token of tokenList) {
      switch (token.type) {
        case "text":
          if (Array.isArray(token.tokens) && token.tokens.length > 0) {
            walk(token.tokens, marks)
          } else {
            pushPiece(createTextPiece(token.text, marks, variant, style))
          }
          continue
        case "escape":
          pushPiece(createTextPiece(token.text, marks, variant, style))
          continue
        case "strong":
          walk(token.tokens ?? [], { ...marks, bold: true })
          continue
        case "em":
          walk(token.tokens ?? [], { ...marks, italic: true })
          continue
        case "del":
          walk(token.tokens ?? [], { ...marks, strike: true })
          continue
        case "codespan":
          pushPiece(createCodePiece(token.text, style))
          continue
        case "link":
          walk(token.tokens ?? [], {
            ...marks,
            href: parseMarkdownHref(token.href),
          })
          continue
        case "image":
          pushPiece(createImagePiece(token.text || token.href, style))
          continue
        case "br":
          pushLineBreak()
          continue
        case "checkbox":
          pushPiece(
            createTextPiece(
              token.checked ? "[x] " : "[ ] ",
              marks,
              variant,
              style
            )
          )
          continue
        case "html":
          pushPiece(createTextPiece(token.text, marks, variant, style))
          continue
        default: {
          const fallback = fallbackTextForToken(token)
          if (fallback) {
            pushPiece(createTextPiece(fallback, marks, variant, style))
          }
        }
      }
    }
  }

  walk(tokens, EMPTY_MARK_STATE)
  while (lines.length > 0 && lines[lines.length - 1]!.length === 0) {
    lines.pop()
  }
  return lines
}

function createTextPiece(
  text: string,
  marks: MarkState,
  variant: InlineVariant,
  style: TextStyleConfig
): InlinePiece | null {
  if (!text) return null
  return {
    breakMode: "normal",
    className: inlineClassName(variant, marks),
    extraWidth: 0,
    font: inlineFont(variant, marks, style),
    href: marks.href,
    text,
  }
}

function createCodePiece(
  text: string,
  style: TextStyleConfig
): InlinePiece | null {
  if (!text) return null
  return {
    breakMode: "normal",
    className: "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]",
    extraWidth: INLINE_CODE_EXTRA_WIDTH,
    font: `600 ${CODE_FONT_PX * style.fontScale}px ${MONO_FAMILY}`,
    href: null,
    text,
  }
}

function createImagePiece(text: string, style: TextStyleConfig): InlinePiece {
  return {
    breakMode: "never",
    className:
      "inline-flex min-h-5 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground",
    extraWidth: IMAGE_EXTRA_WIDTH,
    font: `600 ${CHIP_FONT_PX * style.fontScale}px ${SANS_FAMILY}`,
    href: null,
    text: text || "image",
  }
}

function layoutTextBlock({
  block,
  blockIndex,
  contentWidth,
  top,
}: {
  block: PreparedTextBlock
  blockIndex: number
  contentWidth: number
  top: number
}): TextBlockFrame {
  switch (block.kind) {
    case "inline": {
      const lineWidth = safeWidth(contentWidth - block.contentLeft)
      const stats = block.flow
        ? measureRichInlineStatsSafe(block.flow, lineWidth, block.fallbackText)
        : estimateInlineStats(block.fallbackText, lineWidth)
      const lineCount = Math.max(1, stats.lineCount)
      const height = lineCount * block.lineHeight
      return {
        ...frameBase(block, blockIndex, top, height),
        kind: "inline",
        lineCount,
        lineHeight: block.lineHeight,
        usedWidth: stats.maxLineWidth,
      }
    }

    case "code": {
      const boxWidth = safeWidth(contentWidth - block.contentLeft)
      const innerWidth = safeWidth(boxWidth - CODE_BLOCK_PADDING_X * 2)
      const stats = block.prepared
        ? measureLineStatsSafe(block.prepared, innerWidth, block.fallbackText)
        : estimateInlineStats(block.fallbackText, innerWidth)
      const lineCount = Math.max(1, stats.lineCount)
      const width = Math.min(
        boxWidth,
        Math.max(1, stats.maxLineWidth + CODE_BLOCK_PADDING_X * 2)
      )
      const height = lineCount * block.lineHeight + CODE_BLOCK_PADDING_Y * 2
      return {
        ...frameBase(block, blockIndex, top, height),
        kind: "code",
        lineCount,
        lineHeight: block.lineHeight,
        width,
      }
    }

    case "rule": {
      return {
        ...frameBase(block, blockIndex, top, block.height),
        kind: "rule",
        width: safeWidth(contentWidth - block.contentLeft),
      }
    }
  }
}

function frameBase(
  block: PreparedTextBlock,
  blockIndex: number,
  top: number,
  height: number
): TextBlockFrameBase {
  return {
    blockIndex,
    bottom: top + height,
    contentLeft: block.contentLeft,
    height,
    markerClassName: block.markerClassName,
    markerLeft: block.markerLeft,
    markerText: block.markerText,
    quoteRailLefts: block.quoteRailLefts,
    sourceEndLine: block.sourceEndLine,
    sourceStartLine: block.sourceStartLine,
    top,
  }
}

function richInlineFragments(
  block: PreparedInlineTextBlock,
  line: RichInlineLine
): InlineFragmentLayout[] {
  return line.fragments.map((fragment) => ({
    className: block.classNames[fragment.itemIndex] ?? "",
    href: block.hrefs[fragment.itemIndex] ?? null,
    leadingGap: fragment.gapBefore,
    text: fragment.text,
  }))
}

function prepareRichInlineSafe(pieces: InlinePiece[]) {
  try {
    return prepareRichInline(
      pieces.map((piece) => ({
        break: piece.breakMode,
        extraWidth: piece.extraWidth,
        font: piece.font,
        text: piece.text,
      }))
    )
  } catch {
    return null
  }
}

function prepareWithSegmentsSafe(
  text: string,
  font: string,
  options?: Parameters<typeof prepareWithSegments>[2]
) {
  try {
    return prepareWithSegments(text, font, options)
  } catch {
    return null
  }
}

function measureRichInlineStatsSafe(
  flow: PreparedRichInline,
  width: number,
  fallbackText: string
) {
  try {
    return measureRichInlineStats(flow, width)
  } catch {
    return estimateInlineStats(fallbackText, width)
  }
}

function measureLineStatsSafe(
  prepared: PreparedTextWithSegments,
  width: number,
  fallbackText: string
) {
  try {
    return measureLineStats(prepared, width)
  } catch {
    return estimateInlineStats(fallbackText, width)
  }
}

function estimateInlineStats(text: string, width: number) {
  const columns = Math.max(1, Math.floor(width / 8))
  const lines = splitTextLines(text || " ")
  const lineCount = lines.reduce(
    (sum, line) => sum + Math.max(1, Math.ceil((line || " ").length / columns)),
    0
  )
  const maxLineWidth = Math.min(
    width,
    Math.max(...lines.map((line) => (line || " ").length * 8), 1)
  )
  return { lineCount, maxLineWidth }
}

function measureMarkerWidth(text: string, style: TextStyleConfig) {
  const font = `600 ${MARKER_FONT_PX * style.fontScale}px ${MONO_FAMILY}`
  const cacheKey = `${font}\u0000${text}`
  const cached = markerWidthCache.get(cacheKey)
  if (cached != null) return cached

  let width = Math.max(8, text.length * MARKER_FONT_PX * style.fontScale)
  const prepared = prepareWithSegmentsSafe(text, font)
  if (prepared) {
    try {
      width = measureNaturalWidth(prepared)
    } catch {
      // keep estimate
    }
  }
  markerWidthCache.set(cacheKey, width)
  return width
}

function appendBlockGroup(
  target: PreparedTextBlock[],
  group: PreparedTextBlock[],
  firstMargin: number
) {
  if (group.length === 0) return

  for (let index = 0; index < group.length; index++) {
    const block = group[index]!
    target.push({
      ...block,
      marginTop:
        index === 0 ? (target.length === 0 ? 0 : firstMargin) : block.marginTop,
    } satisfies PreparedTextBlock)
  }
}

function shiftBlock(
  block: PreparedTextBlock,
  delta: number
): PreparedTextBlock {
  return {
    ...block,
    contentLeft: block.contentLeft + delta,
  } satisfies PreparedTextBlock
}

function resolveListMarkerText(
  list: Tokens.List,
  item: Tokens.ListItem,
  index: number
) {
  if (item.task) return item.checked ? "☑" : "☐"
  if (list.ordered) {
    const start = typeof list.start === "number" ? list.start : 1
    return `${start + index}.`
  }
  return "•"
}

function resolveListMarkerClassName(list: Tokens.List, item: Tokens.ListItem) {
  if (item.task) return "text-muted-foreground"
  return list.ordered ? "text-muted-foreground" : "text-muted-foreground"
}

function parseMarkdownHref(href: string | null | undefined) {
  if (!href) return null
  try {
    const url = new URL(href)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null
  } catch {
    return null
  }
}

function fallbackTextForToken(token: Token) {
  if ("text" in token && typeof token.text === "string") return token.text
  return token.raw ?? ""
}

function formatTable(token: Tokens.Table) {
  const header = token.header
    .map((cell) => inlineTokensToPlainText(cell.tokens))
    .join(" | ")
  const divider = token.header.map(() => "---").join(" | ")
  const rows = token.rows.map((row) =>
    row.map((cell) => inlineTokensToPlainText(cell.tokens)).join(" | ")
  )
  return [header, divider, ...rows].join("\n")
}

function inlineTokensToPlainText(tokens: readonly Token[]) {
  let text = ""
  for (const token of tokens) {
    switch (token.type) {
      case "strong":
      case "em":
      case "del":
      case "link":
        text += inlineTokensToPlainText(token.tokens ?? [])
        break
      case "codespan":
      case "escape":
      case "text":
      case "html":
        text += token.text
        break
      case "br":
        text += "\n"
        break
      case "image":
        text += token.text
        break
      default:
        text += fallbackTextForToken(token)
    }
  }
  return text
}

function headingVariant(depth: number): InlineVariant {
  if (depth <= 1) return "heading-1"
  if (depth === 2) return "heading-2"
  return "body"
}

function lineHeightForVariant(variant: InlineVariant, style: TextStyleConfig) {
  switch (variant) {
    case "heading-1":
      return HEADING_ONE_LINE_PX * style.fontScale
    case "heading-2":
      return HEADING_TWO_LINE_PX * style.fontScale
    case "body":
      return BODY_LINE_PX * style.fontScale
  }
}

function inlineFont(
  variant: InlineVariant,
  marks: MarkState,
  style: TextStyleConfig
) {
  const italic = marks.italic ? "italic " : ""
  switch (variant) {
    case "heading-1":
      return `${italic}${marks.bold ? 800 : 700} ${HEADING_ONE_FONT_PX * style.fontScale}px ${SERIF_FAMILY}`
    case "heading-2":
      return `${italic}${marks.bold ? 800 : 700} ${HEADING_TWO_FONT_PX * style.fontScale}px ${SERIF_FAMILY}`
    case "body":
      return `${italic}${marks.bold ? 700 : marks.href ? 500 : 400} ${BODY_FONT_PX * style.fontScale}px ${SANS_FAMILY}`
  }
}

function inlineClassName(variant: InlineVariant, marks: MarkState) {
  const classes = [
    "inline-block wrap-break-word whitespace-pre-wrap whitespace-pre align-baseline leading-none",
  ]
  if (variant === "heading-1")
    classes.push("font-serif text-[1.45em] font-semibold")
  if (variant === "heading-2")
    classes.push("font-serif text-[1.18em] font-semibold")
  if (marks.bold) classes.push("font-semibold")
  if (marks.italic) classes.push("italic")
  if (marks.strike) classes.push("line-through")
  if (marks.href) classes.push("text-primary underline underline-offset-2")
  return classes.join(" ")
}

function canMergeInlinePieces(a: InlinePiece, b: InlinePiece) {
  return (
    a.breakMode === b.breakMode &&
    a.className === b.className &&
    a.extraWidth === b.extraWidth &&
    a.font === b.font &&
    a.href === b.href
  )
}

function stripSingleTrailingNewline(text: string) {
  return text.endsWith("\n") ? text.slice(0, -1) : text
}

function countTextWords(text: string) {
  const matches = text.trim().match(/\S+/g)
  return matches?.length ?? 0
}

function safeWidth(width: number) {
  return Number.isFinite(width) && width > 0 ? width : 1
}
