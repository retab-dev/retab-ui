import * as React from "react"

import type { PdfPageSize } from "./pdf-viewer-types"

export function usePdfPageSizes(resetKey: unknown) {
  const [state, setState] = React.useState<{
    resetKey: unknown
    pageSizeByNumber: ReadonlyMap<number, PdfPageSize>
  }>(() => ({ resetKey, pageSizeByNumber: new Map() }))

  const emptyPageSizeByNumber = React.useMemo<ReadonlyMap<number, PdfPageSize>>(
    () => new Map(),
    [resetKey]
  )
  const pageSizeByNumber = Object.is(state.resetKey, resetKey)
    ? state.pageSizeByNumber
    : emptyPageSizeByNumber

  React.useEffect(() => {
    setState((previousState) =>
      Object.is(previousState.resetKey, resetKey)
        ? previousState
        : { resetKey, pageSizeByNumber: new Map() }
    )
  }, [resetKey])

  const setPageSize = React.useCallback(
    (pageNumber: number, size: PdfPageSize) => {
      setState((previousState) => {
        const previousPageSizeByNumber = Object.is(
          previousState.resetKey,
          resetKey
        )
          ? previousState.pageSizeByNumber
          : emptyPageSizeByNumber
        const current = previousPageSizeByNumber.get(pageNumber)
        if (current?.width === size.width && current.height === size.height) {
          return previousState
        }
        const nextPageSizeByNumber = new Map(previousPageSizeByNumber)
        nextPageSizeByNumber.set(pageNumber, size)
        return { resetKey, pageSizeByNumber: nextPageSizeByNumber }
      })
    },
    [emptyPageSizeByNumber, resetKey]
  )

  return { pageSizeByNumber, setPageSize }
}
