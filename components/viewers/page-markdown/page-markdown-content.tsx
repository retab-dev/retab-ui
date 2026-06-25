"use client";

import * as React from "react";

import { projectPageMarkdown } from "@/components/viewers/page-markdown/page-markdown-projection";
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
        <PageMarkdownText markdown={markdown} />
      </pre>
    );
  }

  return (
    <div className="leading-relaxed" style={{ fontSize: `${14 * scale}px` }}>
      <PageMarkdownRenderedProjection markdown={markdown} />
    </div>
  );
}

const PageMarkdownText = React.memo(function PageMarkdownText({
  markdown,
}: {
  markdown: string;
}) {
  return markdown;
});

const PageMarkdownRenderedProjection = React.memo(
  function PageMarkdownRenderedProjection({ markdown }: { markdown: string }) {
    return projectPageMarkdown(markdown);
  },
);
