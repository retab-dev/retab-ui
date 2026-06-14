"use client"

import * as React from "react"

export function useCodeProjectionScheduler({
  project,
  viewportRef,
}: {
  project: () => void
  viewportRef: React.RefObject<HTMLDivElement | null>
}) {
  const scheduledProjectionRef = React.useRef(0)

  const scheduleProjection = React.useCallback(() => {
    if (scheduledProjectionRef.current) return
    scheduledProjectionRef.current = requestAnimationFrame(() => {
      scheduledProjectionRef.current = 0
      project()
    })
  }, [project])

  React.useLayoutEffect(() => {
    project()
    return () => {
      if (!scheduledProjectionRef.current) return
      cancelAnimationFrame(scheduledProjectionRef.current)
      scheduledProjectionRef.current = 0
    }
  }, [project])

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    viewport.addEventListener("scroll", scheduleProjection, { passive: true })
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleProjection)
    observer?.observe(viewport)

    return () => {
      viewport.removeEventListener("scroll", scheduleProjection)
      observer?.disconnect()
      if (!scheduledProjectionRef.current) return
      cancelAnimationFrame(scheduledProjectionRef.current)
      scheduledProjectionRef.current = 0
    }
  }, [scheduleProjection, viewportRef])
}
