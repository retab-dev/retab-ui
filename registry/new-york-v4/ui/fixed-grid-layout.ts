import type * as React from "react"

type CssLength = number | string

export function getFixedGridCanvasStyle({
  width,
  minWidth = "100%",
  contain = false,
}: {
  width?: CssLength
  minWidth?: CssLength
  contain?: boolean
}): React.CSSProperties {
  return {
    width: formatCssLength(width),
    minWidth: formatCssLength(minWidth),
    position: "relative",
    ...(contain ? { contain: "layout paint style" } : null),
  }
}

export function getFixedGridRowWindowStyle({
  height,
  minWidth,
}: {
  height: CssLength
  minWidth?: CssLength
}): React.CSSProperties {
  return {
    position: "relative",
    height: formatCssLength(height),
    minWidth: formatCssLength(minWidth),
  }
}

function formatCssLength(value: CssLength | undefined) {
  return typeof value === "number" ? `${value}px` : value
}
