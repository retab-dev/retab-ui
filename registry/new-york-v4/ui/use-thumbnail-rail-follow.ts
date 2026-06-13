"use client"

import * as React from "react"

import {
  getPdfThumbnailLayoutItem,
  normalizeThumbnailPage,
  type PdfThumbnailLayout,
} from "./pdf-thumbnail-layout"

export const THUMBNAIL_FOLLOW_MARGIN = 24
export const THUMBNAIL_PROGRAMMATIC_SCROLL_WINDOW_MS = 120
export const THUMBNAIL_USER_SCROLL_IDLE_MS = 400

type ThumbnailFollowSuspension = "none" | "pointer" | "user-scroll"

interface ThumbnailFollowState {
  suspension: ThumbnailFollowSuspension
  lastProgrammaticScrollAt: number
  idleTimer: number | null
}

export function useThumbnailRailFollow({
  currentPage,
  layout,
  viewportRef,
  resetKey,
}: {
  currentPage: number | null | undefined
  layout: PdfThumbnailLayout
  viewportRef: React.RefObject<HTMLElement | null>
  resetKey: unknown
}) {
  const stateRef = React.useRef<ThumbnailFollowState>({
    suspension: "none",
    lastProgrammaticScrollAt: 0,
    idleTimer: null,
  })

  const scrollPageIntoView = React.useCallback(
    (page: number) => {
      const normalizedPage = normalizeThumbnailPage(page, layout.pageCount)
      if (normalizedPage == null) return

      const viewport = viewportRef.current
      if (!viewport) return

      const item = getPdfThumbnailLayoutItem(layout, normalizedPage)
      if (!item) return

      const top = item.top - viewport.scrollTop
      const bottom = top + item.height
      const minTop = THUMBNAIL_FOLLOW_MARGIN
      const maxBottom = viewport.clientHeight - THUMBNAIL_FOLLOW_MARGIN
      const isAtDocumentStart =
        item.top <= THUMBNAIL_FOLLOW_MARGIN &&
        viewport.scrollTop <= THUMBNAIL_FOLLOW_MARGIN

      if ((top >= minTop || isAtDocumentStart) && bottom <= maxBottom) return

      const maxScrollTop = Math.max(
        0,
        layout.totalHeight - viewport.clientHeight
      )
      const targetTop = Math.min(
        maxScrollTop,
        Math.max(0, item.top - viewport.clientHeight / 2 + item.height / 2)
      )

      stateRef.current.lastProgrammaticScrollAt = performance.now()
      viewport.scrollTo?.({ top: targetTop, behavior: "smooth" })
    },
    [layout, viewportRef]
  )

  const followNow = React.useCallback(() => {
    const page = normalizeThumbnailPage(currentPage, layout.pageCount)
    if (page == null) return

    const state = stateRef.current
    if (state.suspension !== "none") return

    scrollPageIntoView(page)
  }, [currentPage, layout.pageCount, scrollPageIntoView])

  React.useEffect(() => {
    const state = stateRef.current
    state.suspension = "none"
    state.lastProgrammaticScrollAt = 0
    if (state.idleTimer != null) {
      window.clearTimeout(state.idleTimer)
      state.idleTimer = null
    }
  }, [resetKey])

  React.useEffect(() => {
    followNow()
  }, [followNow, resetKey])

  React.useEffect(() => {
    const state = stateRef.current
    return () => {
      if (state.idleTimer != null) window.clearTimeout(state.idleTimer)
    }
  }, [])

  const onPointerEnter = React.useCallback(() => {
    stateRef.current.suspension = "pointer"
  }, [])

  const onPointerLeave = React.useCallback(() => {
    stateRef.current.suspension = "none"
    followNow()
  }, [followNow])

  const onPageActivate = React.useCallback(
    (pageNumber: number) => {
      stateRef.current.suspension = "none"
      scrollPageIntoView(pageNumber)
    },
    [scrollPageIntoView]
  )

  const onScroll = React.useCallback(() => {
    const state = stateRef.current
    const elapsed = performance.now() - state.lastProgrammaticScrollAt
    if (elapsed < THUMBNAIL_PROGRAMMATIC_SCROLL_WINDOW_MS) return

    state.suspension = "user-scroll"
    if (state.idleTimer != null) window.clearTimeout(state.idleTimer)
    state.idleTimer = window.setTimeout(() => {
      state.suspension = "none"
      state.idleTimer = null
      followNow()
    }, THUMBNAIL_USER_SCROLL_IDLE_MS)
  }, [followNow])

  return {
    onPageActivate,
    onPointerEnter,
    onPointerLeave,
    onScroll,
  }
}
