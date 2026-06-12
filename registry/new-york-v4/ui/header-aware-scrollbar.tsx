"use client"

import * as React from "react"

export function HeaderAwareScrollbar({
  scrollRef,
  headerHeight,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  headerHeight: number
}) {
  const [thumb, setThumb] = React.useState({ height: 0, top: 0, show: false })
  const drag = React.useRef<{ y: number; scroll: number } | null>(null)
  const frame = React.useRef(0)

  const measure = React.useCallback(() => {
    frame.current = 0
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    const { scrollHeight, clientHeight, scrollTop } = scrollElement
    const track = clientHeight - headerHeight
    if (scrollHeight <= clientHeight + 1 || track <= 0) {
      setThumb((current) =>
        current.show ? { ...current, show: false } : current
      )
      return
    }
    const height = Math.max(28, (clientHeight / scrollHeight) * track)
    const maxScroll = scrollHeight - clientHeight
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (track - height) : 0
    setThumb((current) => {
      const next = { height, top, show: true }
      return thumbEqual(current, next) ? current : next
    })
  }, [scrollRef, headerHeight])

  const scheduleMeasure = React.useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(measure)
  }, [measure])

  React.useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    measure()
    scrollElement.addEventListener("scroll", scheduleMeasure, {
      passive: true,
    })
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(scrollElement)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      scrollElement.removeEventListener("scroll", scheduleMeasure)
      observer.disconnect()
    }
  }, [scrollRef, measure, scheduleMeasure])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    event.preventDefault()
    drag.current = { y: event.clientY, scroll: scrollElement.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const scrollElement = scrollRef.current
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
    scrollElement.scrollTop =
      currentDrag.scroll +
      ((event.clientY - currentDrag.y) / denominator) * maxScroll
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
