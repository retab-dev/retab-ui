"use client"

import * as React from "react"

import {
  getPageMarkdownVisiblePageNumbers,
  type PageMarkdownLayoutModel,
} from "./page-markdown-layout"

export function usePageMarkdownPageVirtualization({
  getViewportElement,
  layout,
  resetKey,
  viewportElement,
}: {
  getViewportElement?: () => HTMLDivElement | null
  layout: PageMarkdownLayoutModel
  resetKey?: unknown
  viewportElement: HTMLDivElement | null
}) {
  const measureFrameRef = React.useRef(0)
  const lastMeasuredResetKeyRef = React.useRef<unknown>(resetKey)
  const resolveViewportElement = React.useCallback(
    () => getViewportElement?.() ?? viewportElement,
    [getViewportElement, viewportElement]
  )
  const getCurrentVisiblePageNumbers = React.useCallback(() => {
    const currentViewportElement = resolveViewportElement()
    return getPageMarkdownVisiblePageNumbers({
      layout,
      scrollTop: Object.is(lastMeasuredResetKeyRef.current, resetKey)
        ? (currentViewportElement?.scrollTop ?? 0)
        : 0,
      viewportHeight: getViewportHeight(currentViewportElement),
    })
  }, [layout, resetKey, resolveViewportElement])
  const [state, setState] = React.useState<{
    layout: PageMarkdownLayoutModel
    resetKey: unknown
    visiblePageNumbers: readonly number[]
  }>(() => ({
    layout,
    resetKey,
    visiblePageNumbers: getInitialVisiblePageNumbers({
      layout,
      viewportElement,
    }),
  }))
  const visiblePageNumbers =
    Object.is(state.layout, layout) && Object.is(state.resetKey, resetKey)
      ? state.visiblePageNumbers
      : getPageMarkdownVisiblePageNumbers({
          layout,
          scrollTop: Object.is(state.resetKey, resetKey)
            ? (resolveViewportElement()?.scrollTop ?? 0)
            : 0,
          viewportHeight: getViewportHeight(resolveViewportElement()),
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
    measureFrameRef.current = -1
    const requestedFrame = requestAnimationFrame(() =>
      measureVisiblePagesNowRef.current()
    )
    if (measureFrameRef.current === -1) {
      measureFrameRef.current = requestedFrame
    }
  }, [])

  React.useEffect(() => {
    if (
      measureFrameRef.current > 0 &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(measureFrameRef.current)
      measureFrameRef.current = 0
    }
    measureVisiblePagesNow()
  }, [measureVisiblePagesNow, viewportElement])

  React.useEffect(
    () => () => {
      if (
        measureFrameRef.current > 0 &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(measureFrameRef.current)
      }
    },
    []
  )

  return { measureVisiblePages, visiblePageNumbers }
}

function getInitialVisiblePageNumbers({
  layout,
  viewportElement,
}: {
  layout: PageMarkdownLayoutModel
  viewportElement: HTMLDivElement | null
}) {
  return getPageMarkdownVisiblePageNumbers({
    layout,
    scrollTop: viewportElement?.scrollTop ?? 0,
    viewportHeight: getViewportHeight(viewportElement),
  })
}

function getViewportHeight(viewportElement: HTMLDivElement | null) {
  return (
    viewportElement?.clientHeight ||
    viewportElement?.getBoundingClientRect().height ||
    0
  )
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
