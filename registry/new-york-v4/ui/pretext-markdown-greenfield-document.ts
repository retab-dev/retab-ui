"use client"

import type {
  PretextMarkdownHastElement,
  PretextMarkdownHastNode,
} from "./pretext-markdown-hast-types"
import {
  pretextMarkdownSourceRangeFromPosition,
  pretextMarkdownSourceTextForRange,
  type PretextMarkdownSourceRange,
} from "./pretext-markdown-source-map"
import {
  createPretextMarkdownUnifiedDocument,
  type PretextMarkdownUnifiedDocument,
} from "./pretext-markdown-unified-pipeline"

const TARGET_CHUNK_SOURCE_LINES = 42
const MAX_CHUNK_SOURCE_LINES = 64
const HOSTILE_CODE_LINE_COUNT = 400
const HOSTILE_HAST_NODE_COUNT = 3_000
const HOSTILE_HAST_DEPTH = 80
const HOSTILE_TEXT_LENGTH = 20_000
const HOSTILE_TABLE_CELL_COUNT = 2_000
const DOCUMENT_CACHE_LIMIT = 24

const pretextMarkdownGreenfieldDocumentCache = new Map<
  string,
  {
    document: PretextMarkdownGreenfieldDocument
    text: string
  }
>()

export type PretextMarkdownGreenfieldBlockKind =
  | "blockquote"
  | "code"
  | "component"
  | "diagram"
  | "footnotes"
  | "frontmatter"
  | "heading"
  | "html"
  | "image"
  | "list"
  | "math"
  | "paragraph"
  | "table"
  | "thematicBreak"
  | "unknown"

export type PretextMarkdownGreenfieldDocument = {
  blocks: PretextMarkdownGreenfieldBlock[]
  chunks: PretextMarkdownGreenfieldChunk[]
  fragmentTargets: PretextMarkdownGreenfieldFragmentTarget[]
  headings: PretextMarkdownGreenfieldHeading[]
  lineCount: number
  text: string
  unified: PretextMarkdownUnifiedDocument
  wordCount: number
}

export type PretextMarkdownGreenfieldHeading = {
  blockId: string
  id: string
  sourceLine: number
  text: string
}

export type PretextMarkdownGreenfieldFragmentTarget = {
  blockId: string
  id: string
  sourceLine: number
}

export type PretextMarkdownGreenfieldBlock = {
  hastChildren: PretextMarkdownHastNode[]
  id: string
  index: number
  isGenerated: boolean
  isHostile: boolean
  kind: PretextMarkdownGreenfieldBlockKind
  sourceRange: PretextMarkdownSourceRange | null
  sourceText: string
}

export type PretextMarkdownGreenfieldChunk = {
  blockIds: string[]
  hastChildren: PretextMarkdownHastNode[]
  id: string
  index: number
  isHostile: boolean
  sourceEndLine: number
  sourceRange: PretextMarkdownSourceRange | null
  sourceStartLine: number
  sourceText: string
}

export function createPretextMarkdownGreenfieldDocument(
  markdown: string
): PretextMarkdownGreenfieldDocument {
  const text = markdown.length ? markdown : " "
  const cacheKey = pretextMarkdownGreenfieldDocumentCacheKey(text)
  const cached = pretextMarkdownGreenfieldDocumentCache.get(cacheKey)
  if (cached?.text === text) {
    pretextMarkdownGreenfieldDocumentCache.delete(cacheKey)
    pretextMarkdownGreenfieldDocumentCache.set(cacheKey, cached)
    return cached.document
  }

  const document = createUncachedPretextMarkdownGreenfieldDocument(text)
  pretextMarkdownGreenfieldDocumentCache.set(cacheKey, {
    document,
    text,
  })
  while (pretextMarkdownGreenfieldDocumentCache.size > DOCUMENT_CACHE_LIMIT) {
    const oldestKey = pretextMarkdownGreenfieldDocumentCache.keys().next().value
    if (!oldestKey) break
    pretextMarkdownGreenfieldDocumentCache.delete(oldestKey)
  }

  return document
}

