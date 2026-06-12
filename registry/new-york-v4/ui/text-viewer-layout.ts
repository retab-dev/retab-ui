import type { NormalizedTextLineRange } from "@/components/ui/text-viewer-ranges"

export const LINE_SCROLL_HEADROOM = 64

export interface LineRangeRects {
  startTop: number
  endBottom: number
  viewportTop: number
  viewportScrollTop: number
  viewportHeight: number
}

export interface LineRangeMetrics {
  startLine: number
  endLine: number
  lineHeight: number
  viewportHeight: number
  paddingStart?: number
}

export function findLineElement(
  viewportElement: HTMLElement,
  lineNumber: number
): HTMLElement | null {
  if (!Number.isInteger(lineNumber) || lineNumber < 1) return null
  return viewportElement.querySelector<HTMLElement>(
    `[data-line-number="${lineNumber}"]`
  )
}

export function scrollTopForLineRange({
  startTop,
  endBottom,
  viewportTop,
  viewportScrollTop,
  viewportHeight,
}: LineRangeRects) {
  const rangeTop = startTop - viewportTop + viewportScrollTop
  const rangeBottom = endBottom - viewportTop + viewportScrollTop
  const rangeHeight = rangeBottom - rangeTop
  const targetTop =
    rangeHeight <= viewportHeight
      ? rangeTop - (viewportHeight - rangeHeight) / 2
      : rangeTop - LINE_SCROLL_HEADROOM

  return Math.max(0, targetTop)
}

export function scrollTopForLineRangeMetrics({
  startLine,
  endLine,
  lineHeight,
  viewportHeight,
  paddingStart = 0,
}: LineRangeMetrics) {
  const rangeTop = paddingStart + (startLine - 1) * lineHeight
  const rangeBottom = paddingStart + endLine * lineHeight
  const rangeHeight = rangeBottom - rangeTop
  const targetTop =
    rangeHeight <= viewportHeight
      ? rangeTop - (viewportHeight - rangeHeight) / 2
      : rangeTop - LINE_SCROLL_HEADROOM

  return Math.max(0, targetTop)
}

export function scrollLineRangeIntoView({
  viewportElement,
  range,
  options,
}: {
  viewportElement: HTMLDivElement | null
  range: NormalizedTextLineRange | null
  options?: ScrollToOptions
}) {
  if (!viewportElement || !range) return

  const startLineElement = findLineElement(viewportElement, range.start)
  const endLineElement = findLineElement(viewportElement, range.end)
  if (!startLineElement || !endLineElement) return

  const startLineRect = startLineElement.getBoundingClientRect()
  const endLineRect = endLineElement.getBoundingClientRect()
  const viewportRect = viewportElement.getBoundingClientRect()

  viewportElement.scrollTo({
    top: scrollTopForLineRange({
      startTop: startLineRect.top,
      endBottom: endLineRect.bottom,
      viewportTop: viewportRect.top,
      viewportScrollTop: viewportElement.scrollTop,
      viewportHeight: viewportElement.clientHeight,
    }),
    behavior: "smooth",
    ...options,
  })
}

export function scrollLineRangeMetricsIntoView({
  viewportElement,
  range,
  lineHeight,
  paddingStart,
  options,
}: {
  viewportElement: HTMLDivElement | null
  range: NormalizedTextLineRange | null
  lineHeight: number
  paddingStart?: number
  options?: ScrollToOptions
}) {
  if (!viewportElement || !range) return

  viewportElement.scrollTo({
    top: scrollTopForLineRangeMetrics({
      startLine: range.start,
      endLine: range.end,
      lineHeight,
      paddingStart,
      viewportHeight: viewportElement.clientHeight,
    }),
    behavior: "smooth",
    ...options,
  })
}
