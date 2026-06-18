"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"

import { ScrollArea } from "./scroll-area"
import { TextViewerControls, TextViewerFrame } from "./text-viewer-chrome"
import {
  createPreparedTextDocument,
  getCodeVisibleLineWindow,
  getInlineVisibleLineWindow,
  getTableVisibleRowWindow,
  layoutTextDocument,
  materializeCodeVisibleLines,
  materializeInlineVisibleLines,
  resolveTextViewerMode,
  serializeMarkdownTableForClipboard,
  textFrameIntersectsLineRange,
  type CodeTextBlockFrame,
  type ImageTextBlockFrame,
  type InlineTextBlockFrame,
  type PreparedCodeTextBlock,
  type PreparedImageTextBlock,
  type PreparedInlineTextBlock,
  type PreparedRuleTextBlock,
  type PreparedTableCell,
  type PreparedTableTextBlock,
  type PreparedTextBlock,
  type RuleTextBlockFrame,
  type TableTextBlockFrame,
  type TextBlockFrame,
  type TextDocumentFrame,
} from "./text-viewer-layout"
import { isLineInRange, normalizeTextLineRange } from "./text-viewer-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
} from "./text-viewer-resource"
import { clampTextViewerScale } from "./text-viewer-scale"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"
import {
  getTextFrameScrollAnchor,
  getTextFrameVirtualItems,
  type TextFrameScrollAnchor,
} from "./text-viewer-virtualization"

const TEXT_VIEWER_HORIZONTAL_PADDING = 16
const TEXT_VIEWER_DEFAULT_VIEWPORT_HEIGHT = 600
const TEXT_VIEWER_DEFAULT_VIEWPORT_WIDTH = 800
const TEXT_VIEWER_INITIAL_TEXT_WIDTH = 768
const TEXT_VIEWER_OVERSCAN_PX = 320
const TEXT_VIEWER_HIGHLIGHT_BACKGROUND =
  "color-mix(in oklab, var(--foreground) 8%, var(--background))"
const TEXT_VIEWER_HIGHLIGHT_ACCENT_SHADOW = "inset 2px 0 0 0 var(--primary)"

type CachedRow = {
  renderKey: string
  row: HTMLDivElement
}

type ProjectionCache = {
  frame: TextDocumentFrame | null
  mountedEnd: number
  mountedStart: number
  preparedDocument: ReturnType<typeof createPreparedTextDocument> | null
  rows: Array<CachedRow | undefined>
}

type ProjectionState = {
  cache: ProjectionCache
  canvas: HTMLDivElement | null
  contentWidth: number
  frame: TextDocumentFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  preparedDocument: ReturnType<typeof createPreparedTextDocument>
  viewportHeight: number
}

type ViewportSize = {
  height: number
  width: number
}

