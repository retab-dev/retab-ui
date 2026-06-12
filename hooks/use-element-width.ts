"use client"

import * as React from "react"

export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): [
  React.RefCallback<T>,
  number | null,
] {
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const [width, setWidth] = React.useState<number | null>(null)

  const ref = React.useCallback((element: T | null) => {
    cleanupRef.current?.()
    cleanupRef.current = null

    if (!element) return

    setWidth(element.clientWidth)
    if (typeof ResizeObserver !== "function") return

    let frame = 0
    let nextWidth = element.clientWidth
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        nextWidth = (entry.target as HTMLElement).clientWidth
      }
      if (frame) return
      if (typeof requestAnimationFrame !== "function") {
        setWidth(nextWidth)
        return
      }
      frame = requestAnimationFrame(() => {
        frame = 0
        setWidth(nextWidth)
      })
    })

    observer.observe(element)
    cleanupRef.current = () => {
      if (frame && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame)
      }
      observer.disconnect()
    }
  }, [])

  React.useEffect(() => () => cleanupRef.current?.(), [])

  return [ref, width]
}
