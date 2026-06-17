import { describe, expect, it } from "vitest"

import { createPretextMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/pretext-markdown-greenfield-document"
import {
  layoutPretextMarkdownGreenfieldDocument,
  PRETEXT_MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
  type PretextMarkdownGreenfieldMeasurementContext,
} from "@/registry/new-york-v4/ui/pretext-markdown-greenfield-layout"

describe("pretext markdown greenfield layout", () => {
  it("caches immutable layout frames by document, width, scale, and measurements", () => {
    const document = createPretextMarkdownGreenfieldDocument(
      [
        "# Cached Layout",
        "",
        ...Array.from(
          { length: 80 },
          (_, index) => `Paragraph ${index + 1} with enough text to estimate.`
        ),
      ].join("\n")
    )
    const first = layoutPretextMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1,
    })
    const second = layoutPretextMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1,
    })
    const scaled = layoutPretextMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1.2,
    })

    expect(second).toBe(first)
    expect(scaled).not.toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.chunks)).toBe(true)
    expect(Object.isFrozen(first.chunks[0])).toBe(true)
    expect(() => {
      ;(first.chunks as unknown[]).push(first.chunks[0])
    }).toThrow()
  })

  it("invalidates cached layout frames when measured heights change", () => {
    const document = createPretextMarkdownGreenfieldDocument(
      ["# Measured", "", "A paragraph.", "", "## Later", "", "More."].join("\n")
    )
    const measuredHeights = new Map<string, number>()
    const lookup = {
      get(
        chunk: { id: string },
        context: PretextMarkdownGreenfieldMeasurementContext
      ) {
        expect(context.policyVersion).toBe(
          PRETEXT_MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION
        )
        return measuredHeights.get(chunk.id)
      },
    }

    measuredHeights.set(document.chunks[0]!.id, 120)
    const first = layoutPretextMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    })
    const second = layoutPretextMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    })

    measuredHeights.set(document.chunks[0]!.id, 180)
    const changed = layoutPretextMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    })

    expect(second).toBe(first)
    expect(changed).not.toBe(first)
    expect(first.chunks[0]?.measuredHeight).toBe(120)
    expect(changed.chunks[0]?.measuredHeight).toBe(180)
  })
})
