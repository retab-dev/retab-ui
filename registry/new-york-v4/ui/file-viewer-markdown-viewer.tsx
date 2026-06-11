"use client"

import * as React from "react"
import type * as DOMPurifyNS from "dompurify"

import { DocShell, useZoom, ZoomActions } from "./file-viewer-chrome"
import { baseName, timed } from "./file-viewer-core"
import { abortError, cachedPromise } from "./file-viewer-resource-cache"
import {
  textResource,
  type TextResourceCache,
  type TextResourceSubscription,
} from "./file-viewer-text-resource"

type Sanitizer = typeof DOMPurifyNS.default
let sanitizerPromise: Promise<Sanitizer> | null = null

function loadSanitizer() {
  if (!sanitizerPromise) {
    sanitizerPromise = import("dompurify").then((m) => {
      const DOMPurify = m.default
      DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        if (node.tagName === "A" && node.getAttribute("href")) {
          node.setAttribute("target", "_blank")
          node.setAttribute("rel", "noopener noreferrer")
        }
      })
      return DOMPurify
    })
  }
  return sanitizerPromise
}

export interface MarkdownHtmlCache {
  load(sub: TextResourceSubscription): Promise<string>
  clear(): void
  size(): number
}

export function createMarkdownHtmlCache({
  maxEntries = 12,
  textCache = textResource,
}: {
  maxEntries?: number
  textCache?: TextResourceCache
} = {}): MarkdownHtmlCache {
  const htmlBySrc = new Map<string, Promise<string>>()
  const subscriberPromises = new Map<
    string,
    WeakMap<AbortSignal, Promise<string>>
  >()

  function subscriberMapFor(src: string) {
    let map = subscriberPromises.get(src)
    if (!map) {
      map = new WeakMap()
      subscriberPromises.set(src, map)
    }
    return map
  }

  return {
    load({ src, signal }) {
      if (signal.aborted) return Promise.reject(abortError())

      const map = subscriberMapFor(src)
      const existingPromise = map.get(signal)
      if (existingPromise) return existingPromise

      const promise = textCache
        .load({ src, signal })
        .then((text) => {
          if (signal.aborted) throw abortError()
          return cachedPromise(
            htmlBySrc,
            src,
            () =>
              timed(`markdown:render ${baseName(src)}`, () =>
                Promise.all([import("marked"), loadSanitizer()]).then(
                  async ([{ marked }, DOMPurify]) => {
                    const dirty = String(
                      await marked.parse(text, { gfm: true })
                    )
                    return DOMPurify.sanitize(dirty)
                  }
                )
              ),
            {
              max: maxEntries,
              onReject(key) {
                subscriberPromises.delete(key)
              },
            }
          )
        })
        .catch((error: unknown) => {
          map.delete(signal)
          throw error
        })

      map.set(signal, promise)
      return promise
    },
    clear() {
      htmlBySrc.clear()
      subscriberPromises.clear()
    },
    size() {
      return htmlBySrc.size
    },
  }
}

export const markdownHtmlCache = createMarkdownHtmlCache()

export function loadMarkdownHtml(
  sub: TextResourceSubscription
): Promise<string> {
  return markdownHtmlCache.load(sub)
}

export function MarkdownDocViewer({
  src,
  fileName,
  className,
  bare,
  descriptorSignal,
}: {
  src: string
  fileName: string
  className?: string
  bare?: boolean
  descriptorSignal: AbortSignal
}) {
  const html = React.use(loadMarkdownHtml({ src, signal: descriptorSignal }))
  const { scale, zoom, reset } = useZoom()
  return (
    <DocShell
      fileName={fileName}
      src={src}
      className={className}
      bare={bare}
      actions={<ZoomActions scale={scale} zoom={zoom} reset={reset} />}
    >
      <style href="fv-markdown" precedence="default">
        {MARKDOWN_STYLE}
      </style>
      <div className="min-h-0 flex-1 overflow-auto bg-card">
        <div
          className="fv-markdown mx-auto max-w-3xl px-6 py-5"
          style={{ zoom: scale }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </DocShell>
  )
}

const MARKDOWN_STYLE = `
.fv-markdown { color: var(--foreground); font-size: 0.875rem; line-height: 1.7; word-wrap: break-word; }
.fv-markdown > :first-child { margin-top: 0; }
.fv-markdown > :last-child { margin-bottom: 0; }
.fv-markdown h1, .fv-markdown h2, .fv-markdown h3, .fv-markdown h4, .fv-markdown h5, .fv-markdown h6 { font-weight: 600; line-height: 1.3; margin: 1.5em 0 0.6em; }
.fv-markdown h1 { font-size: 1.55em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.fv-markdown h2 { font-size: 1.3em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.fv-markdown h3 { font-size: 1.12em; }
.fv-markdown h4 { font-size: 1em; }
.fv-markdown p, .fv-markdown ul, .fv-markdown ol, .fv-markdown blockquote, .fv-markdown pre, .fv-markdown table { margin: 0 0 1em; }
.fv-markdown ul, .fv-markdown ol { padding-left: 1.5em; }
.fv-markdown ul { list-style: disc; }
.fv-markdown ol { list-style: decimal; }
.fv-markdown li { margin: 0.25em 0; }
.fv-markdown li > ul, .fv-markdown li > ol { margin: 0.25em 0; }
.fv-markdown a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
.fv-markdown strong { font-weight: 600; }
.fv-markdown code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; background: var(--muted); padding: 0.15em 0.4em; border-radius: 4px; }
.fv-markdown pre { background: var(--muted); padding: 0.9em 1em; border-radius: 8px; overflow-x: auto; }
.fv-markdown pre code { background: none; padding: 0; font-size: 0.85em; }
.fv-markdown blockquote { padding-left: 1em; border-left: 3px solid var(--border); color: var(--muted-foreground); }
.fv-markdown table { border-collapse: collapse; display: block; width: max-content; max-width: 100%; overflow-x: auto; }
.fv-markdown th, .fv-markdown td { border: 1px solid var(--border); padding: 0.4em 0.75em; text-align: left; }
.fv-markdown th { background: var(--muted); font-weight: 600; }
.fv-markdown img { max-width: 100%; }
.fv-markdown hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
`
