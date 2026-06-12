import * as React from "react"

import {
  getPdfVisiblePageNumbers,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout"

export function usePdfPageVirtualization({
  layout,
  viewportElement,
}: {
  layout: PdfPageLayoutModel
  viewportElement: HTMLDivElement | null
}) {
  const measureFrameRef = React.useRef(0)
  const [visiblePageNumbers, setVisiblePageNumbers] = React.useState<
    readonly number[]
  >(() => [1])

  const measureVisiblePagesNow = React.useCallback(() => {
    measureFrameRef.current = 0
    const scrollTop = viewportElement?.scrollTop ?? 0
    const viewportHeight = viewportElement?.clientHeight ?? 0
    const nextPageNumbers = getPdfVisiblePageNumbers({
      layout,
      scrollTop,
      viewportHeight,
    })
    setVisiblePageNumbers((previousPageNumbers) =>
      arePageNumbersEqual(previousPageNumbers, nextPageNumbers)
        ? previousPageNumbers
        : nextPageNumbers
    )
  }, [layout, viewportElement])
  const measureVisiblePagesNowRef = React.useRef(measureVisiblePagesNow)
  measureVisiblePagesNowRef.current = measureVisiblePagesNow

  const measureVisiblePages = React.useCallback(() => {
    if (measureFrameRef.current) return
    measureFrameRef.current = requestAnimationFrame(() =>
      measureVisiblePagesNowRef.current()
    )
  }, [])

  React.useEffect(() => {
    if (measureFrameRef.current) {
      cancelAnimationFrame(measureFrameRef.current)
      measureFrameRef.current = 0
    }
    measureVisiblePagesNow()
  }, [measureVisiblePagesNow])

  React.useEffect(
    () => () => {
      if (measureFrameRef.current) {
        cancelAnimationFrame(measureFrameRef.current)
      }
    },
    []
  )

  return { visiblePageNumbers, measureVisiblePages }
}

function arePageNumbersEqual(
  previousPageNumbers: readonly number[],
  nextPageNumbers: readonly number[]
) {
  if (previousPageNumbers.length !== nextPageNumbers.length) return false
  return previousPageNumbers.every(
    (pageNumber, index) => pageNumber === nextPageNumbers[index]
  )
}
