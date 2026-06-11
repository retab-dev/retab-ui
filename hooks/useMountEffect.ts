"use client"

import { useEffect, useRef } from "react"

/** Run an effect exactly once on mount. */
export function useMountEffect(effect: () => void | (() => void)) {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    return effect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
