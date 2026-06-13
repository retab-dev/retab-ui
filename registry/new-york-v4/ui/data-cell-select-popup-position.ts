export type DataCellSelectPopupPosition = {
  left: number
  top: number
  width: number
  maxHeight: number
}

export type DataCellSelectPopupRect = Pick<
  DOMRect,
  "bottom" | "left" | "top" | "width"
>

export type DataCellSelectPopupViewport = {
  width: number
  height: number
}

const popupGapPx = 4
const viewportMarginPx = 8
const minimumPopupHeightPx = 64

export function getDataCellSelectPopupPosition({
  anchorRect,
  viewport,
}: {
  anchorRect: DataCellSelectPopupRect
  viewport: DataCellSelectPopupViewport
}): DataCellSelectPopupPosition {
  const availableBelow = viewport.height - anchorRect.bottom - viewportMarginPx
  const availableAbove = anchorRect.top - viewportMarginPx
  const shouldPlaceAbove =
    availableBelow < minimumPopupHeightPx && availableAbove > availableBelow
  const maxHeight = Math.max(
    minimumPopupHeightPx,
    shouldPlaceAbove ? availableAbove - popupGapPx : availableBelow - popupGapPx
  )
  const top = shouldPlaceAbove
    ? Math.max(viewportMarginPx, anchorRect.top - popupGapPx - maxHeight)
    : Math.min(
        anchorRect.bottom + popupGapPx,
        viewport.height - viewportMarginPx
      )
  const left = Math.min(
    Math.max(viewportMarginPx, anchorRect.left),
    Math.max(
      viewportMarginPx,
      viewport.width - anchorRect.width - viewportMarginPx
    )
  )

  return {
    left,
    top,
    width: anchorRect.width,
    maxHeight,
  }
}
