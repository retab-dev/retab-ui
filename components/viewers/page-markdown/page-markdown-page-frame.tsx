"use client";

import * as React from "react";

import { PageMarkdownContent } from "@/components/viewers/page-markdown/page-markdown-content";
import {
  PAGE_MARKDOWN_PAGE_PADDING_X,
  PAGE_MARKDOWN_PAGE_PADDING_Y,
  PAGE_MARKDOWN_PAGE_WIDTH,
} from "@/components/viewers/page-markdown/page-markdown-layout";
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types";

export const PageMarkdownPageFrame = React.memo(function PageMarkdownPageFrame({
  estimatedHeight,
  pageNumber,
  markdown,
  mode,
  onSize,
  scale,
}: {
  estimatedHeight: number;
  markdown: string;
  mode: PageMarkdownViewMode;
  onSize: (pageNumber: number, height: number) => void;
  pageNumber: number;
  scale: number;
}) {
  const pageElementRef = React.useRef<HTMLDivElement | null>(null);
  const reportSize = React.useCallback(() => {
    const pageElement = pageElementRef.current;
    if (!pageElement) return;

    const height = pageElement.offsetHeight;
    if (height > 0) onSize(pageNumber, height);
  }, [onSize, pageNumber]);
  const pageRef = React.useCallback(
    (pageElement: HTMLDivElement | null) => {
      pageElementRef.current = pageElement;
      if (!pageElement) return;

      reportSize();

      if (typeof ResizeObserver !== "function") return;

      const observer = new ResizeObserver(reportSize);
      observer.observe(pageElement);
      return () => observer.disconnect();
    },
    [reportSize],
  );

  const pageWidth = PAGE_MARKDOWN_PAGE_WIDTH * scale;
  const pagePaddingX = PAGE_MARKDOWN_PAGE_PADDING_X * scale;
  const pagePaddingY = PAGE_MARKDOWN_PAGE_PADDING_Y * scale;

  return (
    <div
      ref={pageRef}
      data-slot="page-markdown-page"
      data-page={pageNumber}
      className="bg-card ring-border relative w-full max-w-3xl shadow-sm ring-1"
      style={{
        minHeight: estimatedHeight,
        width: `${pageWidth}px`,
        maxWidth: scale <= 1 ? "100%" : "none",
        paddingInline: `${pagePaddingX}px`,
        paddingBlock: `${pagePaddingY}px`,
      }}
    >
      <PageMarkdownContent
        markdown={markdown}
        mode={mode}
        onRenderedContentChange={reportSize}
        scale={scale}
      />
    </div>
  );
});
