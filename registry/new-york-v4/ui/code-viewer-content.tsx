"use client"

import * as React from "react"
import Prism from "prismjs"

import type { ViewerResource } from "@/lib/viewer-resource"

import { CodeViewerFrame, CodeViewerToolbar } from "./code-viewer-chrome"
import { scrollLineRangeMetricsIntoView } from "./code-viewer-layout"
import {
  clampCodeViewerScale,
  CODE_VIEWER_BASE_FONT_PX,
  CODE_VIEWER_BASE_LINE_PX,
  CODE_VIEWER_BLOCK_PADDING,
  CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  CODE_VIEWER_OVERSCAN,
} from "./code-viewer-scale"
import type { CodeViewerHandle, CodeViewerProps } from "./code-viewer-types"
import {
  getCodeVirtualLines,
  getCodeVirtualTotalSize,
} from "./code-viewer-virtualization"
import { isLineInRange, normalizeTextLineRange } from "./line-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "./plain-text-resource"
import { ScrollArea } from "./scroll-area"
import { useIsClient } from "./use-is-client"

Prism.manual = true

interface CodeTokenLeaf {
  text: string
  type: string
}

const JSON_LINE_MAX = 2000
const CODE_VIEWER_DEFAULT_VIEWPORT_WIDTH = 800

const JSON_GRAMMAR: Prism.Grammar = {
  property: {
    pattern: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    greedy: true,
  },
  string: {
    pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    greedy: true,
  },
  number: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,
  punctuation: /[{}[\],]/,
  operator: /:/,
  boolean: /\b(?:false|true)\b/,
  null: { pattern: /\bnull\b/, alias: "keyword" },
}

const CODE_TOKEN_CLASS: Record<string, string> = {
  boolean: "cv-token-keyword",
  keyword: "cv-token-keyword",
  null: "cv-token-keyword",
  number: "cv-token-number",
  operator: "cv-token-punctuation",
  property: "cv-token-property",
  punctuation: "cv-token-punctuation",
  string: "cv-token-string",
}

const CODE_VIEWER_SYNTAX_STYLE = `
.cv-token-property { color: var(--cv-token-property, #0550ae); }
.cv-token-string { color: var(--cv-token-string, #0a7d33); }
.cv-token-number { color: var(--cv-token-number, #b5690c); }
.cv-token-keyword { color: var(--cv-token-keyword, #8250df); }
.cv-token-punctuation { color: var(--cv-token-punctuation, color-mix(in oklab, var(--foreground) 55%, transparent)); }
.dark .cv-token-property { color: var(--cv-token-property, #6cb6ff); }
.dark .cv-token-string { color: var(--cv-token-string, #8ddb8c); }
.dark .cv-token-number { color: var(--cv-token-number, #e3b341); }
.dark .cv-token-keyword { color: var(--cv-token-keyword, #dcbdfb); }
`

function codeGrammar(resource: ViewerResource): Prism.Grammar | null {
  const fileName = resource.fileName.toLowerCase()
  const mimeType = resource.content.mimeType?.toLowerCase().split(";")[0].trim()
  if (
    fileName.endsWith(".json") ||
    fileName.endsWith(".json5") ||
    mimeType === "application/json"
  ) {
    return JSON_GRAMMAR
  }
  return null
}

function flattenTokens(
  tokens: Array<string | Prism.Token>,
  parentType = "",
  leaves: CodeTokenLeaf[] = []
): CodeTokenLeaf[] {
  for (const token of tokens) {
    if (typeof token === "string") {
      leaves.push({ text: token, type: parentType })
    } else if (Array.isArray(token.content)) {
      flattenTokens(
        token.content as Array<string | Prism.Token>,
        token.type,
        leaves
      )
    } else if (typeof token.content === "string") {
      leaves.push({ text: token.content, type: token.type })
    } else {
      flattenTokens([token.content as Prism.Token], token.type, leaves)
    }
  }
  return leaves
}

type CodeLineTokenGetter = (line: string) => CodeTokenLeaf[] | null

type CodeRowCache = {
  contentSpan: HTMLSpanElement
  gutterSpan: HTMLSpanElement
  renderKey: string
  row: HTMLDivElement
}

