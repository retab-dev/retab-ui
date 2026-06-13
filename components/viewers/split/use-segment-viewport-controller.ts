"use client"

import * as React from "react"

import {
  getSegmentInteractionState,
  type SegmentInteraction,
  type SegmentInteractionState,
} from "@/lib/segment-interaction"
import { firstSegmentPage, type Segment } from "@/lib/segments"
import { type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"

const RAIL_VISIBILITY_MARGIN = 24
const PROGRAMMATIC_SCROLL_WINDOW_MS = 120
const USER_SCROLL_IDLE_MS = 400

export interface SegmentViewportModel extends SegmentInteractionState {
  scrollProgress: number
}

export interface SegmentViewportController {
  model: SegmentViewportModel
  interaction: SegmentInteraction
  documentHandlers: {
    onCurrentPageChange: (page: number) => void
    onScrollProgressChange: (progress: number) => void
    setViewerHandle: (handle: PdfViewerHandle | null) => void
  }
  navigation: {
    scrollToPage: (page: number) => void
    scrollToSegmentStart: (segment: Segment) => void
  }
  rail: {
    setViewportElement: (element: HTMLElement | null) => void
    setPageElement: (page: number, element: HTMLElement | null) => void
    onPointerEnter: () => void
    onPointerLeave: () => void
    onScroll: () => void
  }
}

interface RailFollowState {
  isPointerInsideRail: boolean
  isUserScrollingRail: boolean
  lastProgrammaticScrollAt: number
  idleTimer: number | null
}

export function useSegmentViewportController({
  segments,
}: {
  segments: Segment[]
}): SegmentViewportController {
  const [currentPage, setCurrentPage] = React.useState<number | null>(1)
  const [scrollProgress, setScrollProgress] = React.useState(0)
  const [viewerHandle, setViewerHandle] =
    React.useState<PdfViewerHandle | null>(null)
  const interaction = useSegmentInteraction()
  const { clearPreview } = interaction
  const railViewportRef = React.useRef<HTMLElement | null>(null)
  const pageElementByNumberRef = React.useRef(new Map<number, HTMLElement>())
  const railFollowStateRef = React.useRef<RailFollowState>({
    isPointerInsideRail: false,
    isUserScrollingRail: false,
    lastProgrammaticScrollAt: 0,
    idleTimer: null,
  })

  const model = React.useMemo<SegmentViewportModel>(() => {
    const interactionState = getSegmentInteractionState({
      segments,
      currentPage,
      interaction,
    })

    return {
      ...interactionState,
      scrollProgress,
    }
  }, [currentPage, interaction, scrollProgress, segments])

  const onCurrentPageChange = React.useCallback((page: number) => {
    setCurrentPage(normalizePage(page))
  }, [])

  const onScrollProgressChange = React.useCallback((progress: number) => {
    setScrollProgress(clamp01(progress))
  }, [])

  const scrollToPage = React.useCallback(
    (page: number) => {
      const normalizedPage = normalizePage(page)
      if (normalizedPage == null) return

      interaction.clearPreview()
      viewerHandle?.scrollToPage(normalizedPage)
    },
    [interaction, viewerHandle]
  )

  const scrollToSegmentStart = React.useCallback(
    (segment: Segment) => {
      const page = firstSegmentPage(segment.pages)
      if (page == null) return

      scrollToPage(page)
    },
    [scrollToPage]
  )

  const followCurrentPage = React.useCallback((page: number | null) => {
    const normalizedPage = normalizePage(page)
    if (normalizedPage == null) return

    const state = railFollowStateRef.current
    if (state.isPointerInsideRail || state.isUserScrollingRail) return

    const viewport = railViewportRef.current
    const target = pageElementByNumberRef.current.get(normalizedPage)
    if (!viewport || !target) return

    const viewportRect = viewport.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const minTop = viewportRect.top + RAIL_VISIBILITY_MARGIN
    const maxBottom = viewportRect.bottom - RAIL_VISIBILITY_MARGIN

    if (targetRect.top >= minTop && targetRect.bottom <= maxBottom) return

    const targetTop =
      target.offsetTop - viewport.clientHeight / 2 + target.offsetHeight / 2

    state.lastProgrammaticScrollAt = performance.now()
    viewport.scrollTo?.({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    })
  }, [])

  React.useLayoutEffect(() => {
    followCurrentPage(currentPage)
  }, [currentPage, followCurrentPage])

  React.useEffect(() => {
    const state = railFollowStateRef.current
    return () => {
      const timer = state.idleTimer
      if (timer != null) window.clearTimeout(timer)
    }
  }, [])

  React.useEffect(() => {
    setCurrentPage(1)
    setScrollProgress(0)
    clearPreview()
  }, [clearPreview, segments])

  const setPageElement = React.useCallback(
    (page: number, element: HTMLElement | null) => {
      const normalizedPage = normalizePage(page)
      if (normalizedPage == null) return

      if (element) {
        pageElementByNumberRef.current.set(normalizedPage, element)
      } else {
        pageElementByNumberRef.current.delete(normalizedPage)
      }
    },
    []
  )

  const handleRailScroll = React.useCallback(() => {
    const state = railFollowStateRef.current
    const elapsed = performance.now() - state.lastProgrammaticScrollAt
    if (elapsed < PROGRAMMATIC_SCROLL_WINDOW_MS) return

    state.isUserScrollingRail = true
    if (state.idleTimer != null) window.clearTimeout(state.idleTimer)
    state.idleTimer = window.setTimeout(() => {
      state.isUserScrollingRail = false
      state.idleTimer = null
    }, USER_SCROLL_IDLE_MS)
  }, [])

  const rail = React.useMemo(
    () => ({
      setViewportElement: (element: HTMLElement | null) => {
        railViewportRef.current = element
      },
      setPageElement,
      onPointerEnter: () => {
        railFollowStateRef.current.isPointerInsideRail = true
      },
      onPointerLeave: () => {
        railFollowStateRef.current.isPointerInsideRail = false
      },
      onScroll: handleRailScroll,
    }),
    [handleRailScroll, setPageElement]
  )

  return React.useMemo(
    () => ({
      model,
      interaction,
      documentHandlers: {
        onCurrentPageChange,
        onScrollProgressChange,
        setViewerHandle,
      },
      navigation: {
        scrollToPage,
        scrollToSegmentStart,
      },
      rail,
    }),
    [
      interaction,
      model,
      onCurrentPageChange,
      onScrollProgressChange,
      rail,
      scrollToPage,
      scrollToSegmentStart,
    ]
  )
}

function normalizePage(page: number | null | undefined): number | null {
  return page != null && Number.isInteger(page) && page > 0 ? page : null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
