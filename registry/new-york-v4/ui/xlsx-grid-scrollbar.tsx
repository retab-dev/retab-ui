"use client"

import * as React from "react"

export const XLSX_SCROLLBAR_CSS = `
[data-slot="xlsx-body"]::-webkit-scrollbar { width: 10px; height: 10px; }
[data-slot="xlsx-body"]::-webkit-scrollbar:vertical { display: none; }
[data-slot="xlsx-body"]::-webkit-scrollbar-track { background: transparent; }
[data-slot="xlsx-body"]::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--foreground) 22%, transparent);
  border-radius: 9999px;
  border: 3px solid transparent;
  background-clip: content-box;
}
[data-slot="xlsx-body"]::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in oklab, var(--foreground) 38%, transparent);
}
`

export function HeaderAwareScrollbar({
  scrollRef,
  headerHeight,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  headerHeight: number
}) {
  const [thumb, setThumb] = React.useState({ height: 0, top: 0, show: false })
  const drag = React.useRef<{ y: number; scroll: number } | null>(null)

  const measure = React.useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    const { scrollHeight, clientHeight, scrollTop } = element
    const track = clientHeight - headerHeight
    if (scrollHeight <= clientHeight + 1 || track <= 0) {
      setThumb((value) => (value.show ? { ...value, show: false } : value))
      return
    }
    const height = Math.max(28, (clientHeight / scrollHeight) * track)
    const maxScroll = scrollHeight - clientHeight
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (track - height) : 0
    setThumb({ height, top, show: true })
  }, [scrollRef, headerHeight])

  React.useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    measure()
    element.addEventListener("scroll", measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      element.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [scrollRef, measure])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current
    if (!element) return
    event.preventDefault()
    drag.current = { y: event.clientY, scroll: element.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current
    const currentDrag = drag.current
    if (!element || !currentDrag) return
    const track = element.clientHeight - headerHeight
    const height = Math.max(
      28,
      (element.clientHeight / element.scrollHeight) * track
    )
    const denominator = track - height
    if (denominator <= 0) return
    const maxScroll = element.scrollHeight - element.clientHeight
    element.scrollTop =
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
