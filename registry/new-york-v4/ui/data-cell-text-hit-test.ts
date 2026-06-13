import {
  measureNaturalWidth,
  prepareWithSegments,
} from "@chenglou/pretext"

type MeasurePrefixWidth = (value: string) => number
type CachedTextMeasurement = {
  widthsByOffset: Map<number, number>
}

const TEXT_MEASUREMENT_CACHE_LIMIT = 500
const textMeasurementCache = new Map<string, CachedTextMeasurement>()

export function getMeasuredTextSelectionOffset({
  measurePrefixWidth,
  targetX,
  value,
}: {
  measurePrefixWidth: MeasurePrefixWidth
  targetX: number
  value: string
}): number {
  if (value.length === 0) return 0

  const boundaries = graphemeBoundaries(value)
  const lastIndex = boundaries.length - 1
  const measuredWidths = new Map<number, number>()
  const widthAtBoundary = (index: number) => {
    const offset = boundaries[index] ?? value.length
    const cached = measuredWidths.get(offset)
    if (cached !== undefined) return cached
    const width = safeMeasuredWidth(() =>
      measurePrefixWidth(value.slice(0, offset))
    )
    measuredWidths.set(offset, width)
    return width
  }
  const fullWidth = widthAtBoundary(lastIndex)
  if (targetX <= 0 || fullWidth <= 0) return 0
  if (targetX >= fullWidth) return value.length

  let low = 0
  let high = lastIndex
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const width = widthAtBoundary(mid)
    if (width < targetX) low = mid + 1
    else high = mid
  }

  const nextIndex = low
  const previousIndex = Math.max(0, nextIndex - 1)
  const previousWidth = widthAtBoundary(previousIndex)
  const nextWidth = widthAtBoundary(nextIndex)

  return targetX - previousWidth <= nextWidth - targetX
    ? (boundaries[previousIndex] ?? 0)
    : (boundaries[nextIndex] ?? value.length)
}

export function getDataCellTextSelectionOffset({
  clientX,
  input,
  value,
}: {
  clientX: number
  input: HTMLInputElement
  value: string
}): number {
  const valueLength = value.length
  if (valueLength === 0) return 0

  const rect = input.getBoundingClientRect()
  if (rect.width <= 0) return valueLength

  const styles = globalThis.getComputedStyle(input)
  const paddingLeft = numericCssPixels(styles.paddingLeft)
  const paddingRight = numericCssPixels(styles.paddingRight)
  const contentLeft = rect.left + paddingLeft
  const contentWidth = Math.max(1, rect.width - paddingLeft - paddingRight)
  const targetX = clientX - contentLeft + input.scrollLeft

  if (!canUsePretextHitTest(styles)) {
    return getLinearTextSelectionOffset({
      contentWidth,
      targetX,
      valueLength,
    })
  }

  const font = styles.font
  const letterSpacing = numericCssPixels(styles.letterSpacing)

  try {
    return getPretextTextSelectionOffset({
      font,
      letterSpacing,
      targetX,
      value,
    })
  } catch {
    return getLinearTextSelectionOffset({
      contentWidth,
      targetX,
      valueLength,
    })
  }
}

export function getDataCellDisplayTextSelectionOffset({
  clientX,
  clientY,
  textElement,
  value,
}: {
  clientX: number
  clientY: number
  textElement: HTMLElement
  value: string
}): number {
  const nativeOffset = getNativeTextSelectionOffset({
    clientX,
    clientY,
    textElement,
    value,
  })
  if (nativeOffset !== null) return nativeOffset

  return getDataCellTextSelectionOffsetFromElement({
    clientX,
    element: textElement,
    value,
  })
}

function getDataCellTextSelectionOffsetFromElement({
  clientX,
  element,
  value,
}: {
  clientX: number
  element: HTMLElement
  value: string
}): number {
  const valueLength = value.length
  if (valueLength === 0) return 0

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0) return valueLength

  const styles = globalThis.getComputedStyle(element)
  const paddingLeft = numericCssPixels(styles.paddingLeft)
  const paddingRight = numericCssPixels(styles.paddingRight)
  const contentLeft = rect.left + paddingLeft
  const contentWidth = Math.max(1, rect.width - paddingLeft - paddingRight)
  const targetX = clientX - contentLeft

  if (!canUsePretextHitTest(styles)) {
    return getLinearTextSelectionOffset({
      contentWidth,
      targetX,
      valueLength,
    })
  }

  const font = styles.font
  const letterSpacing = numericCssPixels(styles.letterSpacing)

  try {
    return getPretextTextSelectionOffset({
      font,
      letterSpacing,
      targetX,
      value,
    })
  } catch {
    return getLinearTextSelectionOffset({
      contentWidth,
      targetX,
      valueLength,
    })
  }
}

