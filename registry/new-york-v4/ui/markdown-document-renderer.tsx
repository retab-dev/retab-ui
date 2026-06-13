"use client"

import * as React from "react"
import ReactMarkdown, { MarkdownHooks } from "react-markdown"

import {
  type MarkdownDocumentPage,
  type MarkdownLineRange,
} from "./markdown-document-model"
import {
  MARKDOWN_DOCUMENT_REHYPE_PLUGINS,
  MARKDOWN_DOCUMENT_REMARK_PLUGINS,
  MARKDOWN_DOCUMENT_SYNC_REHYPE_PLUGINS,
} from "./markdown-document-plugins"
import { createMarkdownDocumentRenderers } from "./markdown-document-renderers"
import { sanitizeMarkdownUrl } from "./markdown-document-url-policy"

export function MarkdownDocumentPageRenderer({
  headingIdsByLine,
  highlightRange,
  onContentReady,
  page,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  highlightRange: MarkdownLineRange | null
  onContentReady?: () => void
  page: MarkdownDocumentPage
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
        page,
      }),
    [headingIdsByLine, highlightRange, page]
  )
  React.useEffect(() => {
    hasReportedReadyRef.current = false
    setRenderState("pending")
  }, [page.markdown])

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
    return () => observer?.disconnect()
  }, [onContentReady, page.markdown])

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
        {page.markdown}
      </MarkdownHooks>
    </div>
  )
}