type CodeProjectionCache = {
  lineHeight: number
  rows: Array<CodeRowCache | undefined>
  textLines: string[] | null
}

function projectCodeRows({
  cache,
  getLineTokens,
  gutterWidth,
  highlightRange,
  lineHeight,
  pre,
  textLines,
  viewport,
}: {
  cache: CodeProjectionCache
  getLineTokens: CodeLineTokenGetter
  gutterWidth: string
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  lineHeight: number
  pre: HTMLPreElement | null
  textLines: string[]
  viewport: HTMLDivElement | null
}) {
  if (!pre) return

  if (cache.textLines !== textLines || cache.lineHeight !== lineHeight) {
    pre.replaceChildren()
    cache.lineHeight = lineHeight
    cache.rows = []
    cache.textLines = textLines
  }

  pre.style.height = `${getCodeVirtualTotalSize({
    lineCount: textLines.length,
    lineHeight,
  })}px`

  const virtualLines = getCodeVirtualLines({
    lineCount: textLines.length,
    lineHeight,
    overscan: CODE_VIEWER_OVERSCAN,
    paddingStart: CODE_VIEWER_BLOCK_PADDING,
    scrollTop: viewport?.scrollTop ?? 0,
    viewportHeight:
      viewport?.clientHeight || CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  })
  const start = virtualLines[0]?.index ?? 0
  const end = virtualLines.length
    ? virtualLines[virtualLines.length - 1]!.index + 1
    : start

  for (let index = 0; index < cache.rows.length; index++) {
    if (index >= start && index < end) continue
    removeCodeRow(cache, index)
  }

  const rows: HTMLDivElement[] = []
  for (const virtualLine of virtualLines) {
    const row = prepareCodeRow({
      cache,
      getLineTokens,
      gutterWidth,
      highlightRange,
      lineHeight,
      textLines,
      virtualLine,
    }).row
    rows.push(row)
  }

  for (const row of rows) {
    pre.append(row)
  }
}

function removeCodeRow(cache: CodeProjectionCache, index: number) {
  const cachedRow = cache.rows[index]
  if (!cachedRow) return
  cachedRow.row.remove()
  cache.rows[index] = undefined
}

function prepareCodeRow({
  cache,
  getLineTokens,
  gutterWidth,
  highlightRange,
  lineHeight,
  textLines,
  virtualLine,
}: {
  cache: CodeProjectionCache
  getLineTokens: CodeLineTokenGetter
  gutterWidth: string
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  lineHeight: number
  textLines: string[]
  virtualLine: ReturnType<typeof getCodeVirtualLines>[number]
}): CodeRowCache {
  const lineNumber = virtualLine.index + 1
  const text = textLines[virtualLine.index] ?? ""
  const isHighlighted = isLineInRange(lineNumber, highlightRange)
  const renderKey = [
    lineNumber,
    text,
    gutterWidth,
    lineHeight,
    isHighlighted ? "highlighted" : "",
  ].join("\u0000")
  let cachedRow = cache.rows[virtualLine.index]

  if (!cachedRow) {
    cachedRow = createCodeRow()
    cache.rows[virtualLine.index] = cachedRow
  }

  cachedRow.row.style.height = `${virtualLine.size}px`
  cachedRow.row.style.transform = `translateY(${virtualLine.start}px)`

  if (cachedRow.renderKey !== renderKey) {
    cachedRow.renderKey = renderKey
    renderCodeRow({
      cachedRow,
      getLineTokens,
      gutterWidth,
      isHighlighted,
      lineNumber,
      text,
    })
  }

  return cachedRow
}

function createCodeRow(): CodeRowCache {
  const row = document.createElement("div")
  const gutterSpan = document.createElement("span")
  const contentSpan = document.createElement("span")

  row.className = codeRowClassName(false)
  row.style.position = "absolute"
  row.style.top = "0"
  row.style.left = "0"

  gutterSpan.className =
    "flex-shrink-0 pr-3 text-right text-muted-foreground/60 select-none"
  contentSpan.className = "whitespace-pre"

  row.append(gutterSpan, contentSpan)

  return {
    contentSpan,
    gutterSpan,
    renderKey: "",
    row,
  }
}

