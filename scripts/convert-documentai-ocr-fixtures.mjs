#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"

const DEFAULT_INPUT = "sample/documentai-output.json"
const DEFAULT_TEXTRACT_OUTPUT = "sample/textract-output.json"
const DEFAULT_AZURE_OUTPUT = "sample/azure-output.json"

const [inputPath = DEFAULT_INPUT] = process.argv.slice(2)

const documentAi = JSON.parse(await readFile(inputPath, "utf8"))
const textract = documentAiToTextract(documentAi)
const azure = documentAiToAzure(documentAi)

await writeJson(DEFAULT_TEXTRACT_OUTPUT, textract)
await writeJson(DEFAULT_AZURE_OUTPUT, azure)

console.log(
  [
    `Converted ${inputPath}`,
    `  ${DEFAULT_TEXTRACT_OUTPUT}: ${textract.Blocks.length} blocks`,
    `  ${DEFAULT_AZURE_OUTPUT}: ${azure.analyzeResult.pages.length} pages`,
  ].join("\n")
)

function documentAiToTextract(input) {
  const pages = layoutPages(input)
  const blocks = []

  for (const page of pages) {
    const lineEntries = (page.source.lines ?? [])
      .map((node, index) => layoutNodeEntry(input, page, node, "line", index))
      .filter(Boolean)
    const wordEntries = (page.source.tokens ?? [])
      .map((node, index) => layoutNodeEntry(input, page, node, "word", index))
      .filter(Boolean)
    const layoutEntries = (page.source.blocks ?? [])
      .map((node, index) => layoutNodeEntry(input, page, node, "block", index))
      .filter(Boolean)

    const lineIdsByParentId = new Map()
    const wordIdsByLineId = new Map()

    for (const line of lineEntries) {
      const parent = findSmallestContainingSpan(line, layoutEntries)
      if (!parent) continue
      const ids = lineIdsByParentId.get(parent.id) ?? []
      ids.push(line.id)
      lineIdsByParentId.set(parent.id, ids)
    }

    for (const word of wordEntries) {
      const parent = findSmallestContainingSpan(word, lineEntries)
      if (!parent) continue
      const ids = wordIdsByLineId.get(parent.id) ?? []
      ids.push(word.id)
      wordIdsByLineId.set(parent.id, ids)
    }

    const lineIdsWithLayoutParent = new Set(
      [...lineIdsByParentId.values()].flat()
    )
    const orphanLineIds = lineEntries
      .filter((line) => !lineIdsWithLayoutParent.has(line.id))
      .map((line) => line.id)
    const pageChildIds = [
      ...layoutEntries.map((entry) => entry.id),
      ...orphanLineIds,
    ]

    blocks.push({
      BlockType: "PAGE",
      Id: pageId(page.pageNumber),
      Page: page.pageNumber,
      Geometry: normalizedPageGeometry(),
      Relationships: childRelationships(pageChildIds),
    })

    for (const entry of layoutEntries) {
      blocks.push({
        BlockType: textractLayoutBlockType(entry),
        Id: entry.id,
        Page: page.pageNumber,
        Geometry: textractGeometry(entry, page),
        Relationships: childRelationships(
          lineIdsByParentId.get(entry.id) ?? []
        ),
      })
    }

    for (const entry of lineEntries) {
      blocks.push({
        BlockType: "LINE",
        Id: entry.id,
        Page: page.pageNumber,
        Text: cleanTextractText(entry.text),
        Confidence: toTextractConfidence(entry.confidence),
        Geometry: textractGeometry(entry, page),
        Relationships: childRelationships(wordIdsByLineId.get(entry.id) ?? []),
      })
    }

    for (const entry of wordEntries) {
      blocks.push({
        BlockType: "WORD",
        Id: entry.id,
        Page: page.pageNumber,
        Text: cleanTextractText(entry.text),
        TextType: "PRINTED",
        Confidence: toTextractConfidence(entry.confidence),
        Geometry: textractGeometry(entry, page),
      })
    }
  }

  return {
    DocumentMetadata: {
      Pages: pages.length,
      PageSizes: pages.map((page) => ({
        Page: page.pageNumber,
        Width: page.width,
        Height: page.height,
      })),
    },
    AnalyzeDocumentModelVersion: "documentai-derived-fixture",
    Blocks: blocks,
  }
}