export function ChenglouTextViewerContent({
  resource,
  className,
  controls = true,
  download = true,
  highlight,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
  mode: forcedMode,
  projection = "chenglou",
}: TextViewerProps & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<TextViewerHandle>
  projection?: "chenglou" | "vanillacheng"
}) {
  const bounds = React.useMemo(
    () => resolvedTextViewerBounds({ maxBytes, maxLines }),
    [maxBytes, maxLines]
  )
  const text = React.useMemo(
    () =>
      readTextResource({
        bounds,
        content: resource.content,
        retryVersion,
      }),
    [bounds, resource.content, retryVersion]
  )
  const mode = React.useMemo(
    () =>
      forcedMode ??
      resolveTextViewerMode({
        fileName: resource.fileName,
        mimeType: resource.content.mimeType,
      }),
    [forcedMode, resource.content.mimeType, resource.fileName]
  )
  const downloadAction = download ? resource.originalDownload : null
  const [fontScale, setFontScale] = React.useState(1)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLDivElement | null>(null)
  const projectionCacheRef = React.useRef<ProjectionCache>({
    frame: null,
    mountedEnd: 0,
    mountedStart: 0,
    preparedDocument: null,
    rows: [],
  })
  const pendingScrollAnchorRef = React.useRef<TextFrameScrollAnchor | null>(
    null
  )
  const projectionStateRef = React.useRef<ProjectionState | null>(null)
  const scheduledRenderRef = React.useRef<number | null>(null)
  const fontEpoch = useTextViewerFontEpoch()
  const [contentWidth, setContentWidth] = React.useState(
    TEXT_VIEWER_INITIAL_TEXT_WIDTH
  )
  const [viewportSize, setViewportSize] = React.useState<ViewportSize>({
    height: 0,
    width: 0,
  })
  const viewportHeight =
    viewportSize.height || TEXT_VIEWER_DEFAULT_VIEWPORT_HEIGHT
  const viewportWidth = viewportSize.width || TEXT_VIEWER_DEFAULT_VIEWPORT_WIDTH

  const preparedDocument = React.useMemo(
    () =>
      createPreparedTextDocument({
        mode,
        style: { fontScale: 1 },
        text,
      }),
    [fontEpoch, mode, text]
  )
  const frame = React.useMemo(
    () =>
      layoutTextDocument({
        contentWidth,
        document: preparedDocument,
        fontScale,
      }),
    [contentWidth, fontScale, preparedDocument]
  )
  const highlightStart = highlight?.start
  const highlightEnd = highlight?.end
  const highlightRange = React.useMemo(
    () =>
      normalizeTextLineRange(
        highlightStart == null || highlightEnd == null
          ? null
          : { end: highlightEnd, start: highlightStart },
        preparedDocument.sourceLineCount
      ),
    [highlightEnd, highlightStart, preparedDocument.sourceLineCount]
  )

  const captureScrollAnchor = React.useCallback(() => {
    pendingScrollAnchorRef.current = getTextFrameScrollAnchor({
      frames: frame.frames,
      scrollTop: viewportRef.current?.scrollTop ?? 0,
    })
  }, [frame.frames])

  const projectCurrentRows = React.useCallback(() => {
    const state = projectionStateRef.current
    if (!state) return

    const scrollElement = viewportRef.current

    projectRows({
      cache: state.cache,
      canvas: state.canvas,
      contentWidth: state.contentWidth,
      frame: state.frame,
      highlightRange: state.highlightRange,
      preparedDocument: state.preparedDocument,
      scrollTop: scrollElement?.scrollTop ?? 0,
      viewportHeight: scrollElement?.clientHeight || state.viewportHeight,
    })
  }, [])

  const scheduleProjectRows = React.useCallback(() => {
    if (scheduledRenderRef.current !== null) return
    scheduledRenderRef.current = requestAnimationFrame(
      function renderChenglouTextFrame() {
        scheduledRenderRef.current = null
        projectCurrentRows()
      }
    )
  }, [projectCurrentRows])

  React.useLayoutEffect(() => {
    const scrollElement = viewportRef.current
    if (!scrollElement) return

    const readViewportSize = () => {
      const nextWidth = scrollElement.clientWidth
      const nextHeight = scrollElement.clientHeight
      setViewportSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { height: nextHeight, width: nextWidth }
      )
    }

    readViewportSize()
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(readViewportSize)
    resizeObserver?.observe(scrollElement)

    return () => {
      resizeObserver?.disconnect()
    }
  }, [])

  React.useLayoutEffect(() => {
    const scrollElement = viewportRef.current
    if (!scrollElement) return

    scrollElement.addEventListener("scroll", scheduleProjectRows, {
      passive: true,
    })

    return () => {
      scrollElement.removeEventListener("scroll", scheduleProjectRows)
    }
  }, [scheduleProjectRows])

  React.useLayoutEffect(() => {
    const nextContentWidth = Math.max(
      1,
      viewportWidth - TEXT_VIEWER_HORIZONTAL_PADDING * 2
    )
    setContentWidth((current) => {
      if (current === nextContentWidth) return current
      captureScrollAnchor()
      return nextContentWidth
    })
  }, [captureScrollAnchor, viewportWidth])

  React.useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current
    const scrollElement = viewportRef.current
    if (!anchor || !scrollElement) return

    pendingScrollAnchorRef.current = null
    const nextFrame = frame.frames[anchor.index]
    if (!nextFrame) return

    scrollElement.scrollTop = Math.max(
      0,
      nextFrame.top +
        Math.min(anchor.offsetWithinFrame, Math.max(0, nextFrame.height - 1))
    )
  }, [frame.frames])

  React.useLayoutEffect(() => {
    projectionStateRef.current = {
      cache: projectionCacheRef.current,
      canvas: canvasRef.current,
      contentWidth,
      frame,
      highlightRange,
      preparedDocument,
      viewportHeight,
    }
    projectCurrentRows()
  }, [
    contentWidth,
    frame,
    highlightRange,
    projectCurrentRows,
    preparedDocument,
    viewportHeight,
  ])

  React.useEffect(
    () => () => {
      if (scheduledRenderRef.current !== null) {
        cancelAnimationFrame(scheduledRenderRef.current)
      }
    },
    []
  )

  const scrollLineRange = React.useCallback(
    (
      range: ReturnType<typeof normalizeTextLineRange>,
      options?: ScrollToOptions
    ) => {
      const scrollElement = viewportRef.current
      if (!scrollElement || !range) return

      const targetFrame =
        frame.frames.find((item) =>
          textFrameIntersectsLineRange({ frame: item, range })
        ) ?? frame.frames[0]
      if (!targetFrame) return

      const targetTop =
        targetFrame.height <= scrollElement.clientHeight
          ? targetFrame.top -
            (scrollElement.clientHeight - targetFrame.height) / 2
          : targetFrame.top

      scrollElement.scrollTo({
        behavior: "smooth",
        top: Math.max(0, targetTop),
        ...options,
      })
    },
    [frame.frames]
  )

  const zoom = (factor: number) => {
    captureScrollAnchor()
    setFontScale((scale) => clampTextViewerScale(scale * factor))
  }

  const resetZoom = () => {
    captureScrollAnchor()
    setFontScale(1)
  }

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      getViewportElement: () => viewportRef.current,
      scrollToLineRange: (range, options) => {
        scrollLineRange(
          normalizeTextLineRange(range, preparedDocument.sourceLineCount),
          options
        )
      },
    }),
    [preparedDocument.sourceLineCount, scrollLineRange]
  )

  React.useEffect(() => {
    scrollLineRange(highlightRange)
  }, [highlightRange, scrollLineRange])

  const scrollMarkdownFragment = React.useCallback(
    (event: React.MouseEvent) => {
      const href = localFragmentHrefFromEventTarget(event.target)
      if (!href) return

      const targetId = decodeMarkdownFragmentHref(href)
      const targetIndex = markdownHeadingBlockIndex(
        preparedDocument.blocks,
        targetId
      )
      const targetFrame = frame.frames[targetIndex]
      const scrollElement = viewportRef.current
      if (!targetFrame || !scrollElement) return

      event.preventDefault()
      scrollElement.scrollTo({
        behavior: "smooth",
        top: Math.max(0, targetFrame.top),
      })
      if (window.location.hash !== href) {
        window.history.replaceState(null, "", href)
      }
    },
    [frame.frames, preparedDocument.blocks]
  )

  return (
    <TextViewerFrame className={className} bare={bare}>
      {controls ? (
        <TextViewerControls
          wordCount={preparedDocument.wordCount}
          fontScale={fontScale}
          downloadAction={downloadAction}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={resetZoom}
        />
      ) : null}
      <ScrollArea
        className="min-h-0 flex-1 bg-background"
        orientation="vertical"
        viewportClassName="bg-background"
        viewportProps={{ onClickCapture: scrollMarkdownFragment }}
        viewportRef={viewportRef}
      >
        <div
          ref={canvasRef}
          className="relative min-w-0"
          data-slot="text-virtual-canvas"
          data-projection={projection}
          style={{
            height: frame.totalHeight,
            minWidth: viewportWidth,
          }}
        />
      </ScrollArea>
    </TextViewerFrame>
  )
}

