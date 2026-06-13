export const CODE_VIEWER_BASE_FONT_PX = 12
export const CODE_VIEWER_BASE_LINE_PX = 20
export const CODE_VIEWER_MIN_SCALE = 0.25
export const CODE_VIEWER_MAX_SCALE = 5
export const CODE_VIEWER_OVERSCAN = 24
export const CODE_VIEWER_BLOCK_PADDING = 8
export const CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT = 600

export function clampCodeViewerScale(value: number) {
  return Math.min(CODE_VIEWER_MAX_SCALE, Math.max(CODE_VIEWER_MIN_SCALE, value))
}
