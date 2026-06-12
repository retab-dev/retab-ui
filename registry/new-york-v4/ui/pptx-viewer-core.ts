export interface PptxSize {
  width: number
  height: number
}

export interface PptxSlideOverlayProps {
  /** 1-based slide index. */
  slideNumber: number
  /** Rendered slide size in CSS pixels, after scale and rotation. */
  width: number
  height: number
  scale: number
  rotation: number
}

export interface PptxResetInput {
  src: string
  scale?: number
  defaultScale?: number
  eager?: boolean
}

export interface PptxBitmapCacheInput {
  slideIndex: number
  renderScale: number
}

export const DEFAULT_PPTX_SLIDE_SIZE = {
  width: 960,
  height: 720,
} satisfies PptxSize

export function getPptxFitScale(
  containerWidth: number | null,
  baseWidth: number
) {
  if (!containerWidth || !Number.isFinite(containerWidth) || baseWidth <= 0) {
    return 1
  }
  return clamp((containerWidth - 32) / baseWidth, 0.1, 5)
}

export function getPptxResetKey({
  src,
  scale,
  defaultScale,
  eager,
}: PptxResetInput) {
  return [
    src,
    scale ?? defaultScale ?? "fit",
    eager ? "eager" : "settled",
  ].join("\u0000")
}

export function getPptxBitmapCacheKey({
  slideIndex,
  renderScale,
}: PptxBitmapCacheInput) {
  return `${slideIndex}@${Math.round(renderScale * 1000)}`
}

export function getScaledSlideSize(
  baseSize: PptxSize,
  zoomScale: number
): PptxSize {
  return {
    width: baseSize.width * zoomScale,
    height: baseSize.height * zoomScale,
  }
}

export function getVisibleSlideSize(
  slideSize: PptxSize,
  rotation: number
): PptxSize {
  return getRotatedSize(slideSize, rotation)
}

export function getRotatedSize(size: PptxSize, rotation: number): PptxSize {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 90 || normalized === 270) {
    return { width: size.height, height: size.width }
  }
  return size
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
