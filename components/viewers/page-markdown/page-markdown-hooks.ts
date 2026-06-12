"use client"

import * as React from "react"

import {
  createPageMeasurementKey,
  estimateMarkdownPageHeight,
  initialPagePaneState,
  resolvePagePaneReport,
  type PagePane,
  type PendingPageScroll,
} from "@/components/viewers/page-markdown/page-markdown-model"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"

export function useMarkdownPageMeasurement({
  markdown,
  mode,
  scale,
}: {
  markdown: string
  mode: PageMarkdownViewMode
  scale: number
}) {
  const key = createPageMeasurementKey({ markdown, mode, scale })
  const [measurement, setMeasurement] = React.useState<{
    key: string
    height: number | null
  }>({ key, height: null })

  React.useEffect(() => {
    setMeasurement({ key, height: null })
  }, [key])

  const measureRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return

      if (typeof ResizeObserver !== "function") {
        if (element.offsetHeight > 0) {
          setMeasurement({ key, height: element.offsetHeight })
        }
        return
      }

      const observer = new ResizeObserver(() => {
        if (element.offsetHeight > 0) {
          setMeasurement({ key, height: element.offsetHeight })
        }
      })

      observer.observe(element)
      return () => observer.disconnect()
    },
    [key]
  )

  return {
    reservedHeight:
      measurement.key === key && measurement.height !== null
        ? measurement.height
        : estimateMarkdownPageHeight(markdown, scale),
    measureRef,
  }
}

export function usePagePaneSync({
  onMarkdownPageChange,
  pageCount,
  resetKey,
}: {
  onMarkdownPageChange?: (page: number) => void
  pageCount?: number
  resetKey?: string
}) {
  const [state, setState] = React.useState(initialPagePaneState)
  const stateRef = React.useRef(state)
  const pendingRef = React.useRef<PendingPageScroll | null>(null)
  const pageCountLimit = Math.max(1, pageCount ?? 1)

  React.useEffect(() => {
    const nextState = initialPagePaneState()
    stateRef.current = nextState
    pendingRef.current = null
    setState(nextState)
  }, [resetKey])

  React.useEffect(() => {
    const currentState = stateRef.current
    const nextPage = Math.min(currentState.page, pageCountLimit)
    const nextState =
      nextPage === currentState.page
        ? currentState
        : { ...currentState, page: nextPage, version: currentState.version + 1 }
    const currentPending = pendingRef.current

    stateRef.current = nextState
    pendingRef.current =
      currentPending && currentPending.page <= pageCountLimit
        ? currentPending
        : null
    setState(nextState)
  }, [pageCountLimit])

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  const reportPage = React.useCallback(
    (pane: PagePane, page: number) => {
      const transition = resolvePagePaneReport({
        state: stateRef.current,
        pending: pendingRef.current,
        pane,
        page,
      })

      stateRef.current = transition.state
      pendingRef.current = transition.pending
      setState(transition.state)

      if (transition.state.pane === "markdown") {
        onMarkdownPageChange?.(transition.state.page)
      }

      return transition.scrollTarget
    },
    [onMarkdownPageChange]
  )

  return {
    currentPage: state.page,
    reportMarkdownPage: React.useCallback(
      (page: number) => reportPage("markdown", page),
      [reportPage]
    ),
    reportDocumentPage: React.useCallback(
      (page: number) => reportPage("document", page),
      [reportPage]
    ),
  }
}
