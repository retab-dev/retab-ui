// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PretextMarkdownViewer } from "@/components/ui/pretext-markdown-viewer"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "navigation.md",
    mimeType: "text/markdown",
    text,
  }
}

let scrollTo: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollTo = vi.fn()
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  })
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState(null, "", "/")
})

describe("pretext markdown greenfield navigation", () => {
  it("resolves an initial offscreen heading hash through the virtual document model", async () => {
    window.history.replaceState(null, "", "/viewer#target-section")

    render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "# Start",
            "",
            ...Array.from({ length: 90 }, (_, index) => `Spacer ${index + 1}`),
            "",
            "## Target Section",
            "",
            "The target can start outside the mounted window.",
          ].join("\n")
        )}
      />
    )

    await waitFor(() => {
      expect(lastScrollTop()).toBeGreaterThan(0)
    })
  })

  it("intercepts footnote reference clicks and scrolls to generated offscreen footnotes", async () => {
    window.history.replaceState(null, "", "/viewer")

    render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "# Footnotes",
            "",
            "A reference.[^one]",
            "",
            ...Array.from({ length: 80 }, (_, index) => `Spacer ${index + 1}`),
            "",
            "[^one]: Resolved from outside the visible source chunk.",
          ].join("\n")
        )}
      />
    )

    scrollTo.mockClear()
    fireEvent.click(screen.getByRole("link", { name: "Footnote 1" }))

    await waitFor(() => {
      expect(window.location.hash).toBe("#user-content-fn-one")
      expect(lastScrollTop()).toBeGreaterThan(0)
    })
  })

  it("intercepts generated footnote backrefs and scrolls back to offscreen references", async () => {
    window.history.replaceState(null, "", "/viewer")

    render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "# Footnotes",
            "",
            "A reference.[^one]",
            "",
            ...Array.from({ length: 80 }, (_, index) => `Spacer ${index + 1}`),
            "",
            "[^one]: Resolved from outside the visible source chunk.",
          ].join("\n")
        )}
      />
    )

    fireEvent.click(screen.getByRole("link", { name: "Footnote 1" }))
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Back to footnote reference ↩" })
      ).toBeTruthy()
    })

    scrollTo.mockClear()
    fireEvent.click(
      screen.getByRole("link", { name: "Back to footnote reference ↩" })
    )

    await waitFor(() => {
      expect(window.location.hash).toBe("#user-content-fnref-one")
      expect(lastScrollTop()).toBeLessThan(200)
    })
  })

  it("restores fragment targets on browser history popstate", async () => {
    window.history.replaceState(null, "", "/viewer#start")

    render(
      <PretextMarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "# Start",
            "",
            "Opening text.",
            "",
            ...Array.from({ length: 90 }, (_, index) => `Spacer ${index + 1}`),
            "",
            "## Later Target",
            "",
            "Later text.",
          ].join("\n")
        )}
      />
    )

    await waitFor(() => {
      expect(lastScrollTop()).toBeLessThan(200)
    })

    window.history.pushState(null, "", "#later-target")
    scrollTo.mockClear()
    window.dispatchEvent(new PopStateEvent("popstate"))

    await waitFor(() => {
      expect(lastScrollTop()).toBeGreaterThan(0)
    })

    window.history.pushState(null, "", "#start")
    scrollTo.mockClear()
    window.dispatchEvent(new PopStateEvent("popstate"))

    await waitFor(() => {
      expect(lastScrollTop()).toBeLessThan(200)
    })
  })
})

function lastScrollTop() {
  for (const call of [...scrollTo.mock.calls].reverse()) {
    const options = call[0]
    if (
      options &&
      typeof options === "object" &&
      "top" in options &&
      typeof options.top === "number"
    ) {
      return options.top
    }
  }
  return 0
}
