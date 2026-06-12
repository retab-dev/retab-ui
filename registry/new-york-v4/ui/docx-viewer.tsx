"use client"

import * as React from "react"
// Type-only import — erased at compile time, so docx-preview never loads on the
// server (it touches the DOM at call time).
import type * as DocxPreview from "docx-preview"
import { Download, Maximize, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  isResourceError,
  isViewerFormatError,
  ViewerFormatError,
  type ViewerFormatErrorMapperOptions,
} from "@/lib/viewer-errors"
import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewerDownloadButton } from "@/components/ui/viewer-download"
import { ViewerErrorBoundary } from "@/components/ui/viewer-error"

import { clearDocxResource, getDocxResource } from "./docx-viewer-resource"

export { getDocxResource } from "./docx-viewer-resource"

// docx-preview is browser-only, so it is imported lazily on the client. jszip
// (its single dependency) is resolved by the bundler from the installed package.
let docxPromise: Promise<typeof DocxPreview> | null = null
function loadDocxPreview() {
  if (!docxPromise) {
    docxPromise = import("docx-preview").catch((error) => {
      docxPromise = null
      throw error
    })
  }
  return docxPromise
}

// We render faithful, paginated pages and override docx-preview's built-in
// chrome (gray backdrop, drop shadow) so pages match the rest of the viewers.
const RENDER_OPTIONS: Partial<DocxPreview.Options> = {
  inWrapper: true,
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  experimental: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
}

const DEFAULT_PAGE_WIDTH = 816
const DEFAULT_PAGE_HEIGHT = 1056

// Scoped overrides for docx-preview's default wrapper/section styling.
const SCOPED_STYLES = `
[data-slot="docx-viewer"] .docx-wrapper {
  background: transparent;
  padding: 0;
  gap: 1rem;
}
[data-slot="docx-viewer"] .docx-wrapper > section.docx {
  margin-bottom: 0;
  box-shadow: 0 0 0 1px var(--border), 0 1px 2px 0 rgb(0 0 0 / 0.05);
}`

/** Client gate without an effect — false during SSR, true after hydration. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

// --- public API --------------------------------------------------------------

export type DocxDocumentSource = UrlViewerSource | BlobViewerSource

/**
 * Imperative handle for driving the viewer from outside (e.g. scroll to the
 * source of a hovered field). Obtain it with a `ref` on `<DocxViewer>`.
 */
/**
 * A resolved, viewer-ready locator for a docx source — what the `docx-source`
 * adapter produces from an anchor (mirroring how the PDF adapter produces a page
 * `{ page, area }`). The viewer does the DOM resolution, since only it holds the
 * rendered document: a cell by index, or text by content match.
 */
export type DocxTarget =
  | { kind: "text"; text: string }
  | { kind: "cell"; table: number; row: number; column: number }

export interface DocxViewerHandle {
  /**
   * Scroll the element backing a resolved target into view. No-op if it can't be
   * located. Like the other viewers, this takes resolved coordinates (the adapter
   * turns an anchor into a `DocxTarget`), not a raw source.
   */
  scrollToTarget: (target: DocxTarget, options?: ScrollIntoViewOptions) => void
  /** The scrolling viewport element, or null before the document renders. */
  getViewportElement: () => HTMLDivElement | null
}

export interface DocxViewerProps {
  /** Canonical DOCX source. */
  source: DocxDocumentSource
  className?: string
  /** Fixed zoom; when omitted the viewer fits page width to the container. */
  scale?: number
  toolbar?: boolean
  /**
   * A resolved target to highlight in the document. Feed
   * `useSourceLink(...).activeSource` through the `docx-source` adapter's
   * `sourceToDocxHighlight`.
   */
  highlight?: DocxTarget | null
  /** Fired with the 1-based page nearest the top of the viewport as you scroll. */
  onVisiblePageChange?: (page: number) => void
  /** Fired with scroll progress in [0, 1] (for a fine-grained scroll cursor). */
  onScrollProgressChange?: (progress: number) => void
  /** Drop the outer border/rounded/background so the viewer fills its container. */
  bare?: boolean
  /** Rendered as a full-width strip directly below the toolbar (e.g. a legend). */
  header?: React.ReactNode
  /** Rendered as a left rail alongside the scrolling pages (e.g. a page ribbon). */
  aside?: React.ReactNode
}

