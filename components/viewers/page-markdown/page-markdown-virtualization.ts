"use client"

import * as React from "react"

import {
  getPageMarkdownVisiblePageNumbers,
  type PageMarkdownLayoutModel,
} from "./page-markdown-layout"

export function usePageMarkdownPageVirtualization({
  layout,
  resetKey,
  viewportElement,
}: {
  layout: PageMarkdownLayoutModel
  resetKey?: unknown
  viewportElement: HTMLDivElement | null
}) {
  const measureFrameRef = React.useRef(0)
  const lastMeasuredResetKeyRef = React.useRef<unknown>(resetKey)
  const getCurrentVisiblePageNumbers = React.useCallback(
    () =>
      getPageMarkdownVisiblePageNumbers({
        layout,
        scrollTop: Object.is(lastMeasuredResetKeyRef.current, resetKey)
          ? (viewportElement?.scrollTop ?? 0)
          : 0,
        viewportHeight:
          viewportElement?.clientHeight ||
          viewportElement?.getBoundingClientRect().height ||
          0,
      }),
    [layout, resetKey, viewportElement]
  )
  const [state, setState] = React.useState<{
    layout: PageMarkdownLayoutModel
    resetKey: unknown
    visiblePageNumbers: readonly number[]
  }>(() => ({
    layout,
    resetKey,
    visiblePageNumbers: getPageMarkdownVisiblePageNumbers({
      layout,
      scrollTop: viewportElement?.scrollTop ?? 0,
      viewportHeight:
        viewportElement?.clientHeight ||
        viewportElement?.getBoundingClientRect().height ||
        0,
    }),
  }))
  const visiblePageNumbers =
    Object.is(state.layout, layout) && Object.is(state.resetKey, resetKey)
      ? state.visiblePageNumbers
      : getPageMarkdownVisiblePageNumbers({
          layout,
          scrollTop: Object.is(state.resetKey, resetKey)
            ? (viewportElement?.scrollTop ?? 0)
            : 0,
          viewportHeight:
            viewportElement?.clientHeight ||
            viewportElement?.getBoundingClientRect().height ||
            0,
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
    if (typeof requestAnimationFrame !== "function") {
      measureVisiblePagesNowRef.current()
      return
    }
    measureFrameRef.current = requestAnimationFrame(() =>
      measureVisiblePagesNowRef.current()
    )
  }, [])

  React.useEffect(() => {
    if (measureFrameRef.current && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(measureFrameRef.current)
      measureFrameRef.current = 0
    }
    measureVisiblePagesNow()
  }, [measureVisiblePagesNow])

  React.useEffect(
    () => () => {
      if (
        measureFrameRef.current &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(measureFrameRef.current)
      }
    },
    []
  )

  return { measureVisiblePages, visiblePageNumbers }
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
