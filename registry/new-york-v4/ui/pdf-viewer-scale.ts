import * as React from "react"

export const MIN_PDF_SCALE = 0.25
export const MAX_PDF_SCALE = 5
export const PDF_ZOOM_STEP = 1.2
export const PDF_PAGE_HORIZONTAL_PADDING = 32

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampPdfScale(value: number) {
  return clamp(Number.isFinite(value) ? value : 1, MIN_PDF_SCALE, MAX_PDF_SCALE)
}

export function getPdfFitWidthScale(
  containerWidth: number | null,
  pageWidth: number
) {
  if (!containerWidth || !Number.isFinite(containerWidth) || pageWidth <= 0) {
    return 1
  }
  return clampPdfScale(
    (containerWidth - PDF_PAGE_HORIZONTAL_PADDING) / pageWidth
  )
}

export function useMeasuredElementWidth() {
  const [width, setWidth] = React.useState<number | null>(null)

  const ref = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    setWidth(element.clientWidth)
    if (typeof ResizeObserver === "undefined") return

    let frame = 0
    let latestWidth = element.clientWidth
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        latestWidth = (entry.target as HTMLElement).clientWidth
      }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setWidth(latestWidth)
      })
    })

    observer.observe(element)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return { ref, width }
}

export function usePdfScale({
  controlledScale,
  defaultScale,
  onScaleChange,
  containerWidth,
  pageWidth,
}: {
  controlledScale?: number
  defaultScale?: number
  onScaleChange?: (scale: number | null) => void
  containerWidth: number | null
  pageWidth: number
}) {
  const [uncontrolledRequestedScale, setUncontrolledRequestedScale] =
    React.useState<number | null>(() =>
      defaultScale == null ? null : clampPdfScale(defaultScale)
    )
  const isControlledScale = controlledScale !== undefined
  const fitWidthScale = getPdfFitWidthScale(containerWidth, pageWidth)
  const resolvedScale = isControlledScale
    ? clampPdfScale(controlledScale)
    : (uncontrolledRequestedScale ?? fitWidthScale)

  const setRequestedScale = React.useCallback(
    (nextScale: number | null) => {
      const normalizedScale =
        nextScale == null ? null : clampPdfScale(nextScale)
      if (isControlledScale) {
        onScaleChange?.(normalizedScale)
        return
      }
      setUncontrolledRequestedScale(normalizedScale)
    },
    [isControlledScale, onScaleChange]
  )

  const zoomIn = React.useCallback(
    () => setRequestedScale(resolvedScale * PDF_ZOOM_STEP),
    [resolvedScale, setRequestedScale]
  )
  const zoomOut = React.useCallback(
    () => setRequestedScale(resolvedScale / PDF_ZOOM_STEP),
    [resolvedScale, setRequestedScale]
  )
  const fitWidth = React.useCallback(
    () => setRequestedScale(null),
    [setRequestedScale]
  )

  return {
    resolvedScale,
    requestedScale: isControlledScale
      ? controlledScale == null
        ? null
        : clampPdfScale(controlledScale)
      : uncontrolledRequestedScale,
    setRequestedScale,
    zoomIn,
    zoomOut,
    fitWidth,
  }
}
