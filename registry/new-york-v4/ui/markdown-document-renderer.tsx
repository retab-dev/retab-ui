"use client"

import * as React from "react"
import { MarkdownHooks } from "react-markdown"

import {
  type MarkdownDocumentChunk,
  type MarkdownLineRange,
} from "./markdown-document-model"
import {
  MARKDOWN_DOCUMENT_REHYPE_PLUGINS,
  MARKDOWN_DOCUMENT_REMARK_PLUGINS,
} from "./markdown-document-plugins"
import { createMarkdownDocumentRenderers } from "./markdown-document-renderers"
import { sanitizeMarkdownUrl } from "./markdown-document-url-policy"

export function MarkdownDocumentChunkRenderer({
  headingIdsByLine,
  highlightRange,
  onContentReady,
  chunk,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  highlightRange: MarkdownLineRange | null
  onContentReady?: () => void
  chunk: MarkdownDocumentChunk
}) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const hasReportedReadyRef = React.useRef(false)
  const [renderState, setRenderState] = React.useState<"pending" | "ready">(
    "pending"
  )
  const components = React.useMemo(
    () =>
      createMarkdownDocumentRenderers({
        headingIdsByLine,
        highlightRange,
        chunk,
      }),
    [headingIdsByLine, highlightRange, chunk]
  )
  React.useLayoutEffect(() => {
    hasReportedReadyRef.current = false
    setRenderState("pending")
  }, [chunk.markdown])

  React.useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return

    const markReady = (forceMeasure = false) => {
      if (content.childNodes.length === 0) return
      if (!hasReportedReadyRef.current) {
        hasReportedReadyRef.current = true
        setRenderState("ready")
        onContentReady?.()
        return
      }
      if (forceMeasure) onContentReady?.()
    }

    markReady()
    const observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => markReady(true))
    observer?.observe(content, {
      attributes: false,
      childList: true,
      subtree: true,
    })
    const readyCheckTimeout = window.setTimeout(() => markReady(true), 0)
    return () => {
      window.clearTimeout(readyCheckTimeout)
      observer?.disconnect()
    }
  }, [onContentReady, chunk.markdown])

  return (
    <div
      ref={contentRef}
      data-markdown-render-state={renderState}
      data-slot="markdown-document-rendered-content"
    >
      <MarkdownHooks
        rehypePlugins={MARKDOWN_DOCUMENT_REHYPE_PLUGINS}
        remarkPlugins={MARKDOWN_DOCUMENT_REMARK_PLUGINS}
        remarkRehypeOptions={{ allowDangerousHtml: true }}
        components={components}
        urlTransform={sanitizeMarkdownUrl}
      >
        {chunk.markdown}
      </MarkdownHooks>
    </div>
  )
}