function projectRows({
  cache,
  canvas,
  contentWidth,
  frame,
  highlightRange,
  preparedDocument,
  scrollTop,
  viewportHeight,
}: {
  cache: ProjectionCache
  canvas: HTMLDivElement | null
  contentWidth: number
  frame: TextDocumentFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  preparedDocument: ReturnType<typeof createPreparedTextDocument>
  scrollTop: number
  viewportHeight: number
}) {
  if (!canvas) return

  if (cache.frame !== frame || cache.preparedDocument !== preparedDocument) {
    canvas.replaceChildren()
    cache.frame = frame
    cache.mountedEnd = 0
    cache.mountedStart = 0
    cache.preparedDocument = preparedDocument
    cache.rows = []
  }

  canvas.style.height = `${frame.totalHeight}px`
  const virtualItems = getTextFrameVirtualItems({
    frames: frame.frames,
    overscanPx: TEXT_VIEWER_OVERSCAN_PX,
    scrollTop,
    viewportHeight,
  })
  const start = virtualItems[0]?.index ?? 0
  const end = virtualItems.length
    ? virtualItems[virtualItems.length - 1]!.index + 1
    : start
  const previousStart = cache.mountedStart
  const previousEnd = cache.mountedEnd
  const overlapStart = Math.max(start, previousStart)
  const overlapEnd = Math.min(end, previousEnd)

  for (
    let index = previousStart;
    index < Math.min(previousEnd, start);
    index++
  ) {
    removeCachedRow(cache, index)
  }
  for (let index = Math.max(previousStart, end); index < previousEnd; index++) {
    removeCachedRow(cache, index)
  }

  const viewportTop = scrollTop - TEXT_VIEWER_OVERSCAN_PX
  const viewportBottom = scrollTop + viewportHeight + TEXT_VIEWER_OVERSCAN_PX
  const project = (index: number) => {
    const block = preparedDocument.blocks[index]
    const blockFrame = frame.frames[index]
    if (!block || !blockFrame) return null
    const cachedRow = prepareRow({
      block,
      cache,
      contentWidth,
      frame: blockFrame,
      highlightRange,
      index,
      viewportBottom,
      viewportTop,
    })
    projectRowNode(cachedRow.row, blockFrame)
    return cachedRow.row
  }

  if (overlapStart >= overlapEnd) {
    for (let index = start; index < end; index++) {
      const row = project(index)
      if (row && row.parentNode === null) canvas.append(row)
    }
  } else {
    let anchorRow = cache.rows[overlapStart]?.row ?? null
    for (let index = overlapStart - 1; index >= start; index--) {
      const row = project(index)
      if (!row) continue
      if (anchorRow === null) {
        if (row.parentNode === null) canvas.append(row)
      } else if (row.parentNode !== canvas || row.nextSibling !== anchorRow) {
        canvas.insertBefore(row, anchorRow)
      }
      anchorRow = row
    }

    for (let index = overlapStart; index < overlapEnd; index++) {
      project(index)
    }

    for (let index = overlapEnd; index < end; index++) {
      const row = project(index)
      if (row && row.parentNode === null) canvas.append(row)
    }
  }

  cache.mountedStart = start
  cache.mountedEnd = end
}

