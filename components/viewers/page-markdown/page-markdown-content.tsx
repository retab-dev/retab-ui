"use client";

import * as React from "react";

import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { usePageMarkdownProjection } from "@/components/viewers/page-markdown/page-markdown-projection";
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types";
import { joinEffectKey } from "@/lib/effect-key";

export function PageMarkdownContent({
  markdown,
  mode,
  onRenderedContentChange,
  scale,
}: {
  markdown: string;
  mode: PageMarkdownViewMode;
  onRenderedContentChange?: () => void;
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
      <PageMarkdownRenderedProjection
        markdown={markdown}
        onProjectionChange={onRenderedContentChange}
      />
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
  function PageMarkdownRenderedProjection({
    markdown,
    onProjectionChange,
  }: {
    markdown: string;
    onProjectionChange?: () => void;
  }) {
    const projection = usePageMarkdownProjection(markdown);
    useKeyedLayoutEffect(
      projection
        ? joinEffectKey([
            "page-markdown-projection",
            projection,
            onProjectionChange,
          ])
        : null,
      () => {
        onProjectionChange?.();
      },
    );
    return projection;
  },
);