export type DocxResourceViewerProps = Omit<DocxViewerProps, "source"> & {
  resource: ViewerResource
}

// --- source locating ---------------------------------------------------------
// docx-preview renders flowed, paginated HTML with no anchor indices, so a source
// is located in the rendered DOM: table cells by their structural index (reliable
// — docx-preview preserves table/row/cell order), text spans by matching the
// source's quoted `content` (robust to paragraph-index drift between the backend's
// docx parser and the renderer). Both yield a Range the viewer scrolls/highlights.

/** A Range over the contents of the (table, row, column)-indexed cell, or null. */
function tableCellRange(
  root: HTMLElement,
  table: number,
  row: number,
  column: number
): Range | null {
  const t = root.querySelectorAll(".docx-wrapper > section.docx table")[
    table
  ] as HTMLTableElement | undefined
  const cell = t?.rows[row]?.cells[column]
  if (!cell) return null
  if (hasHiddenAncestor(cell, root)) return null
  const range = document.createRange()
  range.selectNodeContents(cell)
  return range
}

/** A Range over the first whitespace-insensitive match of `query` in `root`, or null. */
function textContentRange(root: HTMLElement, query: string): Range | null {
  const needle = normalizeTextTarget(query)
  if (!needle) return null
  // Concatenate the visible text, collapsing whitespace runs to a single space,
  // and remember each normalized character's source (text node + offset) so a
  // match maps back to a DOM Range — even when it spans multiple run <span>s.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let normalized = ""
  const at: { node: Text; offset: number }[] = []
  let prevSpace = false
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!isDocumentTextNode(root, n as Text)) continue
    const data = (n as Text).data
    for (let i = 0; i < data.length; i++) {
      if (/\s/.test(data[i])) {
        if (prevSpace) continue
        prevSpace = true
        normalized += " "
      } else {
        prevSpace = false
        normalized += data[i]
      }
      at.push({ node: n as Text, offset: i })
    }
  }
  const idx = normalized.indexOf(needle)
  if (idx === -1) return null
  const start = at[idx]
  const end = at[idx + needle.length - 1]
  if (!start || !end) return null
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset + 1)
  return range
}

function isDocumentTextNode(root: HTMLElement, node: Text) {
  const parent = node.parentElement
  if (!parent || !root.contains(parent)) return false
  if (!parent.closest(".docx-wrapper > section.docx")) return false
  if (parent.closest("style, script, noscript, template")) return false
  return !hasHiddenAncestor(parent, root)
}

function hasHiddenAncestor(element: HTMLElement, root: HTMLElement) {
  for (let el: HTMLElement | null = element; el; el = el.parentElement) {
    if (
      el.hidden ||
      el.getAttribute("aria-hidden")?.trim().toLowerCase() === "true"
    ) {
      return true
    }
    const style =
      typeof window !== "undefined" ? window.getComputedStyle(el) : el.style
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.getPropertyValue("content-visibility") === "hidden"
    ) {
      return true
    }
    if (el === root) break
  }
  return false
}

/** Resolve a target to a DOM Range in the rendered document, or null. */
function targetRange(root: HTMLElement, target: DocxTarget): Range | null {
  return target.kind === "cell"
    ? tableCellRange(root, target.table, target.row, target.column)
    : textContentRange(root, target.text)
}

/** Stable value key for a target, so the highlight effect re-runs on change only. */
function targetKey(target: DocxTarget | null | undefined): string | null {
  if (!target) return null
  return target.kind === "cell"
    ? `cell:${target.table}:${target.row}:${target.column}`
    : `text:${normalizeTextTarget(target.text)}`
}

