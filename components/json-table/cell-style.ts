import type { CSSProperties } from "react"

const widthStyleCache = new Map<number, CSSProperties>()
const selectableWidthStyleCache = new Map<number, CSSProperties>()

export const interactiveCellOverlayClass =
  "after:pointer-events-none after:absolute after:inset-0 after:z-10 after:border after:border-transparent hover:after:border-foreground data-[active=true]:after:border-foreground"

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