function getNativeTextSelectionOffset({
  clientX,
  clientY,
  textElement,
  value,
}: {
  clientX: number
  clientY: number
  textElement: HTMLElement
  value: string
}): number | null {
  const ownerDocument = textElement.ownerDocument
  const documentWithCaretPosition = ownerDocument as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null
  }
  const documentWithCaretRange = ownerDocument as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  const caretPosition = documentWithCaretPosition.caretPositionFromPoint?.(
    clientX,
    clientY
  )
  if (caretPosition) {
    return nativeOffsetFromNode({
      node: caretPosition.offsetNode,
      offset: caretPosition.offset,
      textElement,
      value,
    })
  }

  const caretRange = documentWithCaretRange.caretRangeFromPoint?.(
    clientX,
    clientY
  )
  if (caretRange) {
    return nativeOffsetFromNode({
      node: caretRange.startContainer,
      offset: caretRange.startOffset,
      textElement,
      value,
    })
  }

  return null
}

function nativeOffsetFromNode({
  node,
  offset,
  textElement,
  value,
}: {
  node: Node
  offset: number
  textElement: HTMLElement
  value: string
}): number | null {
  if (!textElement.contains(node)) return null
  const walker = textElement.ownerDocument.createTreeWalker(
    textElement,
    NodeFilter.SHOW_TEXT
  )
  let textOffset = 0
  while (walker.nextNode()) {
    const currentNode = walker.currentNode
    const currentLength = currentNode.textContent?.length ?? 0
    if (currentNode === node) {
      return clampTextOffset(textOffset + offset, value)
    }
    textOffset += currentLength
  }
  return null
}

function clampTextOffset(offset: number, value: string): number {
  return Math.min(value.length, Math.max(0, offset))
}

function getPretextTextSelectionOffset({
  font,
  letterSpacing,
  targetX,
  value,
}: {
  font: string
  letterSpacing: number
  targetX: number
  value: string
}): number {
  const measurement = cachedTextMeasurement({
    font,
    letterSpacing,
    value,
  })

  return getMeasuredTextSelectionOffset({
    value,
    targetX,
    measurePrefixWidth: (prefix) => {
      const offset = prefix.length
      const cached = measurement.widthsByOffset.get(offset)
      if (cached !== undefined) return cached
      const width = measureNaturalWidth(
        prepareWithSegments(prefix, font, {
          letterSpacing,
          whiteSpace: "pre-wrap",
        })
      )
      measurement.widthsByOffset.set(offset, width)
      return width
    },
  })
}

function cachedTextMeasurement({
  font,
  letterSpacing,
  value,
}: {
  font: string
  letterSpacing: number
  value: string
}): CachedTextMeasurement {
  const key = `${font}\n${letterSpacing}\n${value}`
  const cached = textMeasurementCache.get(key)
  if (cached) {
    textMeasurementCache.delete(key)
    textMeasurementCache.set(key, cached)
    return cached
  }

  const measurement: CachedTextMeasurement = {
    widthsByOffset: new Map(),
  }
  textMeasurementCache.set(key, measurement)
  if (textMeasurementCache.size > TEXT_MEASUREMENT_CACHE_LIMIT) {
    const oldestKey = textMeasurementCache.keys().next().value
    if (oldestKey !== undefined) textMeasurementCache.delete(oldestKey)
  }
  return measurement
}

function getLinearTextSelectionOffset({
  contentWidth,
  targetX,
  valueLength,
}: {
  contentWidth: number
  targetX: number
  valueLength: number
}): number {
  const ratio = Math.min(1, Math.max(0, targetX / contentWidth))
  return Math.min(valueLength, Math.max(0, Math.round(ratio * valueLength)))
}

function canUsePretextHitTest(styles: CSSStyleDeclaration): boolean {
  const direction = styles.direction || "ltr"
  const textAlign = styles.textAlign || "start"
  return (
    !isJsdomEnvironment() &&
    direction === "ltr" &&
    (textAlign === "left" || textAlign === "start" || textAlign === "") &&
    styles.font !== ""
  )
}

function isJsdomEnvironment(): boolean {
  return (
    globalThis.navigator?.userAgent.toLowerCase().includes("jsdom") ?? false
  )
}

function graphemeBoundaries(value: string): number[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const boundaries = [0]
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    })
    for (const segment of segmenter.segment(value)) {
      boundaries.push(segment.index + segment.segment.length)
    }
    return boundaries
  }

  const boundaries = [0]
  let offset = 0
  for (const codePoint of Array.from(value)) {
    offset += codePoint.length
    boundaries.push(offset)
  }
  return boundaries
}

function numericCssPixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function safeMeasuredWidth(measure: () => number): number {
  const width = measure()
  return Number.isFinite(width) ? Math.max(0, width) : 0
}