function normalizeTextTarget(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export const DocxViewer = React.forwardRef<DocxViewerHandle, DocxViewerProps>(
  function DocxViewer(props, ref) {
    const { source, ...resourceProps } = props
    const resource = React.useMemo(() => createViewerResource(source), [source])
    return (
      <DocxResourceViewer {...resourceProps} ref={ref} resource={resource} />
    )
  }
)

export const DocxResourceViewer = React.forwardRef<
  DocxViewerHandle,
  DocxResourceViewerProps
>(function DocxResourceViewer(props, ref) {
  const isClient = useIsClient()
  const resource = props.resource
  if (!isClient) {
    return (
      <DocxViewerFallback
        aside={props.aside}
        bare={props.bare}
        className={props.className}
        header={props.header}
        toolbar={props.toolbar}
      />
    )
  }
  return (
    <ViewerErrorBoundary
      bare={props.bare}
      className={props.className}
      download={resource.originalDownload}
      format="docx"
      onRetry={(error) => {
        if (isResourceError(error) || !isViewerFormatError(error)) {
          clearDocxResource(resource.content)
        }
      }}
      resetKey={resource.keys.resource}
      sourceKind={resource.sourceKind}
    >
      <React.Suspense
        fallback={
          <DocxViewerFallback
            aside={props.aside}
            bare={props.bare}
            className={props.className}
            header={props.header}
            toolbar={props.toolbar}
          />
        }
      >
        <DocxViewerInner {...props} forwardedRef={ref} resource={resource} />
      </React.Suspense>
    </ViewerErrorBoundary>
  )
})

function DocxViewerInner({
  resource,
  className,
  scale: fixedScale,
  toolbar = true,
  onVisiblePageChange,
  onScrollProgressChange,
  bare = false,
  header,
  aside,
  highlight,
  forwardedRef,
}: Omit<DocxViewerProps, "source"> & {
  forwardedRef?: React.ForwardedRef<DocxViewerHandle>
  resource: ViewerResource
}) {
  const buffer = React.use(
    getDocxResource(resource.content, { retainRejected: true })
  )

  const [manualScale, setManualScale] = React.useState<number | null>(
    normalizeScale(fixedScale)
  )
  React.useEffect(() => {
    setManualScale(normalizeScale(fixedScale))
  }, [fixedScale])
  const [containerWidth, setContainerWidth] = React.useState<number | null>(
    null
  )
  // Known only after docx-preview lays the document out.
  const [numPages, setNumPages] = React.useState(0)
  const [pageWidth, setPageWidth] = React.useState<number | null>(null)
  const [ready, setReady] = React.useState(false)
  const [renderError, setRenderError] = React.useState<Error | null>(null)
  if (renderError) throw renderError

  // Measure the container with a ResizeObserver attached in the ref callback.
  // Coalesce to one update per frame so dragging a resize handle doesn't trigger
  // a fit-width recompute per pixel.
  const containerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setContainerWidth(el.clientWidth)
    if (typeof ResizeObserver === "undefined") return
    let frame = 0
    let latest = el.clientWidth
    const observer = new ResizeObserver((entries) => {
      // Use clientWidth (content + padding), matching the init read above, so
      // the `- 32` in fitScale subtracts the p-4 padding exactly once. Using
      // entry.contentRect.width here (which already excludes padding) would
      // double-subtract it, shrinking the page 32px below the full content
      // width — and below the w-full skeleton that stands in for it.
      for (const entry of entries)
        latest = (entry.target as HTMLElement).clientWidth
      if (frame) return
      frame = -1
      const requestedFrame = requestAnimationFrame(() => {
        frame = 0
        setContainerWidth(latest)
      })
      if (frame === -1) frame = requestedFrame
    })
    observer.observe(el)
    return () => {
      if (frame > 0) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  // Report the page nearest the top of the scroll viewport as the user scrolls.
  // We watch the actual scroll container (not the browser viewport) so the
  // current-page cursor stays in sync even when the viewer is embedded.
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null)
  const lastReported = React.useRef(0)
  // The page nearest the top of the viewport, shown as "Page N of M" in the toolbar.
  const [currentPage, setCurrentPage] = React.useState(1)
  // Coalesce scroll work to one frame: the layout reads below (getBoundingClientRect
  // over every page) shouldn't run on every scroll event.
  const scrollFrame = React.useRef(0)
  const measureScroll = React.useCallback(() => {
    scrollFrame.current = 0
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const scrollable = viewport.scrollHeight - viewport.clientHeight
    onScrollProgressChange?.(
      scrollable > 0 ? clamp(viewport.scrollTop / scrollable, 0, 1) : 0
    )
    const rect = viewport.getBoundingClientRect()
    const marker = rect.top + rect.height * 0.2
    const pages = viewport.querySelectorAll<HTMLElement>("[data-page-number]")
    let current = 1
    for (const el of pages) {
      if (el.getBoundingClientRect().top <= marker) {
        current = Number(el.dataset.pageNumber)
      } else {
        break
      }
    }
    if (current && current !== lastReported.current) {
      lastReported.current = current
      setCurrentPage(current)
      onVisiblePageChange?.(current)
    }
  }, [onVisiblePageChange, onScrollProgressChange])
  const handleScroll = React.useCallback(() => {
    if (scrollFrame.current) return
    scrollFrame.current = -1
    const requestedFrame = requestAnimationFrame(measureScroll)
    if (scrollFrame.current === -1) scrollFrame.current = requestedFrame
  }, [measureScroll])
  React.useEffect(() => {
    if (ready) measureScroll()
  }, [measureScroll, ready])
  React.useEffect(
    () => () => {
      if (scrollFrame.current > 0) cancelAnimationFrame(scrollFrame.current)
    },
    []
  )

  const fitScale =
    containerWidth && pageWidth
      ? clamp((containerWidth - 32) / pageWidth, 0.25, 5)
      : 1
  const scale = manualScale ?? fitScale
  const isScaleControlled = fixedScale != null
  // Mirror the live scale into a ref so the render effect can divide measured
  // (zoomed) page sizes back to natural units without re-running on every zoom.
  const scaleRef = React.useRef(scale)
  React.useEffect(() => {
    scaleRef.current = scale
  })

  // Render the document once per source. docx-preview writes imperatively into
  // `host`, which React keeps empty, so the two never fight over the subtree.
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setReady(false)
    setNumPages(0)
    setCurrentPage(1)
    lastReported.current = 0
    if (scrollViewportRef.current) scrollViewportRef.current.scrollTop = 0
    host.replaceChildren()
    loadDocxPreview()
      .then(({ renderAsync }) => {
        if (cancelled) return
        const renderHost = document.createElement("div")
        return renderAsync(buffer, renderHost, undefined, RENDER_OPTIONS).then(
          () => renderHost
        )
      })
      .then((renderHost) => {
        if (cancelled || !hostRef.current) return
        if (renderHost)
          host.replaceChildren(...Array.from(renderHost.childNodes))
        // Tag pages for scroll tracking and hand off-screen pages to the browser
        // via `content-visibility` — a long document then only lays out and
        // paints the pages near the viewport. Intrinsic sizes (measured in the
        // page's own, un-zoomed units) keep the scrollbar stable.
        const pages = Array.from(
          host.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
        )
        if (!pages.length) {
          throw new ViewerFormatError({
            format: "docx",
            kind: "render_failed",
            message: "DOCX render produced no pages.",
          })
        }
        const z = scaleRef.current || 1
        // Two passes so we never interleave reads with writes: measure everything
        // first (one layout), then style everything. Interleaving would force a
        // synchronous reflow per page — O(n) layout thrash on long documents.
        const sizes = pages.map((el) => {
          const r = el.getBoundingClientRect()
          const width = positivePixel(Math.round(r.width / z))
          const height = positivePixel(Math.round(r.height / z))
          return [
            width ?? DEFAULT_PAGE_WIDTH,
            height ?? DEFAULT_PAGE_HEIGHT,
          ] as const
        })
        pages.forEach((el, i) => {
          el.dataset.pageNumber = String(i + 1)
          el.style.contentVisibility = "auto"
          el.style.containIntrinsicSize = `${sizes[i][0]}px ${sizes[i][1]}px`
        })
        setNumPages(pages.length)
        setPageWidth(pages.length ? sizes[0][0] : null)
        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setRenderError(
            isResourceError(err)
              ? err
              : toDocxFormatError(err, {
                  kind: "render_failed",
                  message: "Failed to render DOCX.",
                })
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [buffer])

  const zoom = (factor: number) => {
    if (isScaleControlled) return
    setManualScale(clamp(scale * factor, 0.25, 5))
  }
  const fitWidth = () => {
    if (isScaleControlled) return
    setManualScale(null)
  }

  // CSS Custom Highlight API: mark the active source's Range without mutating
  // docx-preview's DOM (wrapping nodes would disturb its layout). The registry is
  // global and keyed by name, so each instance uses a unique name + its own
  // `::highlight()` rule (injected in the JSX) to avoid cross-instance collisions.
  const highlightName = "docx-src-" + React.useId().replace(/:/g, "")
  // Keyed on the target's value, not its identity: the adapter builds a fresh
  // DocxTarget object each render, so an identity dep would re-run every render.
  const highlightKey = targetKey(highlight)
  React.useEffect(() => {
    const host = hostRef.current
    const registry =
      typeof CSS !== "undefined" && "highlights" in CSS ? CSS.highlights : null
    if (!registry || typeof Highlight === "undefined" || !host) return
    // Re-runs when the doc becomes `ready`, so a highlight set before render lands.
    if (!highlight || !ready) {
      registry.delete(highlightName)
      return
    }
    const range = targetRange(host, highlight)
    if (range) registry.set(highlightName, new Highlight(range))
    else registry.delete(highlightName)
    return () => {
      registry.delete(highlightName)
    }
    // highlight is read but the value-key gates re-runs; identity would thrash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightKey, ready, highlightName])

  // Imperative handle: scroll the element backing a resolved target into view.
  // `scrollIntoView` (not manual math) so it also reveals content on
  // `content-visibility: auto` pages, whose off-screen geometry isn't measurable.
  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToTarget: (target, options) => {
        const host = hostRef.current
        if (!host) return
        const node = targetRange(host, target)?.startContainer
        const el =
          node?.nodeType === Node.ELEMENT_NODE
            ? (node as HTMLElement)
            : (node?.parentElement ?? null)
        el?.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: options?.behavior ?? "smooth",
          ...options,
        })
      },
      getViewportElement: () => scrollViewportRef.current,
    }),
    []
  )

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="docx-viewer"
    >
      <style>{SCOPED_STYLES}</style>
      {/* Per-instance source-highlight tint (CSS Custom Highlight API). */}
      <style>{`::highlight(${highlightName}){background-color:color-mix(in oklab, var(--primary) 22%, transparent);}`}</style>
      {toolbar ? (
        <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {ready ? (
              <>
                Page {Math.min(currentPage, numPages)} of {numPages}
              </>
            ) : (
              // Page count is unknown until docx-preview lays out — skeleton it.
              <Skeleton className="inline-block h-3 w-12 align-middle" />
            )}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Zoom out" onClick={() => zoom(1 / 1.2)}>
              <Minus />
            </IconButton>
            <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
              {ready ? (
                `${Math.round(scale * 100)}%`
              ) : (
                // Fit-width % depends on the measured page width — skeleton it.
                <Skeleton className="inline-block h-3 w-8 align-middle" />
              )}
            </span>
            <IconButton label="Zoom in" onClick={() => zoom(1.2)}>
              <Plus />
            </IconButton>
            <IconButton label="Fit width" onClick={fitWidth}>
              <Maximize />
            </IconButton>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <ViewerDownloadButton action={resource.originalDownload} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {aside ? (
          <div data-slot="docx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="docx-viewer-header">{header}</div> : null}
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={scrollViewportRef}
            // Always track scroll so the toolbar's "Page N of M" updates.
            viewportProps={{ onScroll: handleScroll }}
          >
            <div ref={containerRef} className="flex flex-col items-center p-4">
              {/* A document-shaped skeleton stands in for the pages until
                  docx-preview lays them out. Rendered before the host (which is
                  taller than the viewport) so the invisible, not-yet-measured
                  host stays below the fold during the brief measure window. */}
              {!ready ? <DocxSkeleton /> : null}
              {/* docx-preview renders the .docx-wrapper into this host; `zoom`
                  scales the laid-out pages (and scroll height) cheaply. Kept
                  invisible (not display:none — it must stay measurable) until
                  `ready`, so the first frame the user sees is already at the
                  measured fit-width zoom. Otherwise the page paints at zoom 1,
                  then snaps to fit once measured — the load flicker/resize. */}
              <div
                ref={hostRef}
                className={cn(
                  "w-full transition-opacity duration-200",
                  ready ? "opacity-100" : "opacity-0"
                )}
                style={{ zoom: scale }}
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function toDocxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError {
  if (isViewerFormatError(error)) return error
  return new ViewerFormatError({
    format: "docx",
    kind: options.kind,
    message: options.message,
    cause: error,
  })
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  )
}

// Shown while the document resource and docx-preview load (before DocxViewerInner
// mounts). Same chrome as the loaded viewer — a toolbar with skeletoned values
// plus a document-shaped skeleton — so the topbar is always present and there is
// no spinner anywhere; nothing jumps when the real document fades in.
function DocxViewerFallback({
  className,
  bare = false,
  toolbar = true,
  header,
  aside,
}: {
  className?: string
  bare?: boolean
  toolbar?: boolean
  header?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="docx-viewer"
    >
      {toolbar ? <DocxToolbarSkeleton /> : null}
      <div className="flex min-h-0 flex-1">
        {aside ? (
          <div data-slot="docx-viewer-aside" className="flex-shrink-0">
            {aside}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? <div data-slot="docx-viewer-header">{header}</div> : null}
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex flex-col items-center p-4">
              <DocxSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// A static mirror of the real toolbar: the two undetermined values (page count,
// zoom %) are skeletons; the controls are present but inert.
function DocxToolbarSkeleton() {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      <span className="px-1">
        <Skeleton className="inline-block h-3 w-12 align-middle" />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ToolbarIconPlaceholder>
          <Minus />
        </ToolbarIconPlaceholder>
        <span className="w-12 text-center">
          <Skeleton className="inline-block h-3 w-8 align-middle" />
        </span>
        <ToolbarIconPlaceholder>
          <Plus />
        </ToolbarIconPlaceholder>
        <ToolbarIconPlaceholder>
          <Maximize />
        </ToolbarIconPlaceholder>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToolbarIconPlaceholder>
          <Download />
        </ToolbarIconPlaceholder>
      </div>
    </div>
  )
}

function ToolbarIconPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      disabled
      tabIndex={-1}
      aria-hidden
    >
      {children}
    </Button>
  )
}

// A plain gray page-shaped block stands in for the document while it loads.
// The sample is US Letter (w:pgSz 12240 × 15840 twips = 8.5" × 11"), so the
// aspect matches the rendered page; `w-full` inside the container's p-4 equals
// the fit-width page width — so the block is the same size as the document that
// replaces it. (For A4 docs this would be 210 / 297.)
function DocxSkeleton() {
  return (
    <Skeleton
      aria-hidden
      className="w-full rounded-sm"
      style={{ aspectRatio: "8.5 / 11" }}
    />
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function positivePixel(value: number) {
  return Number.isFinite(value) && value > 0 ? value : null
}

function normalizeScale(value: number | null | undefined) {
  if (value == null) return null
  if (Number.isNaN(value)) return 1
  return clamp(value, 0.25, 5)
}
