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
  const [visiblePageNumbers, setVisiblePageNumbers] = React.useState<
    readonly number[]
  >(() => [1])

  const measureVisiblePages = React.useCallback(() => {
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

  React.useEffect(() => {
    measureVisiblePages()
  }, [measureVisiblePages])

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
