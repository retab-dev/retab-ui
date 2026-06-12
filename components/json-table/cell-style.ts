import type { CSSProperties } from "react"

const widthStyleCache = new Map<number, CSSProperties>()
const selectableWidthStyleCache = new Map<number, CSSProperties>()

export function getCellWidthStyle(widthPx: number): CSSProperties {
  const cached = widthStyleCache.get(widthPx)
  if (cached) return cached

  const style = {
    width: `${widthPx}px`,
    minWidth: `${widthPx}px`,
  }
  widthStyleCache.set(widthPx, style)
  return style
}

export function getSelectableCellWidthStyle(widthPx: number): CSSProperties {
  const cached = selectableWidthStyleCache.get(widthPx)
  if (cached) return cached

  const style = {
    width: `${widthPx}px`,
    minWidth: `${widthPx}px`,
    userSelect: "none",
  } satisfies CSSProperties
  selectableWidthStyleCache.set(widthPx, style)
  return style
}
