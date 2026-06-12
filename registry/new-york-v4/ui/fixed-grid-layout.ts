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
    position: "relative",
    ...cssLengthProperty("width", width),
    ...cssLengthProperty("minWidth", minWidth),
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
    ...cssLengthProperty("height", height),
    ...cssLengthProperty("minWidth", minWidth),
  }
}

function formatCssLength(value: CssLength | undefined) {
  if (typeof value !== "number") return value
  return Number.isFinite(value) && value >= 0 ? `${value}px` : undefined
}

function cssLengthProperty<Property extends "height" | "minWidth" | "width">(
  property: Property,
  value: CssLength | undefined
): Pick<React.CSSProperties, Property> | object {
  const formattedValue = formatCssLength(value)
  return formattedValue === undefined ? {} : { [property]: formattedValue }
}
