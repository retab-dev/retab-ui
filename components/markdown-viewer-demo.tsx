"use client"

import { MarkdownDocumentViewer } from "@/components/ui/markdown-document-viewer"

const MARKDOWN_VIEWER_DEMO_TEXT = [
  "# Release Notes",
  "",
  "## Summary",
  "",
  "The Markdown Viewer renders prose documents as paged, virtualized Markdown with a Rendered/Text toggle.",
  "",
  "## Changes",
  "",
  "- [x] Render GFM tables and task lists",
  "- [x] Keep raw HTML inert",
  "- [x] Virtualize large documents",
  "",
  "| Area | Status |",
  "| --- | --- |",
  "| Tables | Supported |",
  "| Code blocks | Supported |",
  "| Raw HTML | Inert fallback |",
  "",
  "```ts",
  "export const viewer = 'markdown'",
  "```",
  "",
  "> Markdown should read like a document, not like source code.",
  "",
  ...Array.from(
    { length: 24 },
    (_, index) =>
      `## Section ${index + 1}\n\nThis section gives the demo enough length to prove that the viewer keeps a small virtual page window while preserving normal document reading flow.`
  ),
].join("\n")

export function MarkdownViewerDemo() {
  return (
    <div className="not-prose my-6 h-[620px] min-h-0">
      <MarkdownDocumentViewer
        source={{
          kind: "text",
          text: MARKDOWN_VIEWER_DEMO_TEXT,
          fileName: "release-notes.md",
          mimeType: "text/markdown",
        }}
        className="h-full"
      />
    </div>
  )
}
