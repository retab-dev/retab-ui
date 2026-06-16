"use client"

import {
  parsePretextMarkdownTokens,
  type PretextMarkdownToken,
} from "./pretext-markdown-parser"
import { splitTextLines } from "./text-viewer-resource"

const MARKDOWN_CHUNK_TARGET_SOURCE_LINES = 36
const MARKDOWN_CHUNK_MAX_SOURCE_LINES = 54
const DOM_CLOBBERING_HEADING_IDS = new Set([
  "__proto__",
  "attributes",
  "children",
  "constructor",
  "content",
  "cookie",
  "document",
  "forms",
  "history",
  "id",
  "images",
  "length",
  "links",
  "location",
  "name",
  "navigator",
  "parent",
  "prototype",
  "scripts",
  "self",
  "top",
  "window",
])
const MARKDOWN_HEADING_NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "©",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  shy: "",
  trade: "™",
}

export type PretextMarkdownChunkKind = "frontmatter" | "markdown"
export type PretextMarkdownFrontmatterLanguage = "toml" | "yaml"
export type PretextMarkdownBlockKind =
  | "code"
  | "comment"
  | "definition"
  | "frontmatter"
  | "heading"
  | "html"
  | "list"
  | "paragraph"
  | "table"
  | "thematicBreak"
  | "unknown"

export interface PretextMarkdownDocument {
  blocks: PretextMarkdownBlock[]
  footnoteDefinitionsMarkdown: string
  frontmatter?: PretextMarkdownFrontmatter
  headings: PretextMarkdownHeading[]
  chunks: PretextMarkdownChunk[]
  referenceDefinitionsMarkdown: string
  sourceLineCount: number
  text: string
  wordCount: number
}

export interface PretextMarkdownHeading {
  blockId: string
  id: string
  chunkIndex: number
  sourceOffset: number
  sourceLine: number
  text: string
}

export interface PretextMarkdownFrontmatter {
  entries: PretextMarkdownFrontmatterEntry[]
  language: PretextMarkdownFrontmatterLanguage
  markdown: string
  sourceEndOffset: number
  sourceEndLine: number
  sourceStartOffset: number
  sourceStartLine: number
}

export interface PretextMarkdownFrontmatterEntry {
  key: string
  value: string
  valueKind: "boolean" | "list" | "number" | "string"
}

export interface PretextMarkdownBlock {
  chunkIndex: number
  frontmatterEntries?: PretextMarkdownFrontmatterEntry[]
  headingId?: string
  id: string
  index: number
  isOrderedList?: boolean
  isHostile: boolean
  kind: PretextMarkdownBlockKind
  listStart?: number
  markdown: string
  sourceEndOffset: number
  sourceEndLine: number
  sourceStartOffset: number
  sourceStartLine: number
}

export interface PretextMarkdownChunk {
  blockIds: string[]
  frontmatterEntries?: PretextMarkdownFrontmatterEntry[]
  frontmatterLanguage?: PretextMarkdownFrontmatterLanguage
  headingIds: string[]
  index: number
  isHostile: boolean
  kind: PretextMarkdownChunkKind
  markdown: string
  sourceEndOffset: number
  sourceEndLine: number
  sourceStartOffset: number
  sourceStartLine: number
}

export interface PretextMarkdownLineRange {
  end: number
  start: number
}

export interface PretextMarkdownOffsetRange {
  end: number
  start: number
}

export function createPretextMarkdownDocument(
  markdown: string
): PretextMarkdownDocument {
  const sourceLineCount = splitTextLines(markdown).length
  const { blocks, headings, chunks } = createPretextMarkdownChunks(
    markdown,
    sourceLineCount
  )
  const frontmatter =
    chunks[0]?.kind === "frontmatter"
      ? createPretextMarkdownFrontmatter(chunks[0])
      : undefined
  const referenceDefinitionsMarkdown =
    collectPretextMarkdownReferenceDefinitions(markdown)
  const footnoteDefinitionsMarkdown =
    collectPretextMarkdownFootnoteDefinitions(markdown)

  return {
    blocks,
    footnoteDefinitionsMarkdown,
    ...(frontmatter ? { frontmatter } : {}),
    headings,
    chunks,
    referenceDefinitionsMarkdown,
    sourceLineCount,
    text: markdown,
    wordCount: countWords(markdown),
  }
}

