"use client"

import * as React from "react"

export function usePptxViewportWidth() {
  const [viewportWidth, setViewportWidth] = React.useState<number | null>(null)

  const containerRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return
    setViewportWidth(element.clientWidth)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportWidth((entry.target as HTMLElement).clientWidth)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { containerRef, viewportWidth }
}
