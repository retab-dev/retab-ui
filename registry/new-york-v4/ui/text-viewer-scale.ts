export const TEXT_VIEWER_BASE_FONT_PX = 12
export const TEXT_VIEWER_BASE_LINE_PX = 20
export const TEXT_VIEWER_MIN_SCALE = 0.25
export const TEXT_VIEWER_MAX_SCALE = 5
export const TEXT_VIEWER_OVERSCAN = 24
export const TEXT_VIEWER_BLOCK_PADDING = 8
export const TEXT_VIEWER_INITIAL_VIEWPORT_HEIGHT = 600

export function clampTextViewerScale(value: number) {
  return Math.min(TEXT_VIEWER_MAX_SCALE, Math.max(TEXT_VIEWER_MIN_SCALE, value))
}