export function findPretextMarkdownChunkForOffset(
  chunks: readonly PretextMarkdownChunk[],
  sourceOffset: number
) {
  return chunks.find((chunk) =>
    pretextMarkdownSourceOffsetsIntersect({
      end: chunk.sourceEndOffset,
      point: sourceOffset,
      start: chunk.sourceStartOffset,
    })
  )
}

export function findPretextMarkdownBlockForOffset(
  blocks: readonly PretextMarkdownBlock[],
  sourceOffset: number
) {
  return blocks.find((block) =>
    pretextMarkdownSourceOffsetsIntersect({
      end: block.sourceEndOffset,
      point: sourceOffset,
      start: block.sourceStartOffset,
    })
  )
}

export function pretextMarkdownChunkIntersectsOffsetRange({
  chunk,
  range,
}: {
  chunk: PretextMarkdownChunk
  range: PretextMarkdownOffsetRange | null
}) {
  return pretextMarkdownSourceRangeIntersectsOffsetRange({
    range,
    sourceEndOffset: chunk.sourceEndOffset,
    sourceStartOffset: chunk.sourceStartOffset,
  })
}

export function pretextMarkdownBlockIntersectsOffsetRange({
  block,
  range,
}: {
  block: PretextMarkdownBlock
  range: PretextMarkdownOffsetRange | null
}) {
  return pretextMarkdownSourceRangeIntersectsOffsetRange({
    range,
    sourceEndOffset: block.sourceEndOffset,
    sourceStartOffset: block.sourceStartOffset,
  })
}

export function findPretextMarkdownHeadingById(
  document: PretextMarkdownDocument,
  headingId: string
) {
  return document.headings.find((heading) => heading.id === headingId)
}

function pretextMarkdownSourceRangeIntersectsOffsetRange({
  range,
  sourceEndOffset,
  sourceStartOffset,
}: {
  range: PretextMarkdownOffsetRange | null
  sourceEndOffset: number
  sourceStartOffset: number
}) {
  if (!range) return false
  const start = Math.max(0, Math.min(range.start, range.end))
  const end = Math.max(0, Math.max(range.start, range.end))
  return sourceStartOffset < end && sourceEndOffset > start
}

function pretextMarkdownSourceOffsetsIntersect({
  end,
  point,
  start,
}: {
  end: number
  point: number
  start: number
}) {
  return point >= start && point < end
}

function createPretextMarkdownChunks(
  markdown: string,
  sourceLineCount: number
): Pick<PretextMarkdownDocument, "blocks" | "headings" | "chunks"> {
  const blockIds: BlockIdRegistry = new Map()
  const blocks: PretextMarkdownBlock[] = []
  const chunks: PretextMarkdownChunk[] = []
  const headings: PretextMarkdownHeading[] = []
  const headingIds: HeadingIdRegistry = new Map()
  const sourceLineOffsets = createSourceLineOffsets(markdown)
  const frontmatter = extractFrontmatter(markdown)
  const body = frontmatter ? frontmatter.body : markdown
  const bodyStartLine = frontmatter ? frontmatter.endLine + 1 : 1

  if (frontmatter) {
    const chunkIndex = chunks.length
    const sourceStartOffset = getSourceLineStartOffset(sourceLineOffsets, 1)
    const sourceEndOffset = getSourceLineEndOffset(
      sourceLineOffsets,
      frontmatter.endLine,
      markdown.length
    )
    const frontmatterEntries = parsePretextMarkdownFrontmatterEntries({
      language: frontmatter.language,
      markdown: frontmatter.text,
    })
    const block = createPretextMarkdownBlock({
      blockIds,
      blocks,
      chunkIndex,
      frontmatterEntries,
      isHostile: false,
      kind: "frontmatter",
      markdown: frontmatter.text,
      sourceEndOffset,
      sourceEndLine: frontmatter.endLine,
      sourceStartOffset,
      sourceStartLine: 1,
    })
    chunks.push({
      blockIds: [block.id],
      frontmatterEntries,
      headingIds: [],
      index: chunkIndex,
      frontmatterLanguage: frontmatter.language,
      isHostile: false,
      kind: "frontmatter",
      markdown: frontmatter.text,
      sourceEndOffset,
      sourceEndLine: frontmatter.endLine,
      sourceStartOffset,
      sourceStartLine: 1,
    })
  }

  const bodyChunks = createMarkdownBodyChunks({
    blockIds,
    blocks,
    headingIds,
    headings,
    markdown: body,
    sourceLineOffsets,
    sourceEndLine: sourceLineCount,
    sourceStartLine: bodyStartLine,
    textLength: markdown.length,
    startIndex: chunks.length,
  })
  chunks.push(...bodyChunks)

  if (!chunks.length) {
    chunks.push({
      blockIds: [],
      headingIds: [],
      index: 0,
      isHostile: false,
      kind: "markdown",
      markdown,
      sourceEndOffset: markdown.length,
      sourceEndLine: sourceLineCount,
      sourceStartOffset: 0,
      sourceStartLine: 1,
    })
  }

  return { blocks, headings, chunks }
}

