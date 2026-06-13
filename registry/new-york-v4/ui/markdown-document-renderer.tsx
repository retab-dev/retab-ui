"use client"

import * as React from "react"
import { MarkdownHooks } from "react-markdown"

import {
  type MarkdownDocumentPage,
  type MarkdownLineRange,
} from "./markdown-document-model"
import {
  MARKDOWN_DOCUMENT_REHYPE_PLUGINS,
  MARKDOWN_DOCUMENT_REMARK_PLUGINS,
} from "./markdown-document-plugins"
import { createMarkdownDocumentRenderers } from "./markdown-document-renderers"
import { sanitizeMarkdownUrl } from "./markdown-document-url-policy"

export function MarkdownDocumentPageRenderer({
  headingIdsByLine,
  highlightRange,
  page,
}: {
  headingIdsByLine: ReadonlyMap<number, string>
  highlightRange: MarkdownLineRange | null
  page: MarkdownDocumentPage
}) {
  const components = React.useMemo(
    () =>
      createMarkdownDocumentRenderers({
        headingIdsByLine,
        highlightRange,
        page,
      }),
    [headingIdsByLine, highlightRange, page]
  )

  return (
    <MarkdownHooks
      rehypePlugins={MARKDOWN_DOCUMENT_REHYPE_PLUGINS}
      remarkPlugins={MARKDOWN_DOCUMENT_REMARK_PLUGINS}
      remarkRehypeOptions={{ allowDangerousHtml: true }}
      components={components}
      urlTransform={sanitizeMarkdownUrl}
    >
      {page.markdown}
    </MarkdownHooks>
  )
}
