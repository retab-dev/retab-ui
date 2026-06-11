"use client"

import * as React from "react"

export const CSV_SCROLLBAR_CSS = `
[data-slot="csv-body"]::-webkit-scrollbar { width: 10px; height: 10px; }
[data-slot="csv-body"]::-webkit-scrollbar:vertical { display: none; }
[data-slot="csv-body"]::-webkit-scrollbar-track { background: transparent; }
[data-slot="csv-body"]::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--foreground) 22%, transparent);
  border-radius: 9999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
[data-slot="csv-body"]::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in oklab, var(--foreground) 38%, transparent);
}
`

export function HeaderAwareScrollbar({
  viewportRef,
  headerHeight,
}: {
  viewportRef: React.RefObject<HTMLDivElement | null>
  headerHeight: number
}) {
  const [thumb, setThumb] = React.useState({ height: 0, top: 0, show: false })
  const drag = React.useRef<{ y: number; scroll: number } | null>(null)

  const measure = React.useCallback(() => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return
    const { scrollHeight, clientHeight, scrollTop } = viewportElement
    const track = clientHeight - headerHeight
    if (scrollHeight <= clientHeight + 1 || track <= 0) {
      setThumb((current) =>
        current.show ? { ...current, show: false } : current
      )
      return
    }
    const height = Math.max(28, (clientHeight / scrollHeight) * track)
    const max = scrollHeight - clientHeight
    const top = max > 0 ? (scrollTop / max) * (track - height) : 0
    setThumb({ height, top, show: true })
  }, [viewportRef, headerHeight])

  React.useEffect(() => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return
    measure()
    viewportElement.addEventListener("scroll", measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(viewportElement)
    return () => {
      viewportElement.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [viewportRef, measure])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewportElement = viewportRef.current
    if (!viewportElement) return
    event.preventDefault()
    drag.current = { y: event.clientY, scroll: viewportElement.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewportElement = viewportRef.current
    const currentDrag = drag.current
    if (!viewportElement || !currentDrag) return
    const track = viewportElement.clientHeight - headerHeight
    const height = Math.max(
      28,
      (viewportElement.clientHeight / viewportElement.scrollHeight) * track
    )
    const denominator = track - height
    if (denominator <= 0) return
    const max = viewportElement.scrollHeight - viewportElement.clientHeight
    viewportElement.scrollTop =
      currentDrag.scroll + ((event.clientY - currentDrag.y) / denominator) * max
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