function createMarkdownBodyChunks({
  blockIds,
  blocks,
  headingIds,
  headings,
  markdown,
  sourceLineOffsets,
  sourceEndLine,
  sourceStartLine,
  textLength,
  startIndex,
}: {
  blockIds: BlockIdRegistry
  blocks: PretextMarkdownBlock[]
  headingIds: HeadingIdRegistry
  headings: PretextMarkdownHeading[]
  markdown: string
  sourceLineOffsets: SourceLineOffsets
  sourceEndLine: number
  sourceStartLine: number
  textLength: number
  startIndex: number
}) {
  const chunks: PretextMarkdownChunk[] = []
  if (!markdown.trim()) return chunks

  const accumulator = new ChunkAccumulator({
    chunks,
    sourceLineOffsets,
    startIndex,
    startLine: sourceStartLine,
    textLength,
  })

  try {
    const tokens = parsePretextMarkdownTokens(markdown)
    let cursorLine = sourceStartLine
    let cursorOffset = getSourceLineStartOffset(
      sourceLineOffsets,
      sourceStartLine
    )

    for (const token of tokens) {
      const raw = token.raw ?? ""
      const tokenLineCount = countLines(raw)
      const tokenLineBreaks = countLineSeparators(raw)
      const tokenStartLine = cursorLine
      const tokenStartOffset = cursorOffset
      const tokenEndOffset = Math.min(textLength, tokenStartOffset + raw.length)
      const tokenEndLine = Math.min(
        sourceEndLine,
        Math.max(tokenStartLine, cursorLine + Math.max(0, tokenLineCount - 1))
      )
      cursorLine += tokenLineBreaks
      cursorOffset = tokenEndOffset

      if (token.kind === "space") {
        accumulator.addSpace(raw, tokenLineBreaks)
        continue
      }

      const tokenIsHostile = isHostilePretextMarkdownToken(token, raw)
      const shouldStartNewChunk =
        accumulator.hasContent() &&
        isChunkLeadToken(token) &&
        accumulator.lineCount >= MARKDOWN_CHUNK_TARGET_SOURCE_LINES
      const wouldExceedMax =
        accumulator.hasContent() &&
        accumulator.lineCount + Math.max(1, tokenLineCount) >
          MARKDOWN_CHUNK_MAX_SOURCE_LINES

      if (shouldStartNewChunk || wouldExceedMax || tokenIsHostile) {
        accumulator.flush(
          Math.max(accumulator.startLine, tokenStartLine - 1)
        )
        accumulator.startAt(tokenStartLine, tokenStartOffset)
      }

      const chunkIndex = startIndex + chunks.length
      const blockKind = pretextMarkdownBlockKindForToken(token)
      const block = createPretextMarkdownBlock({
        blockIds,
        blocks,
        chunkIndex,
        isHostile: tokenIsHostile,
        kind: blockKind,
        markdown: raw,
        sourceEndOffset: tokenEndOffset,
        sourceEndLine: tokenEndLine,
        sourceStartOffset: tokenStartOffset,
        sourceStartLine: tokenStartLine,
      })
      accumulator.addBlockId(block.id)

      if (token.kind === "heading") {
        const text = normalizeHeadingText(token.text)
        const id = createMarkdownHeadingId(text, headingIds)
        block.headingId = id
        accumulator.addHeadingId(id)
        headings.push({
          blockId: block.id,
          id,
          chunkIndex,
          sourceOffset: tokenStartOffset,
          sourceLine: tokenStartLine,
          text,
        })
      }
      if (token.kind === "list") {
        block.isOrderedList = token.isOrderedList
        block.listStart = token.listStart
      }

      accumulator.addToken(raw, Math.max(1, tokenLineCount), tokenIsHostile)
      if (
        tokenIsHostile ||
        accumulator.lineCount >= MARKDOWN_CHUNK_MAX_SOURCE_LINES
      ) {
        accumulator.flush(tokenEndLine)
      }
    }

    if (accumulator.hasContent()) {
      accumulator.flush(sourceEndLine)
    }
  } catch {
    const block = createPretextMarkdownBlock({
      blockIds,
      blocks,
      chunkIndex: startIndex,
      isHostile: isHostilePretextMarkdownChunk(markdown),
      kind: "unknown",
      markdown,
      sourceEndOffset: textLength,
      sourceEndLine,
      sourceStartOffset: getSourceLineStartOffset(
        sourceLineOffsets,
        sourceStartLine
      ),
      sourceStartLine,
    })
    chunks.push({
      blockIds: [block.id],
      headingIds: [],
      index: startIndex,
      isHostile: block.isHostile,
      kind: "markdown",
      markdown,
      sourceEndOffset: block.sourceEndOffset,
      sourceEndLine,
      sourceStartOffset: block.sourceStartOffset,
      sourceStartLine,
    })
  }

  return chunks
}