function removeCachedRow(cache: ProjectionCache, index: number) {
  const cachedRow = cache.rows[index]
  if (!cachedRow) return
  cachedRow.row.remove()
  cache.rows[index] = undefined
}

function prepareRow({
  block,
  cache,
  contentWidth,
  frame,
  highlightRange,
  index,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedTextBlock
  cache: ProjectionCache
  contentWidth: number
  frame: TextBlockFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  index: number
  viewportBottom: number
  viewportTop: number
}): CachedRow {
  let cachedRow = cache.rows[index]
  if (!cachedRow) {
    cachedRow = {
      renderKey: "",
      row: document.createElement("div"),
    }
    cache.rows[index] = cachedRow
  }

  const renderKey = rowRenderKey({
    block,
    contentWidth,
    frame,
    highlightRange,
    viewportBottom,
    viewportTop,
  })
  if (cachedRow.renderKey !== renderKey) {
    cachedRow.renderKey = renderKey
    renderRowContent({
      block,
      contentWidth,
      frame,
      highlightRange,
      row: cachedRow.row,
      viewportBottom,
      viewportTop,
    })
  }
  return cachedRow
}

function projectRowNode(row: HTMLDivElement, frame: TextBlockFrame) {
  row.style.height = `${frame.height}px`
  row.style.transform = `translateY(${frame.top}px)`
}

function rowRenderKey({
  block,
  contentWidth,
  frame,
  highlightRange,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedTextBlock
  contentWidth: number
  frame: TextBlockFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  viewportBottom: number
  viewportTop: number
}) {
  return [
    block.kind,
    contentWidth,
    frame.height,
    frame.top,
    frame.scale,
    highlightRange?.start ?? "",
    highlightRange?.end ?? "",
    blockVisibleWindowKey(frame, viewportTop, viewportBottom),
  ].join(":")
}

