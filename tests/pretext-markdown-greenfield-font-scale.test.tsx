// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { createPretextMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/pretext-markdown-greenfield-document"
import {
  PRETEXT_MARKDOWN_GREENFIELD_BASE_FONT_PX,
  PretextMarkdownGreenfieldChunkRenderer,
} from "@/registry/new-york-v4/ui/pretext-markdown-greenfield-renderer"

afterEach(cleanup)

function renderFirstChunk(fontScale?: number) {
  const parsed = createPretextMarkdownGreenfieldDocument(
    "Body copy whose size is driven by the zoom font scale."
  )
  const { container } = render(
    <PretextMarkdownGreenfieldChunkRenderer
      chunk={parsed.chunks[0]}
      fontScale={fontScale}
    />
  )
  return container.querySelector<HTMLElement>(
    '[data-slot="pretext-markdown-greenfield-content"]'
  )
}

describe("pretext markdown rendered font scaling", () => {
  it("renders the base size at the default (100%) scale", () => {
    const content = renderFirstChunk()
    expect(content?.style.fontSize).toBe(
      `${PRETEXT_MARKDOWN_GREENFIELD_BASE_FONT_PX}px`
    )
  })

  it("scales the rendered body font-size with the zoom fontScale", () => {
    const content = renderFirstChunk(2)
    // The whole document cascades off this one value, so doubling the scale
    // doubles the body size (and, via em units, everything else).
    expect(content?.style.fontSize).toBe(
      `${PRETEXT_MARKDOWN_GREENFIELD_BASE_FONT_PX * 2}px`
    )
  })
})
