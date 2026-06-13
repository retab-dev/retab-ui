import {
  normalizeLayoutQuad,
  quadToRect,
} from "./layout-blocks-geometry"
import type {
  LayoutDocument,
  LayoutItem,
  LayoutKind,
  LayoutLevel,
  LayoutPage,
  LayoutPoint,
  LayoutQuad,
  LayoutTextSpan,
} from "./layout-blocks-types"

type DocumentAiTextSegment = {
  startIndex?: string
  endIndex?: string
}

type DocumentAiLayout = {
  textAnchor?: {
    textSegments?: DocumentAiTextSegment[]
  }
  confidence?: number
  boundingPoly?: {
    vertices?: Array<{ x?: number; y?: number }>
    normalizedVertices?: Array<{ x?: number; y?: number }>
  }
  orientation?: number
}

type DocumentAiLayoutNode = {
  layout?: DocumentAiLayout
}

type DocumentAiPage = {
  pageNumber?: number
  dimension?: {
    width?: number
    height?: number
    unit?: string
  }
  image?: {
    content?: string
    mimeType?: string
    width?: number
    height?: number
  }
  layout?: DocumentAiLayout
  blocks?: DocumentAiLayoutNode[]
  paragraphs?: DocumentAiLayoutNode[]
  lines?: DocumentAiLayoutNode[]
  tokens?: DocumentAiLayoutNode[]
}

export type DocumentAiDocument = {
  text?: string
  pages?: DocumentAiPage[]
  mimeType?: string
  uri?: string
}

export function documentAiToLayoutDocument(
  input: DocumentAiDocument
): LayoutDocument {
  const text = input.text ?? ""
  const pages = (input.pages ?? []).flatMap((page, pageIndex) =>
    documentAiPageToLayoutPage(page, pageIndex)
  )
  const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]))
  const items = (input.pages ?? []).flatMap((page, pageIndex) => {
    const pageNumber = page.pageNumber ?? pageIndex + 1
    const layoutPage = pagesByNumber.get(pageNumber)
    if (!layoutPage) return []

    const pageItems = [
      ...documentAiNodesToLayoutItems({
        nodes: page.blocks ?? [],
        level: "block",
        page: layoutPage,
        text,
      }),
      ...documentAiNodesToLayoutItems({
        nodes: page.paragraphs ?? [],
        level: "paragraph",
        page: layoutPage,
        text,
      }),
      ...documentAiNodesToLayoutItems({
        nodes: page.lines ?? [],
        level: "line",
        page: layoutPage,
        text,
      }),
      ...documentAiNodesToLayoutItems({
        nodes: page.tokens ?? [],
        level: "word",
        page: layoutPage,
        text,
      }),
    ]

    return assignDocumentAiParents(pageItems)
  })

  return { text, pages, items }
}

export function documentAiPageToDataUrl(page: DocumentAiPage) {
  if (!page.image?.content) return undefined
  return `data:${page.image.mimeType ?? "image/png"};base64,${
    page.image.content
  }`
}

function documentAiPageToLayoutPage(
  page: DocumentAiPage,
  pageIndex: number
): LayoutPage[] {
  const pageNumber = page.pageNumber ?? pageIndex + 1
  const width = finitePositiveNumber(page.dimension?.width ?? page.image?.width)
  const height = finitePositiveNumber(
    page.dimension?.height ?? page.image?.height
  )

  if (!width || !height) return []

  return [
    {
      pageNumber,
      width,
      height,
      rotation: documentAiOrientationToRotation(page.layout?.orientation),
    },
  ]
}

function documentAiNodesToLayoutItems({
  nodes,
  level,
  page,
  text,
}: {
  nodes: DocumentAiLayoutNode[]
  level: LayoutLevel
  page: LayoutPage
  text: string
}): LayoutItem[] {
  return nodes.flatMap((node, index) => {
    const layout = node.layout
    if (!layout) return []

    const span = documentAiTextSpan(layout, text.length)
    const nodeText = span ? text.slice(span.start, span.end) : ""
    const quad = documentAiLayoutQuad(layout, page)
    const normalizedQuad = normalizeLayoutQuad(quad, page)
    if (!normalizedQuad) return []

    return {
      id: documentAiLayoutItemId({ page, level, index, span }),
      pageNumber: page.pageNumber,
      level,
      kind: documentAiLayoutKind(level, nodeText),
      text: nodeText,
      confidence: normalizeConfidence(layout.confidence),
      quad: normalizedQuad,
      rect: quadToRect(normalizedQuad),
      span,
    }
  })
}

function documentAiTextSpan(
  layout: DocumentAiLayout,
  textLength: number
): LayoutTextSpan | undefined {
  const segments = layout.textAnchor?.textSegments ?? []
  if (!segments.length) return undefined

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

function parseTextIndex(value: string | undefined, fallback: number) {
  if (value == null) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampTextIndex(value: number, textLength: number) {
  return Math.min(textLength, Math.max(0, Math.trunc(value)))
}

function documentAiLayoutQuad(
  layout: DocumentAiLayout,
  page: LayoutPage
): LayoutQuad | undefined {
  const vertices = layout.boundingPoly?.vertices
  if (vertices && vertices.length >= 4) {
    return vertices.slice(0, 4).map((vertex) => ({
      x: vertex.x ?? 0,
      y: vertex.y ?? 0,
    })) as LayoutQuad
  }

  const normalizedVertices = layout.boundingPoly?.normalizedVertices
  if (normalizedVertices && normalizedVertices.length >= 4) {
    return normalizedVertices.slice(0, 4).map((vertex) => ({
      x: (vertex.x ?? 0) * page.width,
      y: (vertex.y ?? 0) * page.height,
    })) as LayoutQuad
  }
}

function documentAiLayoutItemId({
  page,
  level,
  index,
  span,
}: {
  page: LayoutPage
  level: LayoutLevel
  index: number
  span?: LayoutTextSpan
}) {
  const spanKey = span ? `${span.start}-${span.end}` : "no-span"
  return `document-ai:p${page.pageNumber}:${level}:${index}:${spanKey}`
}

function documentAiLayoutKind(
  level: LayoutLevel,
  text: string
): LayoutKind {
  const trimmedText = text.trim()
  if (/^\d+$/.test(trimmedText)) return "pageNumber"
  if (level === "paragraph" || level === "block") return "paragraph"
  return "other"
}

function documentAiOrientationToRotation(
  orientation: number | undefined
): 0 | 90 | 180 | 270 {
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

function normalizeConfidence(confidence: number | undefined) {
  if (!Number.isFinite(confidence)) return undefined
  return Math.min(1, Math.max(0, confidence))
}

function finitePositiveNumber(value: number | undefined) {
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function assignDocumentAiParents(items: LayoutItem[]) {
  const blocks = items.filter((item) => item.level === "block")
  const paragraphs = items.filter((item) => item.level === "paragraph")
  const lines = items.filter((item) => item.level === "line")

  return items.map((item) => {
    if (item.level === "paragraph") {
      return { ...item, parentId: findSmallestContainingSpan(item, blocks)?.id }
    }
    if (item.level === "line") {
      return {
        ...item,
        parentId: findSmallestContainingSpan(item, paragraphs)?.id,
      }
    }
    if (item.level === "word") {
      return { ...item, parentId: findSmallestContainingSpan(item, lines)?.id }
    }
    return item
  })
}

function findSmallestContainingSpan(
  item: LayoutItem,
  candidates: LayoutItem[]
): LayoutItem | undefined {
  if (!item.span) return undefined
  let parent: LayoutItem | undefined
  let parentLength = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (!candidate.span) continue
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