function renderRowContent({
  block,
  contentWidth,
  frame,
  highlightRange,
  row,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedTextBlock
  contentWidth: number
  frame: TextBlockFrame
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  row: HTMLDivElement
  viewportBottom: number
  viewportTop: number
}) {
  const isHighlighted = textFrameIsHighlighted(frame, highlightRange)
  row.replaceChildren()
  row.className = "absolute left-0 w-full px-4"
  row.dataset.slot = "text-line"
  row.dataset.sourceLine = String(frame.sourceStartLine)
  if (isHighlighted) {
    row.dataset.textHighlighted = ""
  } else {
    delete row.dataset.textHighlighted
  }
  if (block.kind === "inline" && block.headingId) {
    row.id = block.headingId
    row.dataset.headingId = block.headingId
  } else {
    row.removeAttribute("id")
    delete row.dataset.headingId
  }
  if (frame.listDepth) {
    row.dataset.listDepth = String(frame.listDepth)
  } else {
    delete row.dataset.listDepth
  }
  if (frame.quoteDepth) {
    row.dataset.quoteDepth = String(frame.quoteDepth)
  } else {
    delete row.dataset.quoteDepth
  }
  applyRowSemantics(row, block, frame)
  row.style.position = "absolute"
  row.style.left = "0"
  row.style.width = "100%"
  row.style.paddingLeft = "16px"
  row.style.paddingRight = "16px"
  row.style.height = `${frame.height}px`
  row.style.transform = `translateY(${frame.top}px)`
  row.style.backgroundColor = isHighlighted
    ? TEXT_VIEWER_HIGHLIGHT_BACKGROUND
    : ""
  row.style.boxShadow = isHighlighted ? TEXT_VIEWER_HIGHLIGHT_ACCENT_SHADOW : ""

  appendBlockChrome(row, frame)

  switch (block.kind) {
    case "inline":
      renderInlineBlock({
        block,
        contentWidth,
        frame: frame as InlineTextBlockFrame,
        row,
        viewportBottom,
        viewportTop,
      })
      break
    case "code":
      renderCodeBlock({
        block,
        contentWidth,
        frame: frame as CodeTextBlockFrame,
        row,
        viewportBottom,
        viewportTop,
      })
      break
    case "image":
      renderImageBlock({
        block,
        frame: frame as ImageTextBlockFrame,
        row,
      })
      break
    case "rule":
      renderRuleBlock({
        frame: frame as RuleTextBlockFrame,
        row,
      })
      break
    case "table":
      renderTableBlock({
        block,
        frame: frame as TableTextBlockFrame,
        row,
        viewportBottom,
        viewportTop,
      })
      break
  }
}

function applyRowSemantics(
  row: HTMLDivElement,
  block: PreparedTextBlock,
  frame: TextBlockFrame
) {
  row.removeAttribute("role")
  row.removeAttribute("aria-level")

  if (block.kind === "inline") {
    const headingLevel = inlineHeadingLevel(block)
    if (headingLevel != null) {
      row.setAttribute("role", "heading")
      row.setAttribute("aria-level", String(headingLevel))
      return
    }
  }

  if (frame.markerText) {
    row.setAttribute("role", "listitem")
    row.setAttribute("aria-level", String(frame.listDepth))
  }
}

function inlineHeadingLevel(block: PreparedInlineTextBlock) {
  if (block.variant === "heading-1") return 1
  if (block.variant === "heading-2") return 2
  return null
}

function renderInlineBlock({
  block,
  contentWidth,
  frame,
  row,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedInlineTextBlock
  contentWidth: number
  frame: InlineTextBlockFrame
  row: HTMLDivElement
  viewportBottom: number
  viewportTop: number
}) {
  const lineWindow = getInlineVisibleLineWindow({
    frame,
    viewportBottom,
    viewportTop,
  })
  const lines = materializeInlineVisibleLines({
    block,
    frame,
    lineWindow,
    maxWidth: contentWidth,
    viewportBottom,
    viewportTop,
  })

  for (const line of lines) {
    const lineRow = document.createElement("div")
    lineRow.className = "absolute flex w-max items-center gap-0"
    lineRow.style.height = `${frame.lineHeight}px`
    lineRow.style.left = `${16 + frame.contentLeft}px`
    lineRow.style.top = `${line.top}px`
    lineRow.style.transform = `scale(${frame.scale})`
    lineRow.style.transformOrigin = "left top"

    for (const fragment of line.fragments) {
      const node = fragment.href
        ? document.createElement("a")
        : document.createElement("span")
      node.className = fragment.className
      node.textContent = fragment.text
      node.style.font = fragment.font
      node.style.letterSpacing = "0"
      if (fragment.leadingGap > 0) {
        node.style.marginLeft = `${fragment.leadingGap}px`
      }
      if (node instanceof HTMLAnchorElement && fragment.href) {
        node.href = fragment.href
        if (!isLocalFragmentHref(fragment.href)) {
          node.rel = "noopener noreferrer"
          node.target = "_blank"
        }
        if (fragment.title) node.title = fragment.title
      }
      lineRow.append(node)
    }
    row.append(lineRow)
  }
}

