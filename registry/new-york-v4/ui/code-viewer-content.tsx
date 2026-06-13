"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import Prism from "prismjs"

import type { ViewerResource } from "@/lib/viewer-resource"

import { CodeViewerFrame, CodeViewerToolbar } from "./code-viewer-chrome"
import { scrollLineRangeMetricsIntoView } from "./code-viewer-layout"
import { CodeLine } from "./code-viewer-line"
import {
  clampCodeViewerScale,
  CODE_VIEWER_BASE_FONT_PX,
  CODE_VIEWER_BASE_LINE_PX,
  CODE_VIEWER_BLOCK_PADDING,
  CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
  CODE_VIEWER_OVERSCAN,
} from "./code-viewer-scale"
import type { CodeViewerHandle, CodeViewerProps } from "./code-viewer-types"
import { createInitialCodeVirtualLines } from "./code-viewer-virtualization"
import { isLineInRange, normalizeTextLineRange } from "./line-ranges"
import {
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "./plain-text-resource"
import { ScrollArea } from "./scroll-area"

Prism.manual = true

interface CodeTokenLeaf {
  text: string
  type: string
}

const JSON_LINE_MAX = 2000

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

function CodeLineContent({
  leaves,
  text,
}: {
  leaves: CodeTokenLeaf[] | null
  text: string
}) {
  if (text === "") return <> </>
  if (!leaves) return <>{text}</>
  return (
    <>
      {leaves.map((leaf, index) => {
        const className = CODE_TOKEN_CLASS[leaf.type]
        if (!className) {
          return <React.Fragment key={index}>{leaf.text}</React.Fragment>
        }
        return (
          <span key={index} className={className}>
            {leaf.text}
          </span>
        )
      })}
    </>
  )
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
  const lineHeight = CODE_VIEWER_BASE_LINE_PX * fontScale
  const lineVirtualizer = useVirtualizer({
    count: textLines.length,
    getScrollElement: () => viewportElementRef.current,
    estimateSize: () => lineHeight,
    overscan: CODE_VIEWER_OVERSCAN,
    paddingStart: CODE_VIEWER_BLOCK_PADDING,
    paddingEnd: CODE_VIEWER_BLOCK_PADDING,
    initialRect: {
      width: 800,
      height: CODE_VIEWER_INITIAL_VIEWPORT_HEIGHT,
    },
  })

  const zoom = (factor: number) =>
    setFontScale((scale) => clampCodeViewerScale(scale * factor))

  React.useEffect(() => {
    lineVirtualizer.measure()
  }, [lineHeight, lineVirtualizer])

  React.useImperativeHandle(
    forwardedRef,
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
  const measuredVirtualLines = lineVirtualizer.getVirtualItems()
  const virtualLines =
    measuredVirtualLines.length > 0
      ? measuredVirtualLines
      : createInitialCodeVirtualLines(textLines.length, lineHeight)

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
          className="relative w-max min-w-full font-mono"
          style={{
            fontSize: `${CODE_VIEWER_BASE_FONT_PX * fontScale}px`,
            lineHeight: `${lineHeight}px`,
            height: lineVirtualizer.getTotalSize(),
          }}
        >
          {virtualLines.map((virtualLine) => {
            const lineNumber = virtualLine.index + 1
            const line = textLines[virtualLine.index] ?? ""
            return (
              <CodeLine
                key={virtualLine.key}
                gutterWidth={gutterWidth}
                isHighlighted={isLineInRange(lineNumber, highlightRange)}
                lineNumber={lineNumber}
                text={line}
                style={{
                  height: virtualLine.size,
                  transform: `translateY(${virtualLine.start}px)`,
                }}
              >
                <CodeLineContent leaves={lineTokens(line)} text={line} />
              </CodeLine>
            )
          })}
        </pre>
      </ScrollArea>
    </CodeViewerFrame>
  )
}
