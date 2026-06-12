"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import Prism from "prismjs"
import { createPortal } from "react-dom"

import { isAbortError } from "./file-viewer-async"
import { DocShell, useZoom, ZoomActions } from "./file-viewer-chrome"
import {
  formatBytes,
  isSameTextView,
  loadFirstTextChunk,
  loadNextTextChunk,
  textKeyForFile,
  textLoader,
  type TextLoadMode,
  type TextSnapshot,
} from "./file-viewer-text-loader"

const TEXT_FONT = 12.5
const TEXT_LINE_HEIGHT = 20
const TEXT_CHAR_WIDTH = TEXT_FONT * 0.6
const TEXT_LOAD_AHEAD_PX = 600
const TEXT_OVERSCAN = 16
const TEXT_INITIAL_VIEWPORT_HEIGHT = 600
const JSON_LINE_MAX = 2000

Prism.manual = true

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

function highlightGrammar(fileName: string): Prism.Grammar | null {
  return /\.(json|json5)$/i.test(fileName) ? JSON_GRAMMAR : null
}

interface Leaf {
  type: string
  text: string
}

interface TextVirtualLine {
  index: number
  size: number
  start: number
}

function flattenTokens(
  tokens: (string | Prism.Token)[],
  parentType = "",
  out: Leaf[] = []
): Leaf[] {
  for (const tok of tokens) {
    if (typeof tok === "string") {
      out.push({ type: parentType, text: tok })
    } else if (Array.isArray(tok.content)) {
      flattenTokens(tok.content as (string | Prism.Token)[], tok.type, out)
    } else if (typeof tok.content === "string") {
      out.push({ type: tok.type, text: tok.content })
    } else {
      flattenTokens([tok.content as Prism.Token], tok.type, out)
    }
  }
  return out
}

const TOKEN_CLASS: Record<string, string> = {
  property: "fv-tok-key",
  string: "fv-tok-string",
  number: "fv-tok-number",
  boolean: "fv-tok-keyword",
  null: "fv-tok-keyword",
  keyword: "fv-tok-keyword",
  punctuation: "fv-tok-punct",
  operator: "fv-tok-punct",
}

const SYNTAX_STYLE = `
.fv-tok-key { color: var(--fv-syntax-key, #0550ae); }
.fv-tok-string { color: var(--fv-syntax-string, #0a7d33); }
.fv-tok-number { color: var(--fv-syntax-number, #b5690c); }
.fv-tok-keyword { color: var(--fv-syntax-keyword, #8250df); }
.fv-tok-punct { color: var(--fv-syntax-punct, color-mix(in oklab, var(--foreground) 55%, transparent)); }
.dark .fv-tok-key { color: var(--fv-syntax-key, #6cb6ff); }
.dark .fv-tok-string { color: var(--fv-syntax-string, #8ddb8c); }
.dark .fv-tok-number { color: var(--fv-syntax-number, #e3b341); }
.dark .fv-tok-keyword { color: var(--fv-syntax-keyword, #dcbdfb); }
`

function LineContent({
  line,
  leaves,
}: {
  line: string
  leaves: Leaf[] | null
}) {
  if (line === "") return <> </>
  if (!leaves) return <>{line}</>
  return (
    <>
      {leaves.map((leaf, i) =>
        leaf.type && TOKEN_CLASS[leaf.type] ? (
          <span key={i} className={TOKEN_CLASS[leaf.type]}>
            {leaf.text}
          </span>
        ) : (
          <React.Fragment key={i}>{leaf.text}</React.Fragment>
        )
      )}
    </>
  )
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function stripHasRules(owner: CSSStyleSheet | CSSGroupingRule) {
  const rules = owner.cssRules
  if (!rules) return
  for (let i = rules.length - 1; i >= 0; i--) {
    const r = rules[i]
    if ((r as CSSStyleRule).selectorText?.includes(":has(")) {
      try {
        owner.deleteRule(i)
      } catch {
        // ignore a rule that cannot be removed
      }
    } else if ((r as CSSGroupingRule).cssRules?.length) {
      stripHasRules(r as CSSGroupingRule)
    }
  }
}

let sharedSheets: CSSStyleSheet[] | null = null
function getSharedSheets(): CSSStyleSheet[] {
  if (sharedSheets) return sharedSheets
  const out: CSSStyleSheet[] = []
  for (const ss of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = ss.cssRules
    } catch {
      continue
    }
    let text = ""
    for (const rule of Array.from(rules)) text += rule.cssText + "\n"
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(text)
      stripHasRules(sheet)
      out.push(sheet)
    } catch {
      // skip sheets that cannot be reconstructed
    }
  }
  sharedSheets = out
  return out
}