function renderCodeBlock({
  block,
  contentWidth,
  frame,
  row,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedCodeTextBlock
  contentWidth: number
  frame: CodeTextBlockFrame
  row: HTMLDivElement
  viewportBottom: number
  viewportTop: number
}) {
  const lineWindow = getCodeVisibleLineWindow({
    frame,
    viewportBottom,
    viewportTop,
  })
  const lines = materializeCodeVisibleLines({
    block,
    contentWidth,
    frame,
    lineWindow,
    viewportBottom,
    viewportTop,
  })
  const pre = document.createElement("pre")
  pre.className =
    "absolute overflow-hidden rounded-md border bg-muted text-foreground"
  pre.style.height = `${frame.height}px`
  pre.style.left = `${16 + frame.contentLeft}px`
  pre.style.width = `${frame.width}px`

  const code = document.createElement("code")
  for (const { line, top } of lines) {
    const span = document.createElement("span")
    span.className = "absolute font-mono whitespace-pre"
    span.textContent = line.text
    span.style.font = block.font
    span.style.left = "12px"
    span.style.lineHeight = `${frame.lineHeight}px`
    span.style.top = `${top}px`
    span.style.transform = `scale(${frame.scale})`
    span.style.transformOrigin = "left top"
    code.append(span)
  }

  pre.append(code)
  row.append(pre)
  appendCodeBlockToolbar({ block, frame, row })
}

function appendCodeBlockToolbar({
  block,
  frame,
  row,
}: {
  block: PreparedCodeTextBlock
  frame: CodeTextBlockFrame
  row: HTMLDivElement
}) {
  const controls = document.createElement("div")
  controls.className = "absolute z-10 flex items-center gap-1"
  controls.style.left = `${16 + frame.contentLeft + Math.max(0, frame.width - 66)}px`
  controls.style.top = "6px"

  if (block.language) {
    const language = document.createElement("span")
    language.className =
      "rounded bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shadow-sm"
    language.textContent = block.language
    controls.append(language)
  }

  const copyButton = document.createElement("button")
  copyButton.type = "button"
  copyButton.className =
    "rounded bg-background/90 p-1 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
  copyButton.setAttribute("aria-label", "Copy code block")
  appendCopyIcon(copyButton)
  copyButton.addEventListener("click", () => {
    void navigator.clipboard?.writeText(block.fallbackText).then(() => {
      copyButton.setAttribute("aria-label", "Copied")
      copyButton.replaceChildren()
      appendCheckIcon(copyButton)
      window.setTimeout(() => {
        copyButton.setAttribute("aria-label", "Copy code block")
        copyButton.replaceChildren()
        appendCopyIcon(copyButton)
      }, 1200)
    })
  })
  controls.append(copyButton)
  row.append(controls)
}

function appendCopyIcon(parent: HTMLElement) {
  const svg = createIconSvg()
  const back = document.createElementNS("http://www.w3.org/2000/svg", "rect")
  back.setAttribute("x", "8")
  back.setAttribute("y", "8")
  back.setAttribute("width", "8")
  back.setAttribute("height", "8")
  back.setAttribute("rx", "1")
  const front = document.createElementNS("http://www.w3.org/2000/svg", "rect")
  front.setAttribute("x", "4")
  front.setAttribute("y", "4")
  front.setAttribute("width", "8")
  front.setAttribute("height", "8")
  front.setAttribute("rx", "1")
  svg.append(back, front)
  parent.append(svg)
}

function appendCheckIcon(parent: HTMLElement) {
  const svg = createIconSvg()
  svg.classList.add("text-emerald-600", "dark:text-emerald-400")
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  path.setAttribute("d", "m5 10 3 3 7-7")
  svg.append(path)
  parent.append(svg)
}

function createIconSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 20 20")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "1.7")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.classList.add("size-3")
  return svg
}

function renderImageBlock({
  block,
  frame,
  row,
}: {
  block: PreparedImageTextBlock
  frame: ImageTextBlockFrame
  row: HTMLDivElement
}) {
  if (block.src) {
    const image = document.createElement("img")
    image.alt = block.alt
    image.className = "absolute rounded-md border bg-muted object-contain"
    image.src = block.src
    if (block.title) image.title = block.title
    image.style.height = `${frame.imageHeight}px`
    image.style.left = `${16 + frame.contentLeft}px`
    image.style.maxWidth = "calc(100% - 32px)"
    image.style.width = `${frame.imageWidth}px`
    row.append(image)
    return
  }

  const placeholder = document.createElement("div")
  placeholder.className =
    "absolute flex items-center rounded-md border bg-muted px-4 text-sm text-muted-foreground"
  placeholder.textContent = block.alt
  placeholder.setAttribute("role", "img")
  placeholder.setAttribute("aria-label", block.alt)
  placeholder.style.height = `${frame.imageHeight}px`
  placeholder.style.left = `${16 + frame.contentLeft}px`
  placeholder.style.width = `${frame.imageWidth}px`
  row.append(placeholder)
}

