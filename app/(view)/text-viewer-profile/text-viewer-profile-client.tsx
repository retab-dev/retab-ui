"use client"

import * as React from "react"

import { TextViewer } from "@/components/ui/text-viewer"
import { ChenglouTextViewer } from "@/components/ui/text-viewer-chenglou"
import { VanillaChengTextViewer } from "@/components/ui/text-viewer-vanillacheng"

type ProfileVariant = "chenglou" | "current" | "vanillacheng"

const PROFILE_TEXT = createProfileMarkdown()

export function TextViewerProfileClient({
  variant,
}: {
  variant: ProfileVariant
}) {
  const Viewer =
    variant === "vanillacheng"
      ? VanillaChengTextViewer
      : variant === "chenglou"
        ? ChenglouTextViewer
        : TextViewer
  return (
    <main className="h-screen bg-background p-4 text-foreground">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-medium">Text Viewer Profile</h1>
        <span
          data-profile-variant={variant}
          className="text-xs text-muted-foreground"
        >
          {variant}
        </span>
      </div>
      <section className="h-[calc(100vh-56px)]" data-profile-root={variant}>
        <Viewer
          bare
          controls={false}
          mode="markdown"
          source={{
            kind: "text",
            fileName: "profile.md",
            mimeType: "text/markdown",
            text: PROFILE_TEXT,
          }}
        />
      </section>
    </main>
  )
}

function createProfileMarkdown() {
  const blocks: string[] = []
  for (let index = 0; index < 700; index++) {
    blocks.push(
      `## Release note ${index + 1}`,
      "",
      `This paragraph is intentionally long enough to wrap naturally inside the text viewer. It includes multiple inline spans, a [safe link](https://example.com/profile/${index}), and enough prose to exercise Pretext line measurement without becoming a code-oriented workload.`,
      "",
      `- Rendered block ${index + 1}`,
      `- Virtual projection window ${index % 37}`,
      "",
      "```ts",
      `const profile_${index} = ${index} * 2`,
      `console.log(profile_${index})`,
      "```"
    )
  }
  return blocks.join("\n")
}