function renderCodeRow({
  cachedRow,
  getLineTokens,
  gutterWidth,
  isHighlighted,
  lineNumber,
  text,
}: {
  cachedRow: CodeRowCache
  getLineTokens: CodeLineTokenGetter
  gutterWidth: string
  isHighlighted: boolean
  lineNumber: number
  text: string
}) {
  cachedRow.row.dataset.lineNumber = String(lineNumber)
  cachedRow.row.className = codeRowClassName(isHighlighted)
  cachedRow.gutterSpan.style.width = gutterWidth
  cachedRow.gutterSpan.textContent = String(lineNumber)
  replaceCodeContent(cachedRow.contentSpan, getLineTokens(text), text)
}

function replaceCodeContent(
  contentSpan: HTMLSpanElement,
  leaves: CodeTokenLeaf[] | null,
  text: string
) {
  contentSpan.replaceChildren()
  if (text === "") {
    contentSpan.textContent = " "
    return
  }
  if (!leaves) {
    contentSpan.textContent = text
    return
  }

  const fragment = document.createDocumentFragment()
  for (const leaf of leaves) {
    const className = CODE_TOKEN_CLASS[leaf.type]
    if (!className) {
      fragment.append(document.createTextNode(leaf.text))
      continue
    }
    const span = document.createElement("span")
    span.className = className
    span.textContent = leaf.text
    fragment.append(span)
  }
  contentSpan.append(fragment)
}