function renderRuleBlock({
  frame,
  row,
}: {
  frame: RuleTextBlockFrame
  row: HTMLDivElement
}) {
  const rule = document.createElement("div")
  rule.className = "absolute h-px bg-border"
  rule.style.left = `${16 + frame.contentLeft}px`
  rule.style.top = `${Math.floor(frame.height / 2)}px`
  rule.style.width = `${frame.width}px`
  row.append(rule)
}

function renderTableBlock({
  block,
  frame,
  row,
  viewportBottom,
  viewportTop,
}: {
  block: PreparedTableTextBlock
  frame: TableTextBlockFrame
  row: HTMLDivElement
  viewportBottom: number
  viewportTop: number
}) {
  const rowWindow = getTableVisibleRowWindow({
    frame,
    viewportBottom,
    viewportTop,
  })
  const headerIdPrefix = `markdown-table-${frame.sourceStartLine}-${frame.sourceEndLine}`
  const wrapper = document.createElement("div")
  wrapper.className =
    "absolute max-w-[calc(100%-32px)] overflow-hidden rounded-md border"
  wrapper.style.height = `${frame.height}px`
  wrapper.style.left = `${16 + frame.contentLeft}px`
  wrapper.style.width = `${frame.tableWidth}px`

  const copyButton = document.createElement("button")
  copyButton.type = "button"
  copyButton.className =
    "absolute top-1 right-1 z-10 rounded bg-background/90 px-1.5 py-1 text-[10px] text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
  copyButton.setAttribute("aria-label", "Copy table")
  copyButton.textContent = "Copy"
  copyButton.addEventListener("click", () => {
    void navigator.clipboard?.writeText(
      serializeMarkdownTableForClipboard(block)
    )
  })
  wrapper.append(copyButton)

  const scroller = document.createElement("div")
  scroller.className = "h-full overflow-x-auto"

  const table = document.createElement("table")
  table.className = "border-collapse text-left text-[13px]"
  table.style.width = `${frame.tableWidth}px`

  const colgroup = document.createElement("colgroup")
  for (const width of frame.columnWidths) {
    const col = document.createElement("col")
    col.style.width = `${width}px`
    colgroup.append(col)
  }
  table.append(colgroup)

  const thead = document.createElement("thead")
  thead.className = "bg-muted"
  const headerRow = document.createElement("tr")
  headerRow.style.height = `${frame.headerHeight}px`
  for (let index = 0; index < block.header.length; index++) {
    const th = document.createElement("th")
    th.className = "border-b px-3.5 py-2 font-semibold text-foreground"
    th.id = `${headerIdPrefix}-column-${index}`
    th.scope = "col"
    th.style.textAlign = block.alignments[index] ?? "left"
    appendTableCellContent(th, block.header[index])
    headerRow.append(th)
  }
  thead.append(headerRow)
  table.append(thead)

  const tbody = document.createElement("tbody")
  appendSpacerRow(tbody, rowWindow.beforeHeight, block.header.length)
  for (
    let rowIndex = rowWindow.startIndex;
    rowIndex < rowWindow.endIndex;
    rowIndex++
  ) {
    const tableRow = document.createElement("tr")
    tableRow.dataset.sourceLine = String(frame.rowSourceStartLines[rowIndex])
    tableRow.style.height = `${frame.rowHeights[rowIndex] ?? 0}px`
    const sourceRow = block.rows[rowIndex] ?? []
    for (let cellIndex = 0; cellIndex < block.header.length; cellIndex++) {
      const td = document.createElement("td")
      td.className = "border-t px-3.5 py-1.5 align-top text-foreground"
      td.headers = `${headerIdPrefix}-column-${cellIndex}`
      td.style.textAlign = block.alignments[cellIndex] ?? "left"
      appendTableCellContent(td, sourceRow[cellIndex])
      tableRow.append(td)
    }
    tbody.append(tableRow)
  }
  appendSpacerRow(tbody, rowWindow.afterHeight, block.header.length)
  table.append(tbody)
  scroller.append(table)
  wrapper.append(scroller)
  row.append(wrapper)
}

