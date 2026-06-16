import { normalizeLayoutQuad, quadToRect } from "./layout-blocks-geometry"
import type {
  LayoutDocument,
  LayoutItem,
  LayoutKind,
  LayoutLevel,
  LayoutPage,
  LayoutQuad,
  LayoutTextSpan,
} from "./layout-blocks-types"

type AzureSpan = {
  offset?: number
  length?: number
}

type AzureWord = {
  content?: string
  polygon?: number[]
  confidence?: number
  span?: AzureSpan
}

type AzureLine = {
  content?: string
  polygon?: number[]
  spans?: AzureSpan[]
}

type AzurePage = {
  pageNumber?: number
  angle?: number
  width?: number
  height?: number
  unit?: string
  words?: AzureWord[]
  lines?: AzureLine[]
}

type AzureBoundingRegion = {
  pageNumber?: number
  polygon?: number[]
}

type AzureParagraph = {
  role?: string
  content?: string
  boundingRegions?: AzureBoundingRegion[]
  spans?: AzureSpan[]
}

export type AzureAnalyzeResult = {
  apiVersion?: string
  modelId?: string
  content?: string
  pages?: AzurePage[]
  paragraphs?: AzureParagraph[]
}

export type AzureDocument =
  | AzureAnalyzeResult
  | { analyzeResult?: AzureAnalyzeResult }

export function azureToLayoutDocument(input: AzureDocument): LayoutDocument {
  const result = resolveAnalyzeResult(input)
  const text = result.content ?? ""

  const pages: LayoutPage[] = []
  const pageScaleByNumber = new Map<number, number>()
  ;(result.pages ?? []).forEach((page, index) => {
    const pageNumber = page.pageNumber ?? index + 1
    const scale = azureUnitScale(page.unit)
    const width = finitePositiveNumber((page.width ?? 0) * scale)
    const height = finitePositiveNumber((page.height ?? 0) * scale)
    if (!width || !height) return
    pageScaleByNumber.set(pageNumber, scale)
    pages.push({
      pageNumber,
      width,
      height,
      rotation: normalizeAngle(page.angle),
    })
  })
  const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]))

  const blocks: LayoutItem[] = []
  ;(result.paragraphs ?? []).forEach((paragraph, index) => {
    const region = paragraph.boundingRegions?.[0]
    const pageNumber = region?.pageNumber
    const page = pageNumber != null ? pagesByNumber.get(pageNumber) : undefined
    if (!page) return
    const scale = pageScaleByNumber.get(page.pageNumber) ?? 1
    const item = buildItem({
      id: `azure:p${page.pageNumber}:block:${index}`,
      level: "block",
      kind: azureRoleToKind(paragraph.role),
      text: paragraph.content ?? "",
      page,
      polygon: region?.polygon,
      scale,
      span: azureSpan(paragraph.spans),
    })
    if (item) blocks.push(item)
  })

  const lines: LayoutItem[] = []
  const words: LayoutItem[] = []
  ;(result.pages ?? []).forEach((page, pageIndex) => {
    const pageNumber = page.pageNumber ?? pageIndex + 1
    const layoutPage = pagesByNumber.get(pageNumber)
    if (!layoutPage) return
    const scale = pageScaleByNumber.get(pageNumber) ?? 1

    ;(page.lines ?? []).forEach((line, index) => {
      const item = buildItem({
        id: `azure:p${pageNumber}:line:${index}`,
        level: "line",
        kind: azureTextKind(line.content ?? ""),
        text: line.content ?? "",
        page: layoutPage,
        polygon: line.polygon,
        scale,
        span: azureSpan(line.spans),
      })
      if (item) lines.push(item)
    })

    ;(page.words ?? []).forEach((word, index) => {
      const item = buildItem({
        id: `azure:p${pageNumber}:word:${index}`,
        level: "word",
        kind: azureTextKind(word.content ?? ""),
        text: word.content ?? "",
        page: layoutPage,
        polygon: word.polygon,
        scale,
        span: word.span ? azureSpan([word.span]) : undefined,
        confidence: word.confidence,
      })
      if (item) words.push(item)
    })
  })

  // Derive hierarchy from text-span containment: word → line → block.
  const linkedWords = words.map((word) => ({
    ...word,
    parentId: findSmallestContainingSpan(word, lines)?.id,
  }))
  const linkedLines = lines.map((line) => ({
    ...line,
    parentId: findSmallestContainingSpan(line, blocks)?.id,
  }))

  return { text, pages, items: [...blocks, ...linkedLines, ...linkedWords] }
}

