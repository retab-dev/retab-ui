import * as React from "react"

import type { PdfPageSize } from "./pdf-viewer-types"

export function usePdfPageSizes(resetKey: unknown) {
  const [pageSizeByNumber, setPageSizeByNumber] = React.useState<
    ReadonlyMap<number, PdfPageSize>
  >(() => new Map())

  React.useEffect(() => setPageSizeByNumber(new Map()), [resetKey])

  const setPageSize = React.useCallback(
    (pageNumber: number, size: PdfPageSize) => {
      setPageSizeByNumber((previousPageSizeByNumber) => {
        const current = previousPageSizeByNumber.get(pageNumber)
        if (current?.width === size.width && current.height === size.height) {
          return previousPageSizeByNumber
        }
        const nextPageSizeByNumber = new Map(previousPageSizeByNumber)
        nextPageSizeByNumber.set(pageNumber, size)
        return nextPageSizeByNumber
      })
    },
    []
  )

  return { pageSizeByNumber, setPageSize }
}