function appendSpacerRow(
  tbody: HTMLTableSectionElement,
  height: number,
  colSpan: number
) {
  if (height <= 0) return
  const row = document.createElement("tr")
  row.setAttribute("aria-hidden", "true")
  row.style.height = `${height}px`
  const cell = document.createElement("td")
  cell.colSpan = colSpan || 1
  row.append(cell)
  tbody.append(row)
}

function appendTableCellContent(
  parent: HTMLElement,
  cell: PreparedTableCell | undefined
) {
  if (!cell) return
  const node = cell.href
    ? document.createElement("a")
    : document.createElement("span")
  node.className = `wrap-break-word ${cell.className}`
  node.textContent = cell.text
  if (node instanceof HTMLAnchorElement && cell.href) {
    node.href = cell.href
    if (!isLocalFragmentHref(cell.href)) {
      node.rel = "noopener noreferrer"
      node.target = "_blank"
    }
    if (cell.title) node.title = cell.title
  }
  parent.append(node)
}

function appendBlockChrome(row: HTMLDivElement, frame: TextBlockFrame) {
  for (const left of frame.quoteRailLefts) {
    const rail = document.createElement("div")
    rail.className = "absolute top-0 bottom-0 w-[3px] rounded-full bg-border"
    rail.style.left = `${16 + left}px`
    rail.setAttribute("aria-hidden", "true")
    row.append(rail)
  }

  if (!frame.markerText || frame.markerLeft == null) return

  const marker = document.createElement("span")
  marker.className = `absolute font-mono text-xs whitespace-pre ${frame.markerClassName ?? ""}`
  marker.textContent = frame.markerText
  marker.style.left = `${16 + frame.markerLeft}px`
  marker.style.top =
    frame.kind === "inline"
      ? `${Math.max(0, Math.round((frame.lineHeight - 12) / 2))}px`
      : "10px"
  marker.setAttribute("aria-hidden", "true")
  row.append(marker)
}

function localFragmentHrefFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const link = target.closest<HTMLAnchorElement>('a[href^="#"]')
  const href = link?.getAttribute("href") ?? null
  return href && href.length > 1 ? href : null
}

function decodeMarkdownFragmentHref(href: string) {
  try {
    return decodeURIComponent(href.slice(1))
  } catch {
    return href.slice(1)
  }
}

function markdownHeadingBlockIndex(
  blocks: readonly PreparedTextBlock[],
  headingId: string
) {
  return blocks.findIndex((block) => {
    return block.kind === "inline" && block.headingId === headingId
  })
}

function isLocalFragmentHref(href: string) {
  return href.startsWith("#")
}

function textFrameIsHighlighted(
  frame: TextBlockFrame,
  highlightRange: ReturnType<typeof normalizeTextLineRange>
) {
  return frame.sourceStartLine === frame.sourceEndLine
    ? isLineInRange(frame.sourceStartLine, highlightRange)
    : textFrameIntersectsLineRange({ frame, range: highlightRange })
}

function blockVisibleWindowKey(
  frame: TextBlockFrame,
  viewportTop: number,
  viewportBottom: number
) {
  switch (frame.kind) {
    case "inline": {
      const lineWindow = getInlineVisibleLineWindow({
        frame,
        viewportBottom,
        viewportTop,
      })
      return lineWindow
        ? `${lineWindow.firstLine}:${lineWindow.lastLine}`
        : "none"
    }
    case "code": {
      const lineWindow = getCodeVisibleLineWindow({
        frame,
        viewportBottom,
        viewportTop,
      })
      return lineWindow
        ? `${lineWindow.firstLine}:${lineWindow.lastLine}`
        : "none"
    }
    case "table": {
      const rowWindow = getTableVisibleRowWindow({
        frame,
        viewportBottom,
        viewportTop,
      })
      return `${rowWindow.startIndex}:${rowWindow.endIndex}`
    }
    case "image":
    case "rule":
      return "static"
  }
}

function useTextViewerFontEpoch() {
  const [fontEpoch, setFontEpoch] = React.useState(0)

  React.useEffect(() => {
    const fonts = document.fonts
    if (!fonts) return

    let isMounted = true
    void fonts.ready.then(() => {
      if (isMounted) setFontEpoch((epoch) => epoch + 1)
    })

    return () => {
      isMounted = false
    }
  }, [])

  return fontEpoch
}