/**
 * Accumulates raw markdown, block/heading ids, line counts, and the hostile
 * flag for the chunk currently being built, then emits a fully-formed
 * PretextMarkdownChunk on flush. Encapsulates what was previously a set of
 * mutually-mutating free `let` bindings in createMarkdownBodyChunks.
 */
class ChunkAccumulator {
  private readonly chunks: PretextMarkdownChunk[]
  private readonly sourceLineOffsets: SourceLineOffsets
  private readonly startIndex: number
  private readonly textLength: number

  private raw = ""
  private blockIds: string[] = []
  private headingIds: string[] = []
  private isHostile = false

  /** Number of source lines spanned by the in-progress chunk. */
  lineCount = 0
  /** First source line of the in-progress chunk (1-based). */
  startLine: number
  /** Source offset of the first character of the in-progress chunk. */
  startOffset: number

  constructor({
    chunks,
    sourceLineOffsets,
    startIndex,
    startLine,
    textLength,
  }: {
    chunks: PretextMarkdownChunk[]
    sourceLineOffsets: SourceLineOffsets
    startIndex: number
    startLine: number
    textLength: number
  }) {
    this.chunks = chunks
    this.sourceLineOffsets = sourceLineOffsets
    this.startIndex = startIndex
    this.textLength = textLength
    this.startLine = startLine
    this.startOffset = getSourceLineStartOffset(sourceLineOffsets, startLine)
  }

  /** True when the chunk has any non-whitespace content. */
  hasContent() {
    return this.raw.trim().length > 0
  }

  /** Append whitespace-only ("space") token content without block tracking. */
  addSpace(raw: string, lineBreaks: number) {
    this.raw += raw
    this.lineCount += lineBreaks
  }

  /** Append a content token's raw text, line count, and hostile flag. */
  addToken(raw: string, lineCount: number, tokenIsHostile: boolean) {
    this.raw += raw
    this.lineCount += lineCount
    this.isHostile = this.isHostile || tokenIsHostile
  }

  addBlockId(id: string) {
    this.blockIds.push(id)
  }

  addHeadingId(id: string) {
    this.headingIds.push(id)
  }

  /** Override the start position of the in-progress chunk. */
  startAt(startLine: number, startOffset: number) {
    this.startLine = startLine
    this.startOffset = startOffset
  }

  /**
   * Emit the in-progress chunk (when it has content) and reset accumulator
   * state to begin the next chunk after `endLine`. Whitespace-only chunks are
   * dropped but still advance the start position, matching the original
   * flushChunk closure exactly.
   */
  flush(endLine: number) {
    if (!this.hasContent()) {
      this.resetTo(endLine)
      return
    }
    const chunkIndex = this.startIndex + this.chunks.length
    const chunkMarkdown = this.raw.replace(/\n+$/g, "")
    this.chunks.push({
      blockIds: this.blockIds,
      headingIds: this.headingIds,
      index: chunkIndex,
      isHostile: this.isHostile,
      kind: "markdown",
      markdown: chunkMarkdown,
      sourceEndOffset: Math.min(
        this.textLength,
        this.startOffset + chunkMarkdown.length
      ),
      sourceEndLine: Math.max(this.startLine, endLine),
      sourceStartOffset: this.startOffset,
      sourceStartLine: this.startLine,
    })
    this.blockIds = []
    this.headingIds = []
    this.resetTo(endLine)
  }