function ShadowScope({
  className,
  style,
  children,
}: {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const [root, setRoot] = React.useState<ShadowRoot | null>(null)

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const sr = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    try {
      sr.adoptedStyleSheets = getSharedSheets()
    } catch {
      for (const node of Array.from(
        document.querySelectorAll('style, link[rel="stylesheet"]')
      )) {
        try {
          sr.appendChild(node.cloneNode(true))
        } catch {
          // ignore nodes that cannot be cloned
        }
      }
    }
    setRoot(sr)
  }, [])

  return (
    <div ref={hostRef} className={className} style={style}>
      {root ? createPortal(children, root) : null}
    </div>
  )
}

function ScrollerShell({
  isolate,
  className,
  style,
  children,
}: {
  isolate: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  if (isolate) {
    return (
      <ShadowScope className={className} style={style}>
        {children}
      </ShadowScope>
    )
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  )
}

function makeTextSubscription(
  src: string,
  mode: TextLoadMode,
  signal: AbortSignal
) {
  return {
    textKey: textKeyForFile(src, mode),
    src,
    mode,
    signal,
  }
}

export function TextDocViewer({
  src,
  fileName,
  className,
  bare,
  isolateStyles,
  descriptorSignal,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
  isolateStyles?: boolean
  descriptorSignal: AbortSignal
}) {
  const isJson = /\.(json|json5)$/i.test(fileName)
  const textMode: TextLoadMode = isJson ? "full" : "stream"
  const textKey = textKeyForFile(src, textMode)
  const textViewKey = `${textKey}\u0000${fileName}`
  const currentTextViewKeyRef = React.useRef(textViewKey)
  currentTextViewKeyRef.current = textViewKey

  const [snap, setSnap] = React.useState<TextSnapshot | null>(() =>
    textLoader.snapshot(textKey)
  )
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [loadError, setLoadError] = React.useState<Error | null>(null)
  const [renderedTextViewKey, setRenderedTextViewKey] =
    React.useState(textViewKey)
  const grammar = React.useMemo(() => highlightGrammar(fileName), [fileName])
  const tokenCacheRef = React.useRef<Map<string, Leaf[]>>(new Map())

  if (renderedTextViewKey !== textViewKey) {
    setRenderedTextViewKey(textViewKey)
    setSnap(textLoader.snapshot(textKey))
    setLoadingMore(false)
    setLoadError(null)
    tokenCacheRef.current = new Map()
  }
  if (loadError) throw loadError

  React.useEffect(() => {
    const startedTextViewKey = textViewKey
    const sub = makeTextSubscription(src, textMode, descriptorSignal)
    void loadFirstTextChunk(sub)
      .then((next) => {
        if (!isSameTextView(currentTextViewKeyRef.current, startedTextViewKey))
          return
        setSnap(next)
      })
      .catch((error: unknown) => {
        if (!isSameTextView(currentTextViewKeyRef.current, startedTextViewKey))
          return
        if (isAbortError(error)) return
        setLoadError(error instanceof Error ? error : new Error(String(error)))
      })
  }, [descriptorSignal, src, textKey, textMode, textViewKey])

  const lineLeaves = React.useCallback(
    (line: string): Leaf[] | null => {
      if (!grammar || line.length === 0 || line.length > JSON_LINE_MAX)
        return null
      const cache = tokenCacheRef.current
      let leaves = cache.get(line)
      if (!leaves) {
        leaves = flattenTokens(Prism.tokenize(line, grammar))
        cache.set(line, leaves)
      }
      return leaves
    },
    [grammar]
  )

  const loadMore = React.useCallback(() => {
    const startedTextViewKey = textViewKey
    const sub = makeTextSubscription(src, textMode, descriptorSignal)
    setLoadingMore((busy) => {
      if (busy) return busy
      void loadNextTextChunk(sub)
        .then((next) => {
          if (
            !isSameTextView(currentTextViewKeyRef.current, startedTextViewKey)
          )
            return
          setSnap(next)
          setLoadingMore(false)
        })
        .catch((error: unknown) => {
          if (
            !isSameTextView(currentTextViewKeyRef.current, startedTextViewKey)
          )
            return
          if (isAbortError(error)) {
            setLoadingMore(false)
            return
          }
          setLoadError(
            error instanceof Error ? error : new Error(String(error))
          )
          setLoadingMore(false)
        })
      return true
    })
  }, [descriptorSignal, src, textMode, textViewKey])

  const text = React.useMemo(() => {
    if (!snap) return ""
    if (isJson && snap.done) {
      try {
        return JSON.stringify(JSON.parse(snap.text), null, 2)
      } catch {
        // invalid JSON renders as the original text
      }
    }
    return snap.text
  }, [snap, isJson])

  const lines = React.useMemo(() => text.replace(/\n$/, "").split("\n"), [text])
  const maxChars = React.useMemo(
    () => lines.reduce((m, l) => Math.max(m, l.length), 0),
    [lines]
  )

  const { scale, zoom, reset } = useZoom()
  const fontSize = TEXT_FONT * scale
  const lineHeight = Math.round(TEXT_LINE_HEIGHT * scale)
  const charWidth = TEXT_CHAR_WIDTH * scale

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => lineHeight,
    overscan: TEXT_OVERSCAN,
    initialRect: { width: 800, height: TEXT_INITIAL_VIEWPORT_HEIGHT },
  })

  React.useLayoutEffect(() => {
    virtualizer.measure()
  }, [lineHeight, virtualizer])

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!snap || snap.done || loadingMore) return
      const el = e.currentTarget
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight <
        TEXT_LOAD_AHEAD_PX
      ) {
        loadMore()
      }
    },
    [snap, loadingMore, loadMore]
  )

  const digits = String(Math.max(lines.length, 1)).length
  const gutterWidth = Math.round(Math.max(40, 12 + digits * 8) * scale)
  const contentWidth = Math.ceil(maxChars * charWidth) + 24
  const totalWidth = gutterWidth + contentWidth
  const measuredVirtualLines = virtualizer.getVirtualItems()
  const virtualLines =
    measuredVirtualLines.length > 0
      ? measuredVirtualLines
      : createInitialTextVirtualLines(lines.length, lineHeight)

  const meta = !snap
    ? "Loading"
    : snap.done
      ? `${lines.length.toLocaleString()} line${lines.length === 1 ? "" : "s"}`
      : `${lines.length.toLocaleString()} lines · ${formatBytes(snap.bytesLoaded)}${
          snap.totalBytes ? ` / ${formatBytes(snap.totalBytes)}` : ""
        } loaded`

  return (
    <DocShell
      fileName={fileName}
      src={src}
      className={className}
      bare={bare}
      meta={meta}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
    >
      <ScrollerShell
        isolate={!!isolateStyles}
        className="relative min-h-0 flex-1 overflow-hidden bg-card font-mono"
        style={{ fontSize, lineHeight: `${lineHeight}px` }}
      >
        {grammar ? <style>{SYNTAX_STYLE}</style> : null}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))]"
          style={{ width: gutterWidth }}
        />
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-auto"
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: totalWidth,
              minWidth: "100%",
              position: "relative",
            }}
          >
            {virtualLines.map((item) => (
              <div
                key={item.index}
                className="grid"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: lineHeight,
                  transform: `translateY(${item.start}px)`,
                  gridTemplateColumns: `${gutterWidth}px 1fr`,
                }}
              >
                <div
                  className="sticky left-0 z-[1] flex items-center justify-end bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))] pr-2 text-muted-foreground tabular-nums select-none"
                  style={{ fontSize: Math.round(fontSize * 0.85) }}
                >
                  {item.index + 1}
                </div>
                <div className="flex items-center px-3 whitespace-pre text-foreground">
                  <LineContent
                    line={lines[item.index]}
                    leaves={lineLeaves(lines[item.index])}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollerShell>
    </DocShell>
  )
}

function createInitialTextVirtualLines(
  lineCount: number,
  lineHeight: number
): TextVirtualLine[] {
  const windowLineCount = Math.min(
    lineCount,
    Math.ceil(TEXT_INITIAL_VIEWPORT_HEIGHT / lineHeight) + TEXT_OVERSCAN * 2
  )

  return Array.from({ length: windowLineCount }, (_, index) => ({
    index,
    size: lineHeight,
    start: index * lineHeight,
  }))
}
