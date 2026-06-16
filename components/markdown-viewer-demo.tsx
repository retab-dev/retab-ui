"use client"

import { MarkdownDocumentViewer } from "@/components/ui/markdown-document-viewer"

const MARKDOWN_VIEWER_DEMO_TEXT = [
  "---",
  "title: Release Notes",
  "version: 1.0",
  "---",
  "",
  "# Release Notes",
  "",
  "## Summary",
  "",
  'The Markdown Viewer renders "polished" prose -- with emoji :sparkles:, diagrams, alerts, components, and a Rendered/Text toggle.',
  "",
  "> [!IMPORTANT]",
  "> Source text stays faithful while rendered mode adds safe document polish.",
  "",
  "Footnotes are rendered accessibly.[^demo]",
  "",
  "[^demo]: Footnote backrefs stay keyboard reachable.",
  "",
  ':::tip{title="Workflow"}',
  "Use directive callouts for generated reports and docs.",
  ":::",
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
  "| GitHub alerts | Supported |",
  "| Mermaid | Safe diagram surface |",
  "",
  "```ts",
  "export const viewer = 'markdown'",
  "```",
  "",
  "```mermaid",
  "graph TD",
  "  Source --> Model",
  "  Model --> Rendered",
  "  Model --> Text",
  "```",
  "",
  '<Metric label="Accuracy" value="98%" />',
  "",
  "> Markdown should read like a document, not like source code.",
  "",
  ...Array.from(
    { length: 24 },
    (_, index) =>
      `## Section ${index + 1}\n\nThis section gives the demo enough length to prove that the viewer keeps a small virtual chunk window while preserving continuous document reading flow.`
  ),
].join("\n")

export function MarkdownViewerDemo() {
  return (
    <div className="h-[620px] min-h-0">
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