  /** Reset accumulation state and advance the start position past `endLine`. */
  private resetTo(endLine: number) {
    this.raw = ""
    this.lineCount = 0
    this.isHostile = false
    this.startLine = endLine + 1
    this.startOffset = getSourceLineStartOffset(
      this.sourceLineOffsets,
      this.startLine
    )
  }
}

function extractFrontmatter(markdown: string) {
  const lines = splitTextLines(markdown)
  const openingFence = lines[0]?.trim()
  const language = frontmatterLanguageForFence(openingFence)
  if (!language || !openingFence) return null

  for (let index = 1; index < lines.length; index++) {
    if (lines[index]!.trim() !== openingFence) continue
    if (index === 1) return null
    return {
      body: lines.slice(index + 1).join("\n"),
      endLine: index + 1,
      language,
      text: lines.slice(1, index).join("\n"),
    }
  }

  return null
}

function frontmatterLanguageForFence(
  fence: string | undefined
): PretextMarkdownFrontmatterLanguage | null {
  switch (fence) {
    case "---":
      return "yaml"
    case "+++":
      return "toml"
    default:
      return null
  }
}

function collectPretextMarkdownReferenceDefinitions(markdown: string) {
  const frontmatter = extractFrontmatter(markdown)
  const body = frontmatter ? frontmatter.body : markdown

  try {
    return parsePretextMarkdownTokens(body)
      .filter((token) => token.kind === "definition")
      .map((token) => token.raw.trimEnd())
      .filter(Boolean)
      .join("\n")
  } catch {
    return ""
  }
}

function collectPretextMarkdownFootnoteDefinitions(markdown: string) {
  const frontmatter = extractFrontmatter(markdown)
  const body = frontmatter ? frontmatter.body : markdown

  return splitTextLines(body)
    .map((line) => line.trimEnd())
    .filter((line) => /^\[\^[^\]\r\n]+\]:[ \t]?.+/u.test(line))
    .join("\n")
}

function countLines(text: string) {
  if (!text) return 1
  return text.split(/\r\n|[\n\r\u2028\u2029]/).length
}

function countLineSeparators(text: string) {
  if (!text) return 0
  return Math.max(0, countLines(text) - 1)
}

type HeadingIdRegistry = Map<string, number>
type BlockIdRegistry = Map<string, number>

function createPretextMarkdownBlock({
  blockIds,
  blocks,
  chunkIndex,
  frontmatterEntries,
  isHostile,
  kind,
  markdown,
  sourceEndOffset,
  sourceEndLine,
  sourceStartOffset,
  sourceStartLine,
}: {
  blockIds: BlockIdRegistry
  blocks: PretextMarkdownBlock[]
  chunkIndex: number
  frontmatterEntries?: PretextMarkdownFrontmatterEntry[]
  isHostile: boolean
  kind: PretextMarkdownBlockKind
  markdown: string
  sourceEndOffset: number
  sourceEndLine: number
  sourceStartOffset: number
  sourceStartLine: number
}) {
  const block: PretextMarkdownBlock = {
    chunkIndex,
    frontmatterEntries,
    id: createMarkdownBlockId({ blockIds, kind, sourceStartLine }),
    index: blocks.length,
    isHostile,
    kind,
    markdown,
    sourceEndOffset,
    sourceEndLine,
    sourceStartOffset,
    sourceStartLine,
  }
  blocks.push(block)
  return block
}

function createPretextMarkdownFrontmatter(
  chunk: PretextMarkdownChunk
): PretextMarkdownFrontmatter | undefined {
  if (!chunk.frontmatterLanguage) return undefined
  return {
    entries: chunk.frontmatterEntries ?? [],
    language: chunk.frontmatterLanguage,
    markdown: chunk.markdown,
    sourceEndOffset: chunk.sourceEndOffset,
    sourceEndLine: chunk.sourceEndLine,
    sourceStartOffset: chunk.sourceStartOffset,
    sourceStartLine: chunk.sourceStartLine,
  }
}

interface SourceLineOffsets {
  ends: number[]
  starts: number[]
}

