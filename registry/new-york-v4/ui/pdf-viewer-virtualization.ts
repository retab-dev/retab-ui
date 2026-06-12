import * as React from "react"

import {
  getPdfVisiblePageNumbers,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout"

export function usePdfPageVirtualization({
  layout,
  resetKey,
  viewportElement,
}: {
  layout: PdfPageLayoutModel
  resetKey?: unknown
  viewportElement: HTMLDivElement | null
}) {
  const measureFrameRef = React.useRef(0)
  const lastMeasuredResetKeyRef = React.useRef<unknown>(resetKey)
  const getCurrentVisiblePageNumbers = React.useCallback(
    () =>
      getPdfVisiblePageNumbers({
        layout,
        scrollTop: Object.is(lastMeasuredResetKeyRef.current, resetKey)
          ? (viewportElement?.scrollTop ?? 0)
          : 0,
        viewportHeight: viewportElement?.clientHeight ?? 0,
      }),
    [layout, resetKey, viewportElement]
  )
  const [state, setState] = React.useState<{
    layout: PdfPageLayoutModel
    resetKey: unknown
    visiblePageNumbers: readonly number[]
  }>(() => ({
    layout,
    resetKey,
    visiblePageNumbers: getPdfVisiblePageNumbers({
      layout,
      scrollTop: viewportElement?.scrollTop ?? 0,
      viewportHeight: viewportElement?.clientHeight ?? 0,
    }),
  }))
  const visiblePageNumbers =
    Object.is(state.layout, layout) && Object.is(state.resetKey, resetKey)
      ? state.visiblePageNumbers
      : getPdfVisiblePageNumbers({
          layout,
          scrollTop: Object.is(state.resetKey, resetKey)
            ? (viewportElement?.scrollTop ?? 0)
            : 0,
          viewportHeight: viewportElement?.clientHeight ?? 0,
        })

  const measureVisiblePagesNow = React.useCallback(() => {
    measureFrameRef.current = 0
    const nextPageNumbers = getCurrentVisiblePageNumbers()
    lastMeasuredResetKeyRef.current = resetKey
    setState((previousState) =>
      Object.is(previousState.layout, layout) &&
      Object.is(previousState.resetKey, resetKey) &&
      arePageNumbersEqual(previousState.visiblePageNumbers, nextPageNumbers)
        ? previousState
        : { layout, resetKey, visiblePageNumbers: nextPageNumbers }
    )
  }, [getCurrentVisiblePageNumbers, layout, resetKey])
  const measureVisiblePagesNowRef = React.useRef(measureVisiblePagesNow)
  React.useLayoutEffect(() => {
    measureVisiblePagesNowRef.current = measureVisiblePagesNow
  }, [measureVisiblePagesNow])

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
