"use client"

import { PretextMarkdownViewer } from "@/components/ui/pretext-markdown-viewer"

const PRETEXT_MARKDOWN_VIEWER_DEMO_TEXT = [
  "# Pretext Markdown Viewer",
  "",
  "The Pretext Markdown Viewer is a continuous Markdown reading surface. It keeps the document in one scroll flow while virtualizing the visible block window.",
  "",
  "> [!IMPORTANT]",
  "> This component is separate from the existing Markdown Viewer and is the place where the Pretext-based approach can evolve.",
  "",
  'The renderer applies small prose transforms like "smart quotes", arrows ->, and emoji shortcodes :sparkles: without rewriting inline code such as `a -> b`.',
  "",
  "## Current Surface",
  "",
  "- [x] Continuous Markdown rendering",
  "- [x] Pretext-backed layout prediction",
  "- [x] GitHub alert marker normalization",
  "- [x] Tables, lists, quotes, rules, and fenced code fallbacks",
  "",
  "| Area | Status |",
  "| --- | --- |",
  "| Layout | Continuous virtual flow |",
  "| Source | URL, Blob, and inline text |",
  "| Pages | Not part of the UI model |",
  "",
  "```ts",
  "export const viewer = 'pretext-markdown'",
  "```",
  "",
  "---",
  "",
  ...Array.from(
    { length: 18 },
    (_, index) =>
      `## Section ${index + 1}\n\nThis section gives the demo enough length to prove that the viewer keeps one continuous scroll surface while mounting only the visible Markdown window.`
  ),
].join("\n")

export function PretextMarkdownViewerDemo() {
  return (
    <div className="not-prose my-6 h-[620px] min-h-0">
      <PretextMarkdownViewer
        source={{
          kind: "text",
          text: PRETEXT_MARKDOWN_VIEWER_DEMO_TEXT,
          fileName: "pretext-release-notes.md",
          mimeType: "text/markdown",
        }}
        className="h-full"
        highlight={{ start: 7, end: 7 }}
      />
    </div>
  )
}