function createSourceLineOffsets(text: string): SourceLineOffsets {
  const starts: number[] = []
  const ends: number[] = []
  const lineSeparatorPattern = /\r\n|[\n\r\u2028\u2029]/g
  let lineStart = 0
  let match: RegExpExecArray | null

  while ((match = lineSeparatorPattern.exec(text))) {
    starts.push(lineStart)
    ends.push(match.index)
    lineStart = match.index + match[0].length
  }

  starts.push(lineStart)
  ends.push(text.length)
  return { ends, starts }
}

function getSourceLineStartOffset(offsets: SourceLineOffsets, line: number) {
  return (
    offsets.starts[Math.max(0, line - 1)] ??
    offsets.ends[offsets.ends.length - 1] ??
    0
  )
}

function getSourceLineEndOffset(
  offsets: SourceLineOffsets,
  line: number,
  textLength: number
) {
  return offsets.ends[Math.max(0, line - 1)] ?? textLength
}

function parsePretextMarkdownFrontmatterEntries({
  language,
  markdown,
}: {
  language: PretextMarkdownFrontmatterLanguage
  markdown: string
}): PretextMarkdownFrontmatterEntry[] {
  const entries: PretextMarkdownFrontmatterEntry[] = []
  let tomlSection: string | null = null
  const lines = markdown.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (language === "toml") {
      const section = /^\s*\[([A-Za-z_][\w.-]*)\]\s*$/.exec(line)
      if (section) {
        tomlSection = section[1]!
        continue
      }
    }

    if (language === "yaml") {
      const entry = parsePretextMarkdownYamlFrontmatterEntry(line)
      if (entry) {
        entries.push(entry)
        continue
      }

      const listEntry = parsePretextMarkdownYamlFrontmatterListEntry(
        line,
        lines,
        index
      )
      if (listEntry) {
        entries.push(listEntry.entry)
        index = listEntry.endIndex
      }
      continue
    }

    const entry = parsePretextMarkdownTomlFrontmatterEntry(line, tomlSection)
    if (entry) entries.push(entry)
  }

  return entries
}

function parsePretextMarkdownYamlFrontmatterEntry(
  line: string
): PretextMarkdownFrontmatterEntry | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return null

  const match = /^([A-Za-z_][\w.-]*)\s*:\s*(.*?)\s*$/.exec(trimmed)
  if (!match) return null
  const value = parsePretextMarkdownFrontmatterScalar(match[2]!)
  if (!value) return null

  return {
    key: match[1]!,
    ...value,
  }
}

function parsePretextMarkdownYamlFrontmatterListEntry(
  line: string,
  lines: readonly string[],
  startIndex: number
): { endIndex: number; entry: PretextMarkdownFrontmatterEntry } | null {
  const match = /^([A-Za-z_][\w.-]*)\s*:\s*$/.exec(line.trim())
  if (!match) return null

  const values: string[] = []
  let endIndex = startIndex
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const itemMatch = /^\s+-\s*(.*?)\s*$/.exec(lines[index]!)
    if (!itemMatch) break

    const value = parsePretextMarkdownFrontmatterScalar(itemMatch[1]!)
    if (!value || value.valueKind === "list") return null
    values.push(value.value)
    endIndex = index
  }

  if (!values.length) return null

  return {
    endIndex,
    entry: {
      key: match[1]!,
      value: values.join(", "),
      valueKind: "list",
    },
  }
}

function parsePretextMarkdownTomlFrontmatterEntry(
  line: string,
  section: string | null
): PretextMarkdownFrontmatterEntry | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) {
    return null
  }

  const match = /^([A-Za-z_][\w.-]*)\s*=\s*(.*?)\s*$/.exec(trimmed)
  if (!match) return null
  const value = parsePretextMarkdownFrontmatterScalar(match[2]!)
  if (!value) return null

  return {
    key: section ? `${section}.${match[1]!}` : match[1]!,
    ...value,
  }
}

