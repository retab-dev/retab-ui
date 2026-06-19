"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { markdownComponents } from "@/components/viewers/page-markdown/page-markdown-components";
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types";

export function PageMarkdownContent({
  markdown,
  mode,
  scale,
}: {
  markdown: string;
  mode: PageMarkdownViewMode;
  scale: number;
}) {
  if (mode === "text") {
    return (
      <pre
        className="text-foreground/90 font-mono leading-relaxed whitespace-pre-wrap"
        style={{ fontSize: `${12 * scale}px` }}
      >
        {markdown}
      </pre>
    );
  }

  return (
    <div className="leading-relaxed" style={{ fontSize: `${14 * scale}px` }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
