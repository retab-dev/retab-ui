"use client"

import * as React from "react"

import type { Source, SourceMap } from "@/lib/document-source"

/**
 * A viewer that can reveal a source. Format-agnostic: the target interprets the
 * source's anchor itself (a PDF page region, a spreadsheet cell, a text line, …).
 * Each viewer ships an adapter that builds one of these (see e.g. the PDF
 * adapter's `usePdfSourceTarget`). The highlight is the viewer's own concern —
 * the block feeds `activeSource` to the viewer's overlay.
 */
export interface SourceTarget {
  /** Scroll the viewer to reveal the source. No-op if the anchor doesn't apply. */
  scrollTo?: (source: Source, options: { behavior: ScrollBehavior }) => void
}

export interface UseSourceLinkResult {
  /** Hovered field path — a transient preview. */
  hoverPath: string | null
  /** Pinned field path — persists until changed. */
  pinnedPath: string | null
  /** Effective active path: hover wins over pin. */
  activePath: string | null
  /** The active source, if the active path has one — feed to the viewer's overlay. */
  activeSource: Source | undefined
  /**
   * Report the hovered field (or `null` on leave). Wire straight to json-form's
   * `setSourcesFieldPath`. Scrolls the target instantly (preview).
   */
  onFieldHover: (path: string | null) => void
  /** Pin a field (e.g. on click). Scrolls the target smoothly. */
  selectField: (path: string) => void
  /** Clear hover and pin. */
  clear: () => void
}

/**
 * The generic, viewer-agnostic mediator between a field-rendering component (the
 * emitter — json-form, a field list) and a document viewer (the target). It owns
 * the hover-vs-pin state machine and drives the target's scroll; the overlay is
 * the caller's job (feed `activeSource` to the viewer's source overlay).
 *
 * Unidirectional: fields drive the viewer, never the reverse. Works for any
 * format — the `target` adapter knows how to interpret each anchor.
 *
 * `target` should be stable across renders (the adapters memoize it).
 */
export function useSourceLink({
  sources,
  target,
  initialField = null,
}: {
  sources: SourceMap
  target?: SourceTarget
  /**
   * Field path to pin on first render so a highlight shows on load. Set during
   * render (not in an effect) — the initial viewer position already reveals it.
   */
  initialField?: string | null
}): UseSourceLinkResult {
  const [hoverPath, setHoverPath] = React.useState<string | null>(null)
  const [pinnedPath, setPinnedPath] = React.useState<string | null>(
    initialField
  )
  const hoverPathRef = React.useRef<string | null>(null)

  const activePath = hoverPath ?? pinnedPath
  const activeSource = activePath != null ? sources[activePath] : undefined

  // Dedupe scrolls to the same field (hover fires many times per field).
  const lastScrolledRef = React.useRef<{
    path: string
    source: Source
  } | null>(null)
  const pendingScrollsRef = React.useRef<Map<string, ScrollBehavior>>(new Map())
  const suppressNextHoverClearRef = React.useRef(false)
  const scrollToPath = React.useCallback(
    (path: string, behavior: ScrollBehavior) => {
      const scrollTo = target?.scrollTo
      if (!scrollTo) {
        pendingScrollsRef.current.set(path, behavior)
        return
      }
      const source = sources[path]
      if (!source) {
        pendingScrollsRef.current.set(path, behavior)
        return
      }
      const lastScrolled = lastScrolledRef.current
      if (
        behavior === "auto" &&
        lastScrolled?.path === path &&
        lastScrolled.source === source
      ) {
        return
      }
      pendingScrollsRef.current.delete(path)
      lastScrolledRef.current = { path, source }
      scrollTo(source, { behavior })
    },
    [sources, target]
  )
  const updateHoverPath = React.useCallback((path: string | null) => {
    if (hoverPathRef.current === path) return false
    hoverPathRef.current = path
    setHoverPath(path)
    return true
  }, [])

  React.useLayoutEffect(() => {
    if (activePath == null) return
    const pendingBehavior = pendingScrollsRef.current.get(activePath)
    if (!pendingBehavior) return
    scrollToPath(activePath, pendingBehavior)
  }, [activePath, scrollToPath])

  React.useLayoutEffect(() => {
    if (activePath == null) return
    if (!target?.scrollTo) {
      if (!pendingScrollsRef.current.has(activePath)) {
        pendingScrollsRef.current.set(activePath, "auto")
      }
      return
    }
    if (!activeSource) {
      if (!pendingScrollsRef.current.has(activePath)) {
        pendingScrollsRef.current.set(activePath, "auto")
      }
      if (lastScrolledRef.current?.path === activePath) {
        lastScrolledRef.current = null
        pendingScrollsRef.current.set(activePath, "auto")
      }
      return
    }
    const lastScrolled = lastScrolledRef.current
    if (!lastScrolled || lastScrolled.path !== activePath) return
    if (lastScrolled.source === activeSource) return
    scrollToPath(activePath, "auto")
  }, [activePath, activeSource, scrollToPath, target])

  const onFieldHover = React.useCallback(
    (path: string | null) => {
      if (path == null) {
        const changed = updateHoverPath(null)
        if (suppressNextHoverClearRef.current) {
          suppressNextHoverClearRef.current = false
          return
        }
        if (!changed) return
        const lastScrolled = lastScrolledRef.current
        lastScrolledRef.current = null
        for (const [pendingPath, behavior] of pendingScrollsRef.current) {
          if (behavior === "auto") pendingScrollsRef.current.delete(pendingPath)
        }
        if (pinnedPath != null) {
          const pinnedSource = sources[pinnedPath]
          if (
            pinnedSource &&
            lastScrolled?.path === pinnedPath &&
            lastScrolled.source === pinnedSource
          ) {
            return
          }
          scrollToPath(
            pinnedPath,
            pendingScrollsRef.current.get(pinnedPath) ?? "auto"
          )
        }
        return
      }
      if (!updateHoverPath(path)) return
      suppressNextHoverClearRef.current = false
      if (path != null) scrollToPath(path, "auto")
    },
    [pinnedPath, scrollToPath, sources, updateHoverPath]
  )

  const selectField = React.useCallback(
    (path: string) => {
      suppressNextHoverClearRef.current = true
      updateHoverPath(null)
      setPinnedPath(path)
      scrollToPath(path, "smooth")
    },
    [scrollToPath, updateHoverPath]
  )

  const clear = React.useCallback(() => {
    updateHoverPath(null)
    setPinnedPath(null)
    lastScrolledRef.current = null
    pendingScrollsRef.current.clear()
  }, [updateHoverPath])

  return {
    hoverPath,
    pinnedPath,
    activePath,
    activeSource,
    onFieldHover,
    selectField,
    clear,
  }
}
