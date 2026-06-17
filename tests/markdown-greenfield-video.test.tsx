// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarkdownViewer } from "@/components/ui/markdown-viewer"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "videos.md",
    mimeType: "text/markdown",
    text,
  }
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("pretext markdown greenfield videos", () => {
  it("renders safe Video components with normalized boolean props", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '<Video src="https://example.com/demo.mp4" label="Demo video" title="Demo caption" controls={false} loop muted />'
        )}
      />
    )

    const video = container.querySelector("video")
    const figure = screen.getByRole("group", { name: "Demo video" })

    expect(figure.getAttribute("data-pretext-video-state")).toBe("ready")
    expect(video?.getAttribute("src")).toBe("https://example.com/demo.mp4")
    expect(video?.hasAttribute("controls")).toBe(false)
    expect(video?.hasAttribute("loop")).toBe(true)
    expect((video as HTMLVideoElement | null)?.muted).toBe(true)
    expect(screen.getByText("Demo caption")).toBeTruthy()
  })

  it("keeps failed videos measurable and announces the load failure", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '<Video src="https://example.com/missing.mp4" label="Missing video" />'
        )}
      />
    )

    const video = container.querySelector("video")
    fireEvent.error(video!)

    expect(
      screen
        .getByRole("group", { name: "Video failed to load: Missing video" })
        .getAttribute("data-pretext-video-state")
    ).toBe("failed")
  })

  it("blocks unsafe Video URLs before they reach the DOM", () => {
    const scriptRender = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '<Video src="javascript:alert(1)" label="Script video" />'
        )}
      />
    )

    expect(scriptRender.container.querySelector("video")).toBeNull()
    expect(
      screen
        .getByRole("group", { name: "Video blocked: Script video" })
        .getAttribute("data-pretext-video-state")
    ).toBe("blocked")
    cleanup()

    const svgRender = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '<Video src="https://example.com/vector.svg" label="SVG video" />'
        )}
      />
    )

    expect(svgRender.container.querySelector("video")).toBeNull()
    expect(
      screen
        .getByRole("group", { name: "Video blocked: SVG video" })
        .getAttribute("data-pretext-video-state")
    ).toBe("blocked")
  })
})
