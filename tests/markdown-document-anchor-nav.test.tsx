// @vitest-environment jsdom

// Integration bug hunt for in-document heading anchor navigation.
//
// The viewer generates heading anchor ids twice, with two different slug
// algorithms that disagree for some headings:
//
//   * DOM `id` comes from rehypeSlug (github-slugger). The renderer *intends* to
//     set its own model id (`id={headingId(node, children)}` in
//     markdown-document-renderers.tsx) but the later `{...props}` spread carries
//     rehypeSlug's id and clobbers it, so the github-slugger slug wins in the DOM.
//   * handleFragmentClick (markdown-document-viewer.tsx) resolves `#fragment`
//     links by matching against the *model* slug (createHeadingId /
//     slugifyHeading), which strips `_`, collapses `&`-with-spaces, etc.
//
// When the two slugs differ, a link pointing at a heading's real DOM anchor does
// not navigate, and the model slug that *does* navigate matches no DOM element.
// The cases below pin the invariant that should hold (DOM anchor id == the slug
// fragment navigation resolves); the three that currently fail are the open bug.

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarkdownDocumentViewer } from "@/components/ui/markdown-document-viewer"
import { createMarkdownDocument } from "@/registry/new-york-v4/ui/markdown-document-model"

function markdownSource(text: string) {
  return { kind: "text" as const, fileName: "notes.md", text, mimeType: "text/markdown" }
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(function scrollTo(this: HTMLElement, options?: ScrollToOptions | number) {
      if (typeof options === "object" && typeof options.top === "number") {
        this.scrollTop = options.top
      }
    }),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// The model slug a `#fragment` link must use for handleFragmentClick to resolve.
const modelHeadingId = (heading: string) =>
  createMarkdownDocument(heading).blocks.find((block) => block.headingId)?.headingId

describe("markdown heading anchor navigation", () => {
  it("renders a DOM id for plain headings that the fragment handler can resolve", async () => {
    render(<MarkdownDocumentViewer source={markdownSource("# Hello World")} toolbar={false} />)
    const heading = await screen.findByRole("heading", { name: "Hello World" })
    expect(heading.id).toBe("hello-world")
    expect(modelHeadingId("# Hello World")).toBe(heading.id)
  })

  it("keeps heading DOM ids resolvable by fragment navigation (underscores)", async () => {
    // DOM id is `snake_case_thing` (github-slugger) but the fragment handler only
    // knows `snakecasething` (model), so a link to the real anchor cannot resolve.
    render(<MarkdownDocumentViewer source={markdownSource("# snake_case_thing")} toolbar={false} />)
    const heading = await screen.findByRole("heading", { name: "snake_case_thing" })
    expect(modelHeadingId("# snake_case_thing")).toBe(heading.id)
  })

  it("keeps heading DOM ids resolvable by fragment navigation (ampersand)", async () => {
    render(<MarkdownDocumentViewer source={markdownSource("# Foo & Bar")} toolbar={false} />)
    const heading = await screen.findByRole("heading", { name: "Foo & Bar" })
    expect(modelHeadingId("# Foo & Bar")).toBe(heading.id)
  })

  it("navigates when a link targets a heading's real DOM anchor", async () => {
    // Links live on page 1; the target heading sits far below so a successful
    // navigation produces a measurable scrollTop. The link points at the
    // heading's actual DOM id (#snake_case_thing) — which currently fails to
    // scroll because handleFragmentClick only matches the model slug.
    const filler = Array.from({ length: 80 }, (_, i) => `Filler paragraph ${i}`).join("\n\n")
    const text = ["[Jump](#snake_case_thing)", "", filler, "", "## snake_case_thing"].join("\n")
    const { container } = render(
      <MarkdownDocumentViewer
        className="h-40 w-[420px]"
        source={markdownSource(text)}
        toolbar={false}
      />
    )
    const link = await screen.findByRole("link", { name: "Jump" })
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )!
    viewport.scrollTop = 0
    fireEvent.click(link)
    expect(viewport.scrollTop).toBeGreaterThan(0)
  })
})
