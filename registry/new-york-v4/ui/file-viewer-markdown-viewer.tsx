"use client"

import * as React from "react"
import type * as DOMPurifyNS from "dompurify"

import type {
  ViewerContentIdentity,
  ViewerResource,
} from "@/lib/viewer-resource"

import { ResourceDocShell, useZoom, ZoomActions } from "./file-viewer-chrome"
import { timed } from "./file-viewer-core"
import {
  textResource,
  type TextResourceCache,
  type TextResourceSubscription,
} from "./file-viewer-text-resource"
import {
  abortError,
  isAbortError,
  promiseForSignal,
} from "./viewer-abortable-request"
import { lruGet, lruSet } from "./viewer-lru-cache"

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

interface MarkdownHtmlEntry {
  html?: Promise<string>
  text?: Promise<string>
  textController?: AbortController
  subscriberPromises: WeakMap<AbortSignal, Promise<string>>
  subscribers: Set<AbortSignal>
}

export function createMarkdownHtmlCache({
  maxEntries = 12,
  textCache = textResource,
}: {
  maxEntries?: number
  textCache?: TextResourceCache
} = {}): MarkdownHtmlCache {
  const entries = new Map<string, MarkdownHtmlEntry>()

  function remove(contentKey: string) {
    entries.delete(contentKey)
  }

  function entryFor(contentKey: string) {
    let entry = lruGet(entries, contentKey)
    if (!entry) {
      entry = {
        subscriberPromises: new WeakMap(),
        subscribers: new Set(),
      }
      lruSet(
        entries,
        contentKey,
        entry,
        (_key, dropped) => {
          dropped.textController?.abort()
        },
        maxEntries
      )
    }
    return entry
  }

  function renderHtml({
    content,
    fileName,
    text,
  }: {
    content: ViewerContentIdentity
    fileName: string
    text: string
  }) {
    const contentKey = content.key
    return timed(`markdown:render ${fileName}`, () =>
      Promise.all([import("marked"), loadSanitizer()]).then(
        async ([{ marked }, DOMPurify]) => {
          const dirty = String(await marked.parse(text, { gfm: true }))
          return DOMPurify.sanitize(dirty)
        }
      )
    ).catch((error: unknown) => {
      remove(contentKey)
      throw error
    })
  }

  return {
    load({ content, fileName, signal }) {
      if (signal.aborted) return Promise.reject(abortError())

      const contentKey = content.key
      const entry = entryFor(contentKey)

      return promiseForSignal(entry.subscriberPromises, signal, () => {
        entry.subscribers.add(signal)

        return new Promise<string>((resolve, reject) => {
          let done = false

          const cleanup = () => {
            signal.removeEventListener("abort", onAbort)
            entry.subscribers.delete(signal)
          }

          const onAbort = () => {
            if (done) return
            done = true
            cleanup()
            if (!entry.html && entry.subscribers.size === 0) {
              entry.textController?.abort()
              remove(contentKey)
            }
            reject(abortError())
          }

          signal.addEventListener("abort", onAbort, { once: true })

          if (entry.html) {
            entry.html.then(
              (html) => {
                if (done) return
                done = true
                cleanup()
                resolve(html)
              },
              (error: unknown) => {
                if (done) return
                done = true
                cleanup()
                reject(error)
              }
            )
            return
          }

          entry.textController ??= new AbortController()
          entry.text ??= textCache
            .load({ content, fileName, signal: entry.textController.signal })
            .catch((error: unknown) => {
              entry.text = undefined
              entry.textController = undefined
              throw error
            })

          entry.text
            .then((text) => {
              if (signal.aborted) throw abortError()
              entry.html ??= renderHtml({ content, fileName, text })
              return entry.html
            })
            .then(
              (html) => {
                if (done) return
                done = true
                cleanup()
                resolve(html)
              },
              (error: unknown) => {
                if (done) return
                done = true
                cleanup()
                if (!entry.html && !isAbortError(error)) remove(contentKey)
                reject(error)
              }
            )
        })
      })
    },
    clear() {
      for (const entry of entries.values()) {
        entry.textController?.abort()
      }
      entries.clear()
    },
    size() {
      return entries.size
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
  resource,
  className,
  bare,
  descriptorSignal,
}: {
  resource: ViewerResource
  className?: string
  bare?: boolean
  descriptorSignal: AbortSignal
}) {
  const html = React.use(
    loadMarkdownHtml({
      content: resource.content,
      fileName: resource.fileName,
      signal: descriptorSignal,
    })
  )
  const { scale, zoom, reset } = useZoom()
  return (
    <ResourceDocShell
      resource={resource}
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
    </ResourceDocShell>
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
