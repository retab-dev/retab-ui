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
}: {
  sources: SourceMap
  target?: SourceTarget
}): UseSourceLinkResult {
  const [hoverPath, setHoverPath] = React.useState<string | null>(null)
  const [pinnedPath, setPinnedPath] = React.useState<string | null>(null)

  const activePath = hoverPath ?? pinnedPath
  const activeSource = activePath ? sources[activePath] : undefined

  // Dedupe scrolls to the same field (hover fires many times per field).
  const lastScrolledPath = React.useRef<string | null>(null)
  const scrollToPath = React.useCallback(
    (path: string, behavior: ScrollBehavior) => {
      const scrollTo = target?.scrollTo
      if (!scrollTo) return
      if (behavior === "auto" && path === lastScrolledPath.current) return
      const source = sources[path]
      if (!source) return
      lastScrolledPath.current = path
      scrollTo(source, { behavior })
    },
    [sources, target]
  )

  const onFieldHover = React.useCallback(
    (path: string | null) => {
      setHoverPath(path)
      if (path) scrollToPath(path, "auto")
    },
    [scrollToPath]
  )

  const selectField = React.useCallback(
    (path: string) => {
      setPinnedPath(path)
      scrollToPath(path, "smooth")
    },
    [scrollToPath]
  )

  const clear = React.useCallback(() => {
    setHoverPath(null)
    setPinnedPath(null)
  }, [])

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