function createUncachedPretextMarkdownGreenfieldDocument(
  text: string
): PretextMarkdownGreenfieldDocument {
  const unified = createPretextMarkdownUnifiedDocument(text)
  normalizePretextMarkdownGreenfieldHeadingIds(unified.hast.children, unified)
  normalizePretextMarkdownGreenfieldTables(unified.hast.children)
  annotatePretextMarkdownGreenfieldSourceMetadata(
    unified.hast.children,
    unified
  )
  const blocks = createPretextMarkdownGreenfieldBlocks({ text, unified })
  const chunks = createPretextMarkdownGreenfieldChunks({ blocks, text })
  const headings = createPretextMarkdownGreenfieldHeadings(blocks)
  const fragmentTargets = createPretextMarkdownGreenfieldFragmentTargets({
    blocks,
    unified,
  })
  freezePretextMarkdownHastNode(unified.hast)

  return freezePretextMarkdownGreenfieldDocument({
    blocks,
    chunks,
    fragmentTargets,
    headings,
    lineCount: unified.sourceMap.lineCount,
    text,
    unified,
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
  })
}

export function findPretextMarkdownGreenfieldHeadingById(
  document: PretextMarkdownGreenfieldDocument,
  headingId: string
) {
  const normalizedId = headingId.replace(/^#/, "")
  return document.headings.find((heading) => heading.id === normalizedId)
}

export function findPretextMarkdownGreenfieldFragmentTargetById(
  document: PretextMarkdownGreenfieldDocument,
  fragmentId: string
) {
  const normalizedId = normalizeFragmentTargetId(fragmentId)
  return document.fragmentTargets.find((target) => target.id === normalizedId)
}

export function findPretextMarkdownGreenfieldBlockById(
  document: PretextMarkdownGreenfieldDocument,
  blockId: string
) {
  return document.blocks.find((block) => block.id === blockId) ?? null
}

export function findPretextMarkdownGreenfieldChunkByBlockId(
  document: PretextMarkdownGreenfieldDocument,
  blockId: string
) {
  return (
    document.chunks.find((chunk) => chunk.blockIds.includes(blockId)) ?? null
  )
}

export function findPretextMarkdownGreenfieldBlockBySourceLine(
  document: PretextMarkdownGreenfieldDocument,
  sourceLine: number
) {
  const line = clampSourceLine(sourceLine, document.lineCount)
  return (
    document.blocks.find((block) => {
      const range = block.sourceRange
      return range && range.startLine <= line && range.endLine >= line
    }) ?? null
  )
}

export function findPretextMarkdownGreenfieldChunkBySourceLine(
  document: PretextMarkdownGreenfieldDocument,
  sourceLine: number
) {
  const block = findPretextMarkdownGreenfieldBlockBySourceLine(
    document,
    sourceLine
  )
  if (block)
    return findPretextMarkdownGreenfieldChunkByBlockId(document, block.id)

  const line = clampSourceLine(sourceLine, document.lineCount)
  return (
    document.chunks.find(
      (chunk) => chunk.sourceStartLine <= line && chunk.sourceEndLine >= line
    ) ?? null
  )
}

export function findPretextMarkdownGreenfieldBlockBySourceOffset(
  document: PretextMarkdownGreenfieldDocument,
  sourceOffset: number
) {
  const offset = clampSourceOffset(sourceOffset, document.text.length)
  return (
    document.blocks.find((block) => {
      const range = block.sourceRange
      return range && range.startOffset <= offset && range.endOffset > offset
    }) ?? null
  )
}

export function findPretextMarkdownGreenfieldChunkBySourceOffset(
  document: PretextMarkdownGreenfieldDocument,
  sourceOffset: number
) {
  const block = findPretextMarkdownGreenfieldBlockBySourceOffset(
    document,
    sourceOffset
  )
  return block
    ? findPretextMarkdownGreenfieldChunkByBlockId(document, block.id)
    : null
}

function createPretextMarkdownGreenfieldBlocks({
  text,
  unified,
}: {
  text: string
  unified: PretextMarkdownUnifiedDocument
}) {
  const blocks: PretextMarkdownGreenfieldBlock[] = []

  for (const child of unified.hast.children) {
    if (isWhitespaceText(child)) continue

    const directSourceRange = pretextMarkdownSourceRangeFromPosition({
      position: child.position,
      sourceMap: unified.sourceMap,
    })
    const sourceRange =
      directSourceRange ??
      pretextMarkdownSyntheticSourceRangeForNode(child, unified)
    const kind = pretextMarkdownBlockKindForHastChild(child)
    const sourceText = pretextMarkdownSourceTextForRange({
      range: sourceRange,
      sourceMap: unified.sourceMap,
    })
    const line = sourceRange?.startLine ?? unified.sourceMap.lineCount
    const block: PretextMarkdownGreenfieldBlock = {
      hastChildren: [child],
      id: `block-${blocks.length + 1}-${line}-${kind}`,
      index: blocks.length,
      isGenerated: !directSourceRange,
      isHostile: isHostilePretextMarkdownGreenfieldBlock({
        child,
        kind,
        sourceText,
      }),
      kind,
      sourceRange,
      sourceText:
        sourceText ||
        (sourceRange
          ? text.slice(sourceRange.startOffset, sourceRange.endOffset)
          : ""),
    }
    blocks.push(block)
  }

  if (!blocks.length) {
    blocks.push({
      hastChildren: [],
      id: "block-1-empty",
      index: 0,
      isGenerated: true,
      isHostile: false,
      kind: "paragraph",
      sourceRange: {
        endLine: 1,
        endOffset: text.length,
        startLine: 1,
        startOffset: 0,
      },
      sourceText: text,
    })
  }

  return blocks
}

function createPretextMarkdownGreenfieldChunks({
  blocks,
  text,
}: {
  blocks: readonly PretextMarkdownGreenfieldBlock[]
  text: string
}) {
  const chunks: PretextMarkdownGreenfieldChunk[] = []
  let current: PretextMarkdownGreenfieldBlock[] = []

  const flush = () => {
    if (!current.length) return
    chunks.push(createChunk(current, chunks.length, text))
    current = []
  }

  for (const block of blocks) {
    if (block.isHostile) {
      flush()
      current.push(block)
      flush()
      continue
    }

    const nextLineCount = lineCountForBlocks([...current, block])
    const startsNewChunk =
      current.length > 0 &&
      block.kind === "heading" &&
      nextLineCount >= TARGET_CHUNK_SOURCE_LINES
    const exceedsMax =
      current.length > 0 && nextLineCount > MAX_CHUNK_SOURCE_LINES

    if (startsNewChunk || exceedsMax) flush()
    current.push(block)
  }

  flush()
  return chunks
}

function createChunk(
  blocks: readonly PretextMarkdownGreenfieldBlock[],
  index: number,
  text: string
): PretextMarkdownGreenfieldChunk {
  const ranges = blocks
    .map((block) => block.sourceRange)
    .filter((range): range is PretextMarkdownSourceRange => Boolean(range))
  const sourceRange = ranges.length
    ? {
        endLine: Math.max(...ranges.map((range) => range.endLine)),
        endOffset: Math.max(...ranges.map((range) => range.endOffset)),
        startLine: Math.min(...ranges.map((range) => range.startLine)),
        startOffset: Math.min(...ranges.map((range) => range.startOffset)),
      }
    : null
  const sourceStartLine =
    sourceRange?.startLine ?? blocks[0]?.sourceRange?.startLine ?? 1
  const sourceEndLine =
    sourceRange?.endLine ??
    blocks[blocks.length - 1]?.sourceRange?.endLine ??
    sourceStartLine

  return {
    blockIds: blocks.map((block) => block.id),
    hastChildren: blocks.flatMap((block) => block.hastChildren),
    id: `chunk-${index + 1}-${sourceStartLine}`,
    index,
    isHostile: blocks.some((block) => block.isHostile),
    sourceEndLine,
    sourceRange,
    sourceStartLine,
    sourceText: sourceRange
      ? text.slice(sourceRange.startOffset, sourceRange.endOffset)
      : "",
  }
}

function createPretextMarkdownGreenfieldHeadings(
  blocks: readonly PretextMarkdownGreenfieldBlock[]
) {
  return blocks.flatMap((block) => {
    const element = readHastElement(block.hastChildren[0])
    if (!element || !/^h[1-6]$/.test(element.tagName)) return []

    const id = readStringProperty(element.properties?.id)
    if (!id) return []

    return [
      {
        blockId: block.id,
        id,
        sourceLine: block.sourceRange?.startLine ?? 1,
        text: extractHastText(element).trim(),
      },
    ]
  })
}

function createPretextMarkdownGreenfieldFragmentTargets({
  blocks,
  unified,
}: {
  blocks: readonly PretextMarkdownGreenfieldBlock[]
  unified: PretextMarkdownUnifiedDocument
}) {
  const targets = new Map<string, PretextMarkdownGreenfieldFragmentTarget>()

  for (const block of blocks) {
    for (const child of block.hastChildren) {
      collectFragmentTargets({
        block,
        node: child,
        targets,
        unified,
      })
    }
  }

  return Array.from(targets.values())
}

function collectFragmentTargets({
  block,
  node,
  targets,
  unified,
}: {
  block: PretextMarkdownGreenfieldBlock
  node: PretextMarkdownHastNode
  targets: Map<string, PretextMarkdownGreenfieldFragmentTarget>
  unified: PretextMarkdownUnifiedDocument
}) {
  const element = readHastElement(node)
  if (!element) return

  const id = readStringProperty(element.properties?.id)
  if (id) {
    const sourceRange =
      pretextMarkdownSourceRangeFromPosition({
        position: element.position,
        sourceMap: unified.sourceMap,
      }) ?? block.sourceRange
    const target = {
      blockId: block.id,
      id,
      sourceLine: sourceRange?.startLine ?? unified.sourceMap.lineCount,
    }

    for (const alias of fragmentTargetAliases(id)) {
      if (!targets.has(alias)) {
        targets.set(alias, { ...target, id: alias })
      }
    }
  }

  for (const child of element.children) {
    collectFragmentTargets({ block, node: child, targets, unified })
  }
}

function pretextMarkdownSyntheticSourceRangeForNode(
  node: PretextMarkdownHastNode,
  unified: PretextMarkdownUnifiedDocument
): PretextMarkdownSourceRange | null {
  const ranges = collectPretextMarkdownSourceRanges(node, unified)
  if (!ranges.length) return null
  return {
    endLine: Math.max(...ranges.map((range) => range.endLine)),
    endOffset: Math.max(...ranges.map((range) => range.endOffset)),
    startLine: Math.min(...ranges.map((range) => range.startLine)),
    startOffset: Math.min(...ranges.map((range) => range.startOffset)),
  }
}

function collectPretextMarkdownSourceRanges(
  node: PretextMarkdownHastNode,
  unified: PretextMarkdownUnifiedDocument
): PretextMarkdownSourceRange[] {
  const range = pretextMarkdownSourceRangeFromPosition({
    position: node.position,
    sourceMap: unified.sourceMap,
  })
  const element = readHastElement(node)
  return [
    ...(range ? [range] : []),
    ...(element?.children ?? []).flatMap((child) =>
      collectPretextMarkdownSourceRanges(child, unified)
    ),
  ]
}

function normalizePretextMarkdownGreenfieldHeadingIds(
  nodes: readonly PretextMarkdownHastNode[],
  unified: PretextMarkdownUnifiedDocument
) {
  const usedIds = new Map<string, number>()
  for (const node of nodes) {
    normalizeHeadingIdsInNode(node, usedIds, unified)
  }
}

function normalizeHeadingIdsInNode(
  node: PretextMarkdownHastNode,
  usedIds: Map<string, number>,
  unified: PretextMarkdownUnifiedDocument
) {
  const element = readHastElement(node)
  if (!element) return

  if (/^h[1-6]$/.test(element.tagName)) {
    const visibleText = extractHastText(element)
    const markdownText = markdownHeadingTextFromSource(element, unified)
    const baseId = safeHeadingIdForText(
      markdownText.includes("__proto__") ? markdownText : visibleText
    )
    const duplicateCount = usedIds.get(baseId) ?? 0
    usedIds.set(baseId, duplicateCount + 1)
    element.properties = {
      ...element.properties,
      id: duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount}`,
    }
  }

  for (const child of element.children) {
    normalizeHeadingIdsInNode(child, usedIds, unified)
  }
}

function markdownHeadingTextFromSource(
  element: PretextMarkdownHastElement,
  unified: PretextMarkdownUnifiedDocument
) {
  const range = pretextMarkdownSourceRangeFromPosition({
    position: element.position,
    sourceMap: unified.sourceMap,
  })
  if (!range) return ""
  return pretextMarkdownSourceTextForRange({
    range,
    sourceMap: unified.sourceMap,
  })
    .replace(/^\s{0,3}#{1,6}[ \t]*/, "")
    .replace(/[ \t]+#*\s*$/, "")
    .trim()
}

function safeHeadingIdForText(text: string) {
  const slug =
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"

  return isDomClobberingId(slug) ? `section-${slug}` : slug
}

function normalizeFragmentTargetId(fragmentId: string) {
  return decodeURIComponent(fragmentId.replace(/^#/, ""))
}

function fragmentTargetAliases(id: string) {
  const aliases = new Set<string>([normalizeFragmentTargetId(id)])
  const withoutRepeatedClobberPrefix = id.replace(
    /^(user-content-)+/,
    "user-content-"
  )
  aliases.add(withoutRepeatedClobberPrefix)
  aliases.add(withoutRepeatedClobberPrefix.replace(/^user-content-/, ""))
  return Array.from(aliases).filter(Boolean)
}

function normalizePretextMarkdownGreenfieldTables(
  nodes: readonly PretextMarkdownHastNode[]
) {
  let tableIndex = 0
  for (const node of nodes) {
    tableIndex = normalizeTablesInNode(node, tableIndex)
  }
}

function normalizeTablesInNode(
  node: PretextMarkdownHastNode,
  tableIndex: number
) {
  const element = readHastElement(node)
  if (!element) return tableIndex

  if (element.tagName === "table") {
    normalizeTableElement(element, tableIndex)
    tableIndex += 1
  }

  for (const child of element.children) {
    tableIndex = normalizeTablesInNode(child, tableIndex)
  }
  return tableIndex
}

function normalizeTableElement(
  table: PretextMarkdownHastElement,
  tableIndex: number
) {
  const rows = tableRows(table)
  const headerIds = new Map<number, string>()

  rows.forEach((row, rowIndex) => {
    row.properties = {
      ...row.properties,
      ariaRowIndex: rowIndex + 1,
      dataPretextTableRowIndex: rowIndex + 1,
    }

    tableCells(row).forEach((cell, columnIndex) => {
      const column = columnIndex + 1
      const properties = {
        ...cell.properties,
        ariaColIndex: column,
        dataPretextTableColumnIndex: column,
      }
      if (cell.tagName === "th") {
        const id = `pretext-markdown-table-${tableIndex + 1}-column-${column}`
        headerIds.set(columnIndex, id)
        cell.properties = {
          ...properties,
          id,
          scope: "col",
        }
      } else {
        cell.properties = {
          ...properties,
          headers: headerIds.get(columnIndex),
        }
      }
    })
  })
}

function annotatePretextMarkdownGreenfieldSourceMetadata(
  nodes: readonly PretextMarkdownHastNode[],
  unified: PretextMarkdownUnifiedDocument
) {
  for (const node of nodes) {
    annotateSourceMetadataInNode(node, unified)
  }
}

function annotateSourceMetadataInNode(
  node: PretextMarkdownHastNode,
  unified: PretextMarkdownUnifiedDocument
) {
  const element = readHastElement(node)
  if (!element) return

  const sourceRange = pretextMarkdownSourceRangeFromPosition({
    position: element.position,
    sourceMap: unified.sourceMap,
  })
  if (sourceRange) {
    element.properties = {
      ...element.properties,
      dataPretextSourceEndLine: sourceRange.endLine,
      dataPretextSourceEndOffset: sourceRange.endOffset,
      dataPretextSourceStartLine: sourceRange.startLine,
      dataPretextSourceStartOffset: sourceRange.startOffset,
    }
  }

  for (const child of element.children) {
    annotateSourceMetadataInNode(child, unified)
  }
}

function tableRows(element: PretextMarkdownHastElement) {
  const rows: PretextMarkdownHastElement[] = []
  for (const child of element.children) {
    const childElement = readHastElement(child)
    if (!childElement) continue
    if (childElement.tagName === "tr") {
      rows.push(childElement)
    } else if (
      childElement.tagName === "thead" ||
      childElement.tagName === "tbody" ||
      childElement.tagName === "tfoot"
    ) {
      rows.push(...tableRows(childElement))
    }
  }
  return rows
}

function tableCells(row: PretextMarkdownHastElement) {
  return row.children
    .map(readHastElement)
    .filter(
      (child): child is PretextMarkdownHastElement =>
        child?.tagName === "td" || child?.tagName === "th"
    )
}

function isDomClobberingId(id: string) {
  return [
    "__proto__",
    "constructor",
    "document",
    "forms",
    "history",
    "location",
    "name",
    "prototype",
    "window",
  ].includes(id)
}

function pretextMarkdownBlockKindForHastChild(
  child: PretextMarkdownHastNode
): PretextMarkdownGreenfieldBlockKind {
  const element = readHastElement(child)
  if (!element) return child.type === "text" ? "paragraph" : "unknown"

  if (element.properties?.dataFootnotes != null) return "footnotes"
  if (element.properties?.dataPretextMarkdownFrontmatter != null)
    return "frontmatter"
  if (/^h[1-6]$/.test(element.tagName)) return "heading"
  if (isPretextMarkdownDiagramElement(element)) return "diagram"
  if (isPretextMarkdownComponentElement(element)) return "component"
  if (isDisplayMathElement(element)) return "math"

  switch (element.tagName) {
    case "blockquote":
      return "blockquote"
    case "hr":
      return "thematicBreak"
    case "ol":
    case "ul":
      return "list"
    case "p":
      if (isDisplayMathElement(element)) return "math"
      return firstElementChild(element)?.tagName === "img"
        ? "image"
        : "paragraph"
    case "pre":
      if (isMermaidCodeElement(element)) return "diagram"
      return "code"
    case "table":
      return "table"
    default:
      return "html"
  }
}

function isPretextMarkdownDiagramElement(element: PretextMarkdownHastElement) {
  return (
    readStringProperty(element.properties?.dataPretextComponentName) ===
    "Diagram"
  )
}

function isPretextMarkdownComponentElement(
  element: PretextMarkdownHastElement
) {
  return (
    element.properties?.dataPretextComponentName != null ||
    element.properties?.dataPretextComponentFallback != null ||
    element.properties?.dataPretextCalloutKind != null
  )
}

function isDisplayMathElement(element: PretextMarkdownHastElement): boolean {
  if (
    hasClassName(element, "katex-display") ||
    hasClassName(element, "math-display")
  )
    return true
  return element.children
    .map(readHastElement)
    .some((child) => child != null && isDisplayMathElement(child))
}

function isMermaidCodeElement(element: PretextMarkdownHastElement) {
  const code = firstElementChild(element)
  return (
    code?.tagName === "code" &&
    ["language-mermaid", "language-mmd", "language-mermaid-js"].some(
      (className) => hasClassName(code, className)
    )
  )
}

function hasClassName(element: PretextMarkdownHastElement, className: string) {
  const classes = element.properties?.className
  return Array.isArray(classes)
    ? classes.includes(className)
    : typeof classes === "string" && classes.split(/\s+/).includes(className)
}

function isHostilePretextMarkdownGreenfieldBlock({
  child,
  kind,
  sourceText,
}: {
  child: PretextMarkdownHastNode
  kind: PretextMarkdownGreenfieldBlockKind
  sourceText: string
}) {
  if (sourceText.length > HOSTILE_TEXT_LENGTH) return true
  if (countHastNodes(child) > HOSTILE_HAST_NODE_COUNT) return true
  if (maxHastDepth(child) > HOSTILE_HAST_DEPTH) return true
  if (
    kind === "code" &&
    sourceText.split(/\r\n|[\n\r\u2028\u2029]/).length > HOSTILE_CODE_LINE_COUNT
  ) {
    return true
  }
  if (kind === "table" && countTableCells(child) > HOSTILE_TABLE_CELL_COUNT) {
    return true
  }
  return false
}

function countHastNodes(node: PretextMarkdownHastNode): number {
  const element = readHastElement(node)
  return (
    1 +
    (element?.children ?? []).reduce(
      (sum, child) => sum + countHastNodes(child),
      0
    )
  )
}

function maxHastDepth(node: PretextMarkdownHastNode): number {
  const element = readHastElement(node)
  if (!element?.children.length) return 1
  return 1 + Math.max(...element.children.map(maxHastDepth))
}

function lineCountForBlocks(blocks: readonly PretextMarkdownGreenfieldBlock[]) {
  const ranges = blocks
    .map((block) => block.sourceRange)
    .filter((range): range is PretextMarkdownSourceRange => Boolean(range))
  if (!ranges.length) return blocks.length

  return (
    Math.max(...ranges.map((range) => range.endLine)) -
    Math.min(...ranges.map((range) => range.startLine)) +
    1
  )
}

function countTableCells(node: PretextMarkdownHastNode): number {
  const element = readHastElement(node)
  if (!element) return 0
  const self = element.tagName === "td" || element.tagName === "th" ? 1 : 0
  return (
    self +
    (element.children ?? []).reduce(
      (sum, child) => sum + countTableCells(child),
      0
    )
  )
}

function readHastElement(node: unknown): PretextMarkdownHastElement | null {
  return node &&
    typeof node === "object" &&
    (node as PretextMarkdownHastElement).type === "element"
    ? (node as PretextMarkdownHastElement)
    : null
}

function firstElementChild(element: PretextMarkdownHastElement) {
  return element.children.map(readHastElement).find(Boolean) ?? null
}

function isWhitespaceText(node: PretextMarkdownHastNode) {
  return (
    node.type === "text" &&
    typeof node.value === "string" &&
    node.value.trim() === ""
  )
}

function readStringProperty(value: unknown) {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.filter(Boolean).join(" ")
  return ""
}

function extractHastText(node: PretextMarkdownHastNode): string {
  if (node.type === "text" && typeof node.value === "string") return node.value
  const element = readHastElement(node)
  if (!element) return ""
  return element.children.map(extractHastText).join("")
}

function freezePretextMarkdownHastNode(node: unknown) {
  if (!node || typeof node !== "object" || Object.isFrozen(node)) return

  const record = node as Record<string, unknown>
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      value.forEach(freezePretextMarkdownHastNode)
      Object.freeze(value)
      continue
    }
    if (value && typeof value === "object") {
      freezePretextMarkdownHastNode(value)
    }
  }
  Object.freeze(node)
}

function freezePretextMarkdownGreenfieldDocument(
  document: PretextMarkdownGreenfieldDocument
) {
  for (const block of document.blocks) {
    if (block.sourceRange) Object.freeze(block.sourceRange)
    Object.freeze(block.hastChildren)
    Object.freeze(block)
  }
  for (const chunk of document.chunks) {
    if (chunk.sourceRange) Object.freeze(chunk.sourceRange)
    Object.freeze(chunk.blockIds)
    Object.freeze(chunk.hastChildren)
    Object.freeze(chunk)
  }
  for (const heading of document.headings) Object.freeze(heading)
  for (const target of document.fragmentTargets) Object.freeze(target)
  Object.freeze(document.blocks)
  Object.freeze(document.chunks)
  Object.freeze(document.headings)
  Object.freeze(document.fragmentTargets)
  return Object.freeze(document)
}

function pretextMarkdownGreenfieldDocumentCacheKey(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`
}

function clampSourceLine(line: number, lineCount: number) {
  if (!Number.isFinite(line)) return 1
  return Math.max(1, Math.min(lineCount, Math.floor(line)))
}

function clampSourceOffset(offset: number, textLength: number) {
  if (!Number.isFinite(offset)) return 0
  return Math.max(0, Math.min(textLength, Math.floor(offset)))
}
