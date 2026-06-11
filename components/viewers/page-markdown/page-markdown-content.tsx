"use client"

import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"

import { markdownComponents } from "@/components/viewers/page-markdown/page-markdown-components"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"

export function PageMarkdownContent({
  markdown,
  mode,
  scale,
}: {
  markdown: string
  mode: PageMarkdownViewMode
  scale: number
}) {
  if (mode === "text") {
    return (
      <pre
        className="font-mono leading-relaxed whitespace-pre-wrap text-foreground/90"
        style={{ fontSize: `${12 * scale}px` }}
      >
        {markdown}
      </pre>
    )
  }

  return (
    <div className="leading-relaxed" style={{ fontSize: `${14 * scale}px` }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