function parsePretextMarkdownFrontmatterScalar(
  rawValue: string
): Pick<PretextMarkdownFrontmatterEntry, "value" | "valueKind"> | null {
  const value = rawValue.trim()
  if (!value) return null

  const list = parsePretextMarkdownFrontmatterInlineList(value)
  if (list) {
    return {
      value: list.join(", "),
      valueKind: "list",
    }
  }

  if (/^[{[>|]/.test(value)) return null

  return parsePretextMarkdownFrontmatterScalarAtom(value)
}

function parsePretextMarkdownFrontmatterInlineList(
  value: string
): string[] | null {
  if (!value.startsWith("[") || !value.endsWith("]")) return null

  const inner = value.slice(1, -1).trim()
  if (!inner) return null

  const values: string[] = []
  for (const item of inner.split(",")) {
    const scalar = parsePretextMarkdownFrontmatterScalarAtom(item.trim())
    if (!scalar || scalar.valueKind === "list") return null
    values.push(scalar.value)
  }
  return values
}

function parsePretextMarkdownFrontmatterScalarAtom(
  rawValue: string
): Pick<PretextMarkdownFrontmatterEntry, "value" | "valueKind"> | null {
  const value = rawValue.trim()
  if (!value || /^[{[>|]/.test(value)) return null
  const quoted = /^"([^"]*)"$/.exec(value) ?? /^'([^']*)'$/.exec(value)
  if (quoted) {
    return {
      value: quoted[1]!,
      valueKind: "string",
    }
  }

  if (/^(?:true|false)$/i.test(value)) {
    return {
      value: value.toLowerCase(),
      valueKind: "boolean",
    }
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return {
      value,
      valueKind: "number",
    }
  }

  if (/[:#]/.test(value)) return null

  return {
    value,
    valueKind: "string",
  }
}

function createMarkdownBlockId({
  blockIds,
  kind,
  sourceStartLine,
}: {
  blockIds: BlockIdRegistry
  kind: PretextMarkdownBlockKind
  sourceStartLine: number
}) {
  const base = `block-${sourceStartLine}-${kind}`
  const count = blockIds.get(base) ?? 0
  blockIds.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

function pretextMarkdownBlockKindForToken(
  token: PretextMarkdownToken
): PretextMarkdownBlockKind {
  switch (token.kind) {
    case "code":
    case "comment":
    case "definition":
    case "heading":
    case "html":
    case "list":
    case "paragraph":
    case "table":
      return token.kind
    case "hr":
      return "thematicBreak"
    default:
      return "unknown"
  }
}

function createMarkdownHeadingId(text: string, headingIds: HeadingIdRegistry) {
  const base = createPretextMarkdownHeadingSlug(text)
  const count = headingIds.get(base) ?? 0
  headingIds.set(base, count + 1)
  return count === 0 ? base : `${base}-${count}`
}

export function createPretextMarkdownHeadingSlug(text: string) {
  return namespaceMarkdownHeadingId(slugifyMarkdownHeading(text))
}

function namespaceMarkdownHeadingId(slug: string) {
  const base = slug || "section"
  return DOM_CLOBBERING_HEADING_IDS.has(base) ? `section-${base}` : base
}

function slugifyMarkdownHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function normalizeHeadingText(text: string) {
  return decodeMarkdownHeadingEntities(text).replace(/\s+/g, " ").trim()
}

function decodeMarkdownHeadingEntities(text: string) {
  return text.replace(
    /&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi,
    (entity, body: string) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        return decodeMarkdownNumericEntity(entity, body.slice(2), 16)
      }
      if (body.startsWith("#")) {
        return decodeMarkdownNumericEntity(entity, body.slice(1), 10)
      }

      return MARKDOWN_HEADING_NAMED_ENTITIES[body.toLowerCase()] ?? entity
    }
  )
}

function decodeMarkdownNumericEntity(
  entity: string,
  rawCodePoint: string,
  radix: number
) {
  const codePoint = Number.parseInt(rawCodePoint, radix)
  if (
    !Number.isFinite(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    return entity
  }

  try {
    return String.fromCodePoint(codePoint)
  } catch {
    return entity
  }
}

function isChunkLeadToken(token: PretextMarkdownToken) {
  return token.kind === "heading" || token.kind === "hr"
}

export function isHostilePretextMarkdownChunk(markdown: string) {
  try {
    return parsePretextMarkdownTokens(markdown).some((token) =>
      token.kind === "space"
        ? false
        : isHostilePretextMarkdownToken(token, token.raw)
    )
  } catch {
    return markdown.length > 20_000
  }
}

function isHostilePretextMarkdownToken(
  token: PretextMarkdownToken,
  raw: string
) {
  const lineCount = countLines(raw)

  switch (token.kind) {
    case "code":
      return lineCount > 400
    case "table":
      return Math.max(0, lineCount - 2) > 200
    case "paragraph":
      return raw.length > 20_000
    case "list":
      return lineCount > 500
    case "html":
      return raw.length > 20_000
    default:
      return false
  }
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}