function documentAiToAzure(input) {
  const pages = layoutPages(input)

  return {
    status: "succeeded",
    createdDateTime: "2024-11-30T12:00:00Z",
    lastUpdatedDateTime: "2024-11-30T12:00:04Z",
    analyzeResult: {
      apiVersion: "2024-11-30",
      modelId: "prebuilt-layout",
      stringIndexType: "textElements",
      content: input.text ?? "",
      pages: pages.map((page) => azurePage(input, page)),
      paragraphs: pages.flatMap((page) => azureParagraphs(input, page)),
    },
  }
}

function azurePage(input, page) {
  return {
    pageNumber: page.pageNumber,
    angle: documentAiOrientationToAngle(page.source.layout?.orientation),
    width: page.width,
    height: page.height,
    unit: "pixel",
    words: (page.source.tokens ?? [])
      .map((node) => azureWord(input, page, node))
      .filter(Boolean),
    lines: (page.source.lines ?? [])
      .map((node) => azureLine(input, page, node))
      .filter(Boolean),
  }
}

function azureParagraphs(input, page) {
  return (page.source.paragraphs ?? [])
    .map((node) => {
      const entry = layoutNodeEntry(input, page, node, "paragraph", 0)
      if (!entry) return undefined
      return {
        role: azureParagraphRole(entry),
        content: entry.text,
        boundingRegions: [
          {
            pageNumber: page.pageNumber,
            polygon: flattenQuad(entry.quad),
          },
        ],
        spans: [azureSpan(entry.span)],
      }
    })
    .filter(Boolean)
}

function azureLine(input, page, node) {
  const entry = layoutNodeEntry(input, page, node, "line", 0)
  if (!entry) return undefined
  return {
    content: entry.text,
    polygon: flattenQuad(entry.quad),
    spans: [azureSpan(entry.span)],
  }
}

function azureWord(input, page, node) {
  const entry = layoutNodeEntry(input, page, node, "word", 0)
  if (!entry) return undefined
  return {
    content: cleanWordText(entry.text),
    polygon: flattenQuad(entry.quad),
    confidence: normalizeConfidence(entry.confidence),
    span: azureSpan(entry.span),
  }
}

function layoutPages(input) {
  return (input.pages ?? [])
    .map((page, index) => {
      const pageNumber = page.pageNumber ?? index + 1
      const width = finitePositiveNumber(
        page.dimension?.width ?? page.image?.width
      )
      const height = finitePositiveNumber(
        page.dimension?.height ?? page.image?.height
      )
      if (!width || !height) return undefined
      return { source: page, pageNumber, width, height }
    })
    .filter(Boolean)
}

function layoutNodeEntry(input, page, node, level, index) {
  const layout = node.layout
  if (!layout) return undefined
  const span = documentAiTextSpan(layout, (input.text ?? "").length)
  const quad = documentAiLayoutQuad(layout, page)
  if (!span || !quad) return undefined
  return {
    id: textractId(page.pageNumber, level, index, span),
    pageNumber: page.pageNumber,
    level,
    text: (input.text ?? "").slice(span.start, span.end),
    confidence: normalizeConfidence(layout.confidence),
    quad,
    span,
  }
}

function documentAiTextSpan(layout, textLength) {
  const segments = layout.textAnchor?.textSegments ?? []
  if (segments.length === 0) return undefined

  let start = textLength
  let end = 0
  for (const segment of segments) {
    const segmentStart = parseTextIndex(segment.startIndex, 0)
    const segmentEnd = parseTextIndex(segment.endIndex, segmentStart)
    start = Math.min(start, segmentStart)
    end = Math.max(end, segmentEnd)
  }

  start = clampTextIndex(start, textLength)
  end = clampTextIndex(end, textLength)

  return end >= start ? { start, end } : undefined
}

