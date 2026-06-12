"use client"

import type * as DOMPurify from "dompurify"
import type * as Marked from "marked"

import type { ViewerResource } from "@/lib/viewer-resource"
import {
  cachedThumbnailResource,
  getThumbnailText,
  shortName,
  timed,
  useThumbnailResource,
  type ThumbnailCacheEntry,
} from "@/components/document-thumbnail/cache"
import { IframeDoc } from "@/components/document-thumbnail/renderers/layout"

let mdLibs: Promise<[typeof Marked, typeof DOMPurify]> | null = null

function loadMarkdown() {
  if (!mdLibs) mdLibs = Promise.all([import("marked"), import("dompurify")])
  return mdLibs
}

const markdownCache = new Map<string, ThumbnailCacheEntry<string>>()

function getMarkdownDoc(
  resource: ViewerResource,
  cacheKey: string
): Promise<string> {
  return cachedThumbnailResource(markdownCache, cacheKey, () =>
    timed(`markdown:total ${shortName(resource)}`, async () => {
      const [text, [{ marked }, DOMPurifyMod]] = await Promise.all([
        getThumbnailText(resource, cacheKey),
        loadMarkdown(),
      ])
      const purifier = DOMPurifyMod as unknown as {
        default?: { sanitize?: (html: string) => string }
        sanitize?: (html: string) => string
      }
      const sanitize = purifier.default?.sanitize ?? purifier.sanitize
      if (!sanitize) throw new Error("DOMPurify sanitize unavailable")
      const body = sanitize(await marked.parse(text))
      return `<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;padding:18px;font:14px/1.6 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;color:#0f172a}
        h1{font-size:1.6em;margin:.1em 0 .5em;border-bottom:1px solid #e2e8f0;padding-bottom:.25em}
        h2{font-size:1.3em;margin:1em 0 .4em;border-bottom:1px solid #e2e8f0;padding-bottom:.25em}
        h3{font-size:1.1em;margin:1em 0 .3em}
        p,ul,ol{margin:0 0 .8em}ul,ol{padding-left:1.4em}
        code{font-family:ui-monospace,SFMono-Regular,monospace;background:#f1f5f9;padding:.1em .35em;border-radius:4px;font-size:.85em}
        pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow:hidden}pre code{background:none;padding:0}
        table{border-collapse:collapse;width:100%}td,th{border:1px solid #e2e8f0;padding:4px 8px;text-align:left}
        a{color:#4f46e5}blockquote{margin:0 0 .8em;padding-left:12px;border-left:3px solid #e2e8f0;color:#475569}
      </style></head><body>${body}</body></html>`
    })
  )
}

export function MarkdownFirstPage({
  resource,
  cacheKey,
}: {
  resource: ViewerResource
  cacheKey: string
}) {
  const html = useThumbnailResource(getMarkdownDoc(resource, cacheKey))
  return <IframeDoc html={html} />
}