function buildItem({
  id,
  level,
  kind,
  text,
  page,
  polygon,
  scale,
  span,
  confidence,
}: {
  id: string
  level: LayoutLevel
  kind: LayoutKind
  text: string
  page: LayoutPage
  polygon: number[] | undefined
  scale: number
  span?: LayoutTextSpan
  confidence?: number
}): LayoutItem | undefined {
  const quad = azurePolygonToQuad(polygon, scale)
  const normalizedQuad = normalizeLayoutQuad(quad, page)
  if (!normalizedQuad) return undefined

  return {
    id,
    pageNumber: page.pageNumber,
    level,
    kind,
    text,
    confidence: normalizeConfidence(confidence),
    quad: normalizedQuad,
    rect: quadToRect(normalizedQuad),
    span,
  }
}

function resolveAnalyzeResult(input: AzureDocument): AzureAnalyzeResult {
  if (input && "analyzeResult" in input && input.analyzeResult) {
    return input.analyzeResult
  }
  return input as AzureAnalyzeResult
}

function azurePolygonToQuad(
  polygon: number[] | undefined,
  scale: number
): LayoutQuad | undefined {
  if (!polygon || polygon.length < 8) return undefined
  return [
    { x: polygon[0] * scale, y: polygon[1] * scale },
    { x: polygon[2] * scale, y: polygon[3] * scale },
    { x: polygon[4] * scale, y: polygon[5] * scale },
    { x: polygon[6] * scale, y: polygon[7] * scale },
  ]
}

function azureSpan(spans: AzureSpan[] | undefined): LayoutTextSpan | undefined {
  if (!spans || spans.length === 0) return undefined
  let start = Number.POSITIVE_INFINITY
  let end = 0
  for (const span of spans) {
    const offset = span.offset ?? 0
    const length = span.length ?? 0
    start = Math.min(start, offset)
    end = Math.max(end, offset + length)
  }
  if (!Number.isFinite(start) || end < start) return undefined
  return { start, end }
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
    if (candidate.pageNumber !== item.pageNumber) continue
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

function azureUnitScale(unit: string | undefined): number {
  switch (unit) {
    case "inch":
      return 96
    case "centimeter":
      return 96 / 2.54
    case "pixel":
    default:
      return 1
  }
}

function normalizeAngle(angle: number | undefined): 0 | 90 | 180 | 270 {
  if (angle == null || !Number.isFinite(angle)) return 0
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360
  return normalized as 0 | 90 | 180 | 270
}

function azureRoleToKind(role: string | undefined): LayoutKind {
  switch (role) {
    case "title":
      return "title"
    case "sectionHeading":
      return "heading"
    case "pageHeader":
      return "header"
    case "pageFooter":
      return "footer"
    case "pageNumber":
      return "pageNumber"
    case "footnote":
      return "other"
    default:
      return "paragraph"
  }
}

function azureTextKind(text: string): LayoutKind {
  return /^\d+$/.test(text.trim()) ? "pageNumber" : "other"
}

function normalizeConfidence(confidence: number | undefined) {
  if (confidence == null || !Number.isFinite(confidence)) return undefined
  return Math.min(1, Math.max(0, confidence))
}

function finitePositiveNumber(value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined
  return value
}