function documentAiLayoutQuad(layout, page) {
  const vertices = layout.boundingPoly?.vertices
  if (vertices?.length >= 4) {
    return vertices.slice(0, 4).map((vertex) => ({
      x: clamp(vertex.x ?? 0, 0, page.width),
      y: clamp(vertex.y ?? 0, 0, page.height),
    }))
  }

  const normalizedVertices = layout.boundingPoly?.normalizedVertices
  if (normalizedVertices?.length >= 4) {
    return normalizedVertices.slice(0, 4).map((vertex) => ({
      x: clamp((vertex.x ?? 0) * page.width, 0, page.width),
      y: clamp((vertex.y ?? 0) * page.height, 0, page.height),
    }))
  }
}

function textractGeometry(entry, page) {
  const polygon = entry.quad.map((point) => ({
    X: round(point.x / page.width),
    Y: round(point.y / page.height),
  }))
  return {
    BoundingBox: boundingBoxForPolygon(polygon),
    Polygon: polygon,
  }
}

function normalizedPageGeometry() {
  return {
    BoundingBox: { Width: 1, Height: 1, Left: 0, Top: 0 },
    Polygon: [
      { X: 0, Y: 0 },
      { X: 1, Y: 0 },
      { X: 1, Y: 1 },
      { X: 0, Y: 1 },
    ],
  }
}

function boundingBoxForPolygon(polygon) {
  const xValues = polygon.map((point) => point.X)
  const yValues = polygon.map((point) => point.Y)
  const left = Math.min(...xValues)
  const top = Math.min(...yValues)
  const right = Math.max(...xValues)
  const bottom = Math.max(...yValues)
  return {
    Width: round(right - left),
    Height: round(bottom - top),
    Left: round(left),
    Top: round(top),
  }
}

function textractLayoutBlockType(entry) {
  const text = cleanTextractText(entry.text)
  if (/^\d+$/.test(text)) return "LAYOUT_PAGE_NUMBER"
  if (text.length > 8 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return "LAYOUT_TITLE"
  }
  return "LAYOUT_TEXT"
}

function azureParagraphRole(entry) {
  const text = entry.text.trim()
  if (/^\d+$/.test(text)) return "pageNumber"
  if (text.length > 8 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return "title"
  }
  return undefined
}

function findSmallestContainingSpan(item, candidates) {
  let parent
  let parentLength = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (
      candidate.span.start > item.span.start ||
      candidate.span.end < item.span.end
    ) {
      continue
    }

    const candidateLength = candidate.span.end - candidate.span.start
    if (candidateLength < parentLength) {
      parent = candidate
      parentLength = candidateLength
    }
  }

  return parent
}

function childRelationships(ids) {
  return ids.length > 0 ? [{ Type: "CHILD", Ids: ids }] : undefined
}

function flattenQuad(quad) {
  return quad.flatMap((point) => [round(point.x), round(point.y)])
}

function azureSpan(span) {
  return { offset: span.start, length: span.end - span.start }
}

function pageId(pageNumber) {
  return `documentai-page-${String(pageNumber).padStart(4, "0")}`
}

function textractId(pageNumber, level, index, span) {
  return [
    "documentai",
    `p${String(pageNumber).padStart(4, "0")}`,
    level,
    String(index + 1).padStart(5, "0"),
    `${span.start}-${span.end}`,
  ].join("-")
}

function cleanTextractText(text) {
  return text.replace(/\s+/g, " ").trim()
}

function cleanWordText(text) {
  return text.trim()
}

function documentAiOrientationToAngle(orientation) {
  switch (orientation) {
    case 2:
      return 90
    case 3:
      return 180
    case 4:
      return 270
    case 1:
    default:
      return 0
  }
}

function toTextractConfidence(confidence) {
  return round(normalizeConfidence(confidence) * 100)
}

function normalizeConfidence(confidence) {
  if (confidence == null || !Number.isFinite(confidence)) return 1
  return Math.min(1, Math.max(0, confidence))
}

function parseTextIndex(value, fallback) {
  if (value == null) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampTextIndex(value, textLength) {
  return Math.min(textLength, Math.max(0, Math.trunc(value)))
}

function finitePositiveNumber(value) {
  if (value == null || !Number.isFinite(value)) return undefined
  return value > 0 ? value : undefined
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function round(value) {
  return Number(value.toFixed(6))
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
