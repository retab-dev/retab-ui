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
  valueKind: "boolean" | "number" | "string"
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

  return {
    blocks,
    ...(frontmatter ? { frontmatter } : {}),
    headings,
    chunks,
    referenceDefinitionsMarkdown,
    sourceLineCount,
    text: markdown,
    wordCount: countWords(markdown),
  }
}

export function findPretextMarkdownChunkForLine(
  chunks: readonly PretextMarkdownChunk[],
  sourceLine: number
) {
  return chunks.find(
    (chunk) =>
      chunk.sourceStartLine <= sourceLine && chunk.sourceEndLine >= sourceLine
  )
}

export function findPretextMarkdownHeadingById(
  document: PretextMarkdownDocument,
  headingId: string
) {
  return document.headings.find((heading) => heading.id === headingId)
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

  try {
    const tokens = parsePretextMarkdownTokens(markdown)
    let cursorLine = sourceStartLine
    let cursorOffset = getSourceLineStartOffset(
      sourceLineOffsets,
      sourceStartLine
    )
    let chunkBlockIds: string[] = []
    let chunkStartLine = sourceStartLine
    let chunkStartOffset = cursorOffset
    let chunkHeadingIds: string[] = []
    let chunkIsHostile = false
    let chunkRaw = ""
    let chunkLineCount = 0

    const flushChunk = (endLine: number) => {
      if (!chunkRaw.trim()) {
        chunkRaw = ""
        chunkLineCount = 0
        chunkIsHostile = false
        chunkStartLine = endLine + 1
        chunkStartOffset = getSourceLineStartOffset(
          sourceLineOffsets,
          chunkStartLine
        )
        return
      }
      const chunkIndex = startIndex + chunks.length
      const chunkMarkdown = chunkRaw.replace(/\n+$/g, "")
      chunks.push({
        blockIds: chunkBlockIds,
        headingIds: chunkHeadingIds,
        index: chunkIndex,
        isHostile: chunkIsHostile,
        kind: "markdown",
        markdown: chunkMarkdown,
        sourceEndOffset: Math.min(
          textLength,
          chunkStartOffset + chunkMarkdown.length
        ),
        sourceEndLine: Math.max(chunkStartLine, endLine),
        sourceStartOffset: chunkStartOffset,
        sourceStartLine: chunkStartLine,
      })
      chunkRaw = ""
      chunkLineCount = 0
      chunkIsHostile = false
      chunkBlockIds = []
      chunkHeadingIds = []
      chunkStartLine = endLine + 1
      chunkStartOffset = getSourceLineStartOffset(
        sourceLineOffsets,
        chunkStartLine
      )
    }

    for (const token of tokens) {
      const raw = token.raw ?? ""
      const tokenLineCount = countLineBreaks(raw)
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
        chunkRaw += raw
        chunkLineCount += tokenLineBreaks
        continue
      }

      const tokenIsHostile = isHostilePretextMarkdownToken(token, raw)
      const shouldStartNewChunk =
        chunkRaw.trim().length > 0 &&
        isChunkLeadToken(token) &&
        chunkLineCount >= MARKDOWN_CHUNK_TARGET_SOURCE_LINES
      const wouldExceedMax =
        chunkRaw.trim().length > 0 &&
        chunkLineCount + Math.max(1, tokenLineCount) >
          MARKDOWN_CHUNK_MAX_SOURCE_LINES

      if (shouldStartNewChunk || wouldExceedMax || tokenIsHostile) {
        flushChunk(Math.max(chunkStartLine, tokenStartLine - 1))
        chunkStartLine = tokenStartLine
        chunkStartOffset = tokenStartOffset
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
      chunkBlockIds.push(block.id)

      if (token.kind === "heading") {
        const text = normalizeHeadingText(token.text)
        const id = createMarkdownHeadingId(text, headingIds)
        block.headingId = id
        chunkHeadingIds.push(id)
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

      chunkRaw += raw
      chunkLineCount += Math.max(1, tokenLineCount)
      chunkIsHostile = chunkIsHostile || tokenIsHostile
      if (tokenIsHostile || chunkLineCount >= MARKDOWN_CHUNK_MAX_SOURCE_LINES) {
        flushChunk(tokenEndLine)
      }
    }

    if (chunkRaw.trim()) {
      flushChunk(sourceEndLine)
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

function countLineBreaks(text: string) {
  if (!text) return 1
  return text.split(/\r\n|[\n\r\u2028\u2029]/).length
}

function countLineSeparators(text: string) {
  if (!text) return 0
  return Math.max(0, countLineBreaks(text) - 1)
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
  let isTopLevelToml = true

  for (const line of markdown.split(/\r?\n/)) {
    if (language === "toml" && /^\s*\[/.test(line)) {
      isTopLevelToml = false
      continue
    }

    if (language === "toml" && !isTopLevelToml) continue

    const entry =
      language === "toml"
        ? parsePretextMarkdownTomlFrontmatterEntry(line)
        : parsePretextMarkdownYamlFrontmatterEntry(line)
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

function parsePretextMarkdownTomlFrontmatterEntry(
  line: string
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
    key: match[1]!,
    ...value,
  }
}

function parsePretextMarkdownFrontmatterScalar(
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
  const lineCount = countLineBreaks(raw)

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