function codeRowClassName(isHighlighted: boolean) {
  return [
    "absolute top-0 left-0 flex min-w-full px-2",
    isHighlighted ? "bg-primary/12 ring-1 ring-primary/30 ring-inset" : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function renderStaticCodeRows({
  gutterWidth,
  highlightRange,
  lineHeight,
  textLines,
}: {
  gutterWidth: string
  highlightRange: ReturnType<typeof normalizeTextLineRange>
  lineHeight: number
  textLines: string[]
}) {
  return textLines.map((text, index) => {
    const lineNumber = index + 1
    const isHighlighted = isLineInRange(lineNumber, highlightRange)
    return (
      <span
        key={lineNumber}
        className={codeRowClassName(isHighlighted)}
        data-line-number={lineNumber}
        style={{
          height: lineHeight,
          transform: `translateY(${CODE_VIEWER_BLOCK_PADDING + index * lineHeight}px)`,
        }}
      >
        <span
          className="flex-shrink-0 pr-3 text-right text-muted-foreground/60 select-none"
          style={{ width: gutterWidth }}
        >
          {lineNumber}
        </span>
        <span className="whitespace-pre">{text || " "}</span>
      </span>
    )
  })
}

export function CodeViewerContent({
  resource,
  className,
  toolbar = true,
  highlight,
  bare = false,
  maxBytes,
  maxLines,
  retryVersion,
  forwardedRef,
}: CodeViewerProps & {
  resource: ViewerResource
  retryVersion: number
  forwardedRef?: React.ForwardedRef<CodeViewerHandle>
}) {
  const isClient = useIsClient()
  const bounds = resolvedTextViewerBounds({ maxBytes, maxLines })
  const text = readTextResource({
    content: resource.content,
    retryVersion,
    bounds,
  })
  const textLines = React.useMemo(() => splitTextLines(text), [text])
  const grammar = React.useMemo(() => codeGrammar(resource), [resource])
  const tokenCache = React.useMemo(
    () => new Map<string, CodeTokenLeaf[]>(),
    [grammar, text]
  )
  const highlightStart = highlight?.start
  const highlightEnd = highlight?.end
  const highlightRange = React.useMemo(
    () =>
      normalizeTextLineRange(
        highlightStart == null || highlightEnd == null
          ? null
          : { start: highlightStart, end: highlightEnd },
        textLines.length
      ),
    [highlightStart, highlightEnd, textLines.length]
  )
  const downloadAction = React.useMemo(
    () => resource.originalDownload,
    [resource]
  )

  const lineTokens = React.useCallback(
    (line: string): CodeTokenLeaf[] | null => {
      if (!grammar || line.length === 0 || line.length > JSON_LINE_MAX) {
        return null
      }

      const cached = tokenCache.get(line)
      if (cached) return cached

      const leaves = flattenTokens(Prism.tokenize(line, grammar))
      tokenCache.set(line, leaves)
      return leaves
    },
    [grammar, tokenCache]
  )

  const [fontScale, setFontScale] = React.useState(1)
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const preRef = React.useRef<HTMLPreElement | null>(null)
  const projectionCacheRef = React.useRef<CodeProjectionCache>({
    lineHeight: 0,
    rows: [],
    textLines: null,
  })
  const scheduledProjectionRef = React.useRef(0)
  const lineHeight = CODE_VIEWER_BASE_LINE_PX * fontScale

  const zoom = (factor: number) =>
    setFontScale((scale) => clampCodeViewerScale(scale * factor))

  React.useImperativeHandle(
    forwardedRef ?? null,
    () => ({
      scrollToLineRange: (range, options) => {
        scrollLineRangeMetricsIntoView({
          viewportElement: viewportElementRef.current,
          range: normalizeTextLineRange(range, textLines.length),
          lineHeight,
          paddingStart: CODE_VIEWER_BLOCK_PADDING,
          options,
        })
      },
      getViewportElement: () => viewportElementRef.current,
    }),
    [lineHeight, textLines.length]
  )

  React.useEffect(() => {
    scrollLineRangeMetricsIntoView({
      viewportElement: viewportElementRef.current,
      range: highlightRange,
      lineHeight,
      paddingStart: CODE_VIEWER_BLOCK_PADDING,
    })
  }, [highlightRange, lineHeight])

  const gutterWidth = `${String(textLines.length).length + 1}ch`
  const totalHeight = getCodeVirtualTotalSize({
    lineCount: textLines.length,
    lineHeight,
  })
  const staticRows = isClient
    ? null
    : renderStaticCodeRows({
        gutterWidth,
        highlightRange,
        lineHeight,
        textLines,
      })
  const projectRows = React.useCallback(() => {
    scheduledProjectionRef.current = 0
    projectCodeRows({
      cache: projectionCacheRef.current,
      getLineTokens: lineTokens,
      gutterWidth,
      highlightRange,
      lineHeight,
      pre: preRef.current,
      textLines,
      viewport: viewportElementRef.current,
    })
  }, [gutterWidth, highlightRange, lineHeight, lineTokens, textLines])

  const scheduleProjectRows = React.useCallback(() => {
    if (scheduledProjectionRef.current) return
    scheduledProjectionRef.current = requestAnimationFrame(projectRows)
  }, [projectRows])

  React.useLayoutEffect(() => {
    projectRows()
  }, [projectRows])

  React.useLayoutEffect(() => {
    const viewport = viewportElementRef.current
    if (!viewport) return
    viewport.addEventListener("scroll", scheduleProjectRows, { passive: true })
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleProjectRows)
    observer?.observe(viewport)
    return () => {
      viewport.removeEventListener("scroll", scheduleProjectRows)
      observer?.disconnect()
      if (scheduledProjectionRef.current) {
        cancelAnimationFrame(scheduledProjectionRef.current)
        scheduledProjectionRef.current = 0
      }
    }
  }, [scheduleProjectRows])

  return (
    <CodeViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <CodeViewerToolbar
          lineCount={textLines.length}
          fontScale={fontScale}
          downloadAction={downloadAction}
          onZoomOut={() => zoom(1 / 1.2)}
          onZoomIn={() => zoom(1.2)}
          onResetZoom={() => setFontScale(1)}
        />
      ) : null}
      {grammar ? <style>{CODE_VIEWER_SYNTAX_STYLE}</style> : null}
      <ScrollArea className="min-h-0 flex-1" viewportRef={viewportElementRef}>
        <pre
          ref={preRef}
          className="relative w-max min-w-full font-mono"
          suppressHydrationWarning
          style={{
            fontSize: `${CODE_VIEWER_BASE_FONT_PX * fontScale}px`,
            lineHeight: `${lineHeight}px`,
            height: totalHeight,
            minWidth: CODE_VIEWER_DEFAULT_VIEWPORT_WIDTH,
          }}
        >
          {staticRows}
        </pre>
      </ScrollArea>
    </CodeViewerFrame>
  )
}
