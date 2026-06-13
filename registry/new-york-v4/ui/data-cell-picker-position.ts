import type * as React from "react"

export function getDataCellPickerPopupStyle({
  kind,
  rect,
  viewportWidth,
  viewportHeight,
}: {
  kind: "date" | "time" | "date-time"
  rect: DOMRect
  viewportWidth: number
  viewportHeight: number
}): React.CSSProperties {
  const margin = 8
  const estimatedWidth = kind === "time" ? 220 : 330
  const estimatedHeight = kind === "time" ? 80 : kind === "date" ? 330 : 390
  const left = Math.min(
    Math.max(margin, rect.left),
    Math.max(margin, viewportWidth - estimatedWidth - margin)
  )
  const top =
    rect.bottom + margin + estimatedHeight > viewportHeight
      ? Math.max(margin, rect.top - estimatedHeight - 4)
      : rect.bottom + 4

  return { position: "fixed", top, left, zIndex: 50 }
}
