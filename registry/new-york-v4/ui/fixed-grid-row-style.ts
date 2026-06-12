import type * as React from "react"

export function getFixedGridRowStyle({
  gridTemplate,
  rowHeight,
  top,
  contain = true,
}: {
  gridTemplate?: string
  rowHeight: number
  top: number
  contain?: boolean
}): React.CSSProperties {
  const style: React.CSSProperties = {
    height: rowHeight,
    minHeight: rowHeight,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: `translate3d(0, ${top}px, 0)`,
  }
  if (gridTemplate) style.gridTemplateColumns = gridTemplate
  if (contain) style.contain = "layout paint style"
  return style
}
