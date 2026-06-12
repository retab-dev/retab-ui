"use client"

import * as React from "react"

export function HeaderAwareScrollbar({
  scrollRef,
  headerHeight,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  headerHeight: number
}) {
  const scrollElement = useResolvedScrollbarElement(scrollRef)
  const [thumb, setThumb] = React.useState({ height: 0, top: 0, show: false })
  const drag = React.useRef<{ y: number; scroll: number } | null>(null)
  const frame = React.useRef(0)

  const measure = React.useCallback(() => {
    frame.current = 0
    if (!scrollElement) {
      hideThumb(setThumb)
      return
    }
    const { scrollHeight, clientHeight, scrollTop } = scrollElement
    if (
      !Number.isFinite(scrollHeight) ||
      !Number.isFinite(clientHeight) ||
      !Number.isFinite(scrollTop) ||
      !Number.isFinite(headerHeight)
    ) {
      hideThumb(setThumb)
      return
    }
    const track = clientHeight - headerHeight
    if (scrollHeight <= clientHeight + 1 || track <= 0) {
      hideThumb(setThumb)
      return
    }
    const height = Math.max(28, (clientHeight / scrollHeight) * track)
    const maxScroll = scrollHeight - clientHeight
    const maxTop = track - height
    const top =
      maxScroll > 0
        ? clampScrollTop((scrollTop / maxScroll) * maxTop, maxTop)
        : 0
    setThumb((current) => {
      const next = { height, top, show: true }
      return thumbEqual(current, next) ? current : next
    })
  }, [scrollElement, headerHeight])

  const scheduleMeasure = React.useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(measure)
  }, [measure])

  React.useEffect(() => {
    if (!scrollElement) {
      hideThumb(setThumb)
      return
    }
    measure()
    scrollElement.addEventListener("scroll", scheduleMeasure, {
      passive: true,
    })
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleMeasure)
        : null
    observer?.observe(scrollElement)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      scrollElement.removeEventListener("scroll", scheduleMeasure)
      observer?.disconnect()
    }
  }, [scrollElement, measure, scheduleMeasure])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollElement) return
    event.preventDefault()
    drag.current = { y: event.clientY, scroll: scrollElement.scrollTop }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const currentDrag = drag.current
    if (!scrollElement || !currentDrag) return
    const track = scrollElement.clientHeight - headerHeight
    const height = Math.max(
      28,
      (scrollElement.clientHeight / scrollElement.scrollHeight) * track
    )
    const denominator = track - height
    if (denominator <= 0) return
    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight
    scrollElement.scrollTop = clampScrollTop(
      currentDrag.scroll +
        ((event.clientY - currentDrag.y) / denominator) * maxScroll,
      maxScroll
    )
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  if (!thumb.show) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-0 z-30 w-2.5"
      style={{ top: headerHeight, bottom: 0 }}
    >
      <div
        className="pointer-events-auto absolute right-0.5 w-1.5 rounded-full bg-foreground/25 transition-colors hover:bg-foreground/40"
        style={{ height: thumb.height, top: thumb.top }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  )
}

function useResolvedScrollbarElement(
  scrollRef: React.RefObject<HTMLDivElement | null>
) {
  const [scrollElement, setScrollElement] = React.useState(scrollRef.current)

  React.useLayoutEffect(() => {
    const nextScrollElement = scrollRef.current
    if (scrollElement !== nextScrollElement) {
      setScrollElement(nextScrollElement)
    }
  })

  return scrollElement
}

function hideThumb(
  setThumb: React.Dispatch<
    React.SetStateAction<{ height: number; top: number; show: boolean }>
  >
) {
  setThumb((current) => (current.show ? { ...current, show: false } : current))
}

function clampScrollTop(value: number, maxScroll: number) {
  if (!Number.isFinite(value)) return 0
  if (!Number.isFinite(maxScroll) || maxScroll <= 0) return 0
  return Math.min(maxScroll, Math.max(0, value))
}

function thumbEqual(
  left: { height: number; top: number; show: boolean },
  right: { height: number; top: number; show: boolean }
) {
  return (
    left.show === right.show &&
    Math.abs(left.height - right.height) < 0.5 &&
    Math.abs(left.top - right.top) < 0.5
  )
}
