import type {
  LayoutItem,
  LayoutPage,
  LayoutPoint,
  LayoutQuad,
  LayoutRect,
} from "./layout-blocks-types"

export function clampLayoutValue(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function normalizeLayoutRect(
  rect: LayoutRect | undefined,
  page: LayoutPage
): LayoutRect | null {
  if (!rect) return null
  if (
    !Number.isFinite(rect.left) ||
    !Number.isFinite(rect.top) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    page.width <= 0 ||
    page.height <= 0
  ) {
    return null
  }

  const left = clampLayoutValue(rect.left, 0, page.width)
  const top = clampLayoutValue(rect.top, 0, page.height)
  const right = clampLayoutValue(rect.left + rect.width, 0, page.width)
  const bottom = clampLayoutValue(rect.top + rect.height, 0, page.height)
  const width = right - left
  const height = bottom - top

  return width > 0 && height > 0 ? { left, top, width, height } : null
}

export function quadToRect(quad: LayoutQuad): LayoutRect {
  const xValues = quad.map((point) => point.x)
  const yValues = quad.map((point) => point.y)
  const left = Math.min(...xValues)
  const top = Math.min(...yValues)
  const right = Math.max(...xValues)
  const bottom = Math.max(...yValues)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

export function rectToQuad(rect: LayoutRect): LayoutQuad {
  return [
    { x: rect.left, y: rect.top },
    { x: rect.left + rect.width, y: rect.top },
    { x: rect.left + rect.width, y: rect.top + rect.height },
    { x: rect.left, y: rect.top + rect.height },
  ]
}

export function normalizeLayoutQuad(
  quad: LayoutQuad | undefined,
  page: LayoutPage
): LayoutQuad | null {
  if (!quad || page.width <= 0 || page.height <= 0) return null
  const normalizedQuad = quad.map((point) => ({
    x: clampLayoutValue(point.x, 0, page.width),
    y: clampLayoutValue(point.y, 0, page.height),
  })) as LayoutQuad
  const rect = quadToRect(normalizedQuad)

  return rect.width > 0 && rect.height > 0 ? normalizedQuad : null
}

export function normalizeRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized < 45 || normalized >= 315) return 0
  if (normalized < 135) return 90
  if (normalized < 225) return 180
  return 270
}

export function getRotatedPageSize(page: LayoutPage, rotation = page.rotation) {
  const normalizedRotation = normalizeRotation(rotation)
  return normalizedRotation === 90 || normalizedRotation === 270
    ? { width: page.height, height: page.width }
    : { width: page.width, height: page.height }
}

export function rotatePoint(
  point: LayoutPoint,
  page: LayoutPage,
  rotation = page.rotation
): LayoutPoint {
  switch (normalizeRotation(rotation)) {
    case 90:
      return { x: page.height - point.y, y: point.x }
    case 180:
      return { x: page.width - point.x, y: page.height - point.y }
    case 270:
      return { x: point.y, y: page.width - point.x }
    case 0:
    default:
      return point
  }
}

export function rotateQuad(
  quad: LayoutQuad,
  page: LayoutPage,
  rotation = page.rotation
): LayoutQuad {
  return quad.map((point) => rotatePoint(point, page, rotation)) as LayoutQuad
}

export function itemToQuad(
  item: LayoutItem,
  page: LayoutPage
): LayoutQuad | null {
  const quad = normalizeLayoutQuad(item.quad, page)
  if (quad) return quad
  const rect = normalizeLayoutRect(item.rect, page)
  return rect ? rectToQuad(rect) : null
}

export function itemToRect(
  item: LayoutItem,
  page: LayoutPage
): LayoutRect | null {
  const quad = itemToQuad(item, page)
  return quad ? quadToRect(quad) : normalizeLayoutRect(item.rect, page)
}

export function toPercentRect(
  rect: LayoutRect,
  page: LayoutPage,
  rotation = page.rotation
): LayoutRect {
  const size = getRotatedPageSize(page, rotation)
  return {
    left: (rect.left / size.width) * 100,
    top: (rect.top / size.height) * 100,
    width: (rect.width / size.width) * 100,
    height: (rect.height / size.height) * 100,
  }
}

export function toSvgPoints(
  quad: LayoutQuad,
  page: LayoutPage,
  rotation = page.rotation
): string {
  const rotatedQuad = rotateQuad(quad, page, rotation)
  const size = getRotatedPageSize(page, rotation)

  return rotatedQuad
    .map(
      (point) =>
        `${(point.x / size.width) * 100},${(point.y / size.height) * 100}`
    )
    .join(" ")
}

export function getScrollTarget(item: LayoutItem, page: LayoutPage) {
  const rect = itemToRect(item, page)

  return {
    pageNumber: item.pageNumber,
    left: rect ? (rect.left / page.width) * 100 : 0,
    top: rect ? (rect.top / page.height) * 100 : 0,
    width: rect ? (rect.width / page.width) * 100 : 0,
    height: rect ? (rect.height / page.height) * 100 : 0,
  }
}
