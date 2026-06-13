import * as React from "react"

import { cn } from "@/lib/utils"

export function PdfViewerRail({
  side,
  open,
  animate,
  children,
}: {
  side: "left" | "right"
  open: boolean
  animate: boolean
  children: React.ReactNode
}) {
  const [width, setWidth] = React.useState<number | null>(null)
  const [canAnimateWidth, setCanAnimateWidth] = React.useState(false)
  const measureRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    setWidth(Math.round(element.offsetWidth))
    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() =>
      setWidth(Math.round(element.offsetWidth))
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!animate || width == null) {
      setCanAnimateWidth(false)
      return
    }
    if (
      typeof requestAnimationFrame === "undefined" ||
      typeof cancelAnimationFrame === "undefined"
    ) {
      setCanAnimateWidth(true)
      return
    }

    const frame = requestAnimationFrame(() => setCanAnimateWidth(true))
    return () => cancelAnimationFrame(frame)
  }, [animate, width])

  return (
    <div
      data-slot="pdf-viewer-rail"
      data-side={side}
      data-state={open ? "open" : "closed"}
      className={cn(
        "h-full flex-shrink-0 overflow-hidden",
        canAnimateWidth && "transition-[width] duration-200 ease-out"
      )}
      style={animate ? { width: open ? (width ?? undefined) : 0 } : undefined}
    >
      <div ref={measureRef} className="h-full w-max">
        {children}
      </div>
    </div>
  )
}
