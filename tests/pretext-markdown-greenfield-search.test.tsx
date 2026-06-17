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
    fileName: "search.md",
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

describe("pretext markdown greenfield search", () => {
  it("finds offscreen source matches and highlights the owning rendered chunk", async () => {
    const markdown = [
      "# Search",
      "",
      ...Array.from(
        { length: 90 },
        (_, index) => `Regular paragraph ${index + 1}.`
      ),
      "",
      "The offscreen needle is here.",
    ].join("\n")
    const { container } = render(
      <PretextMarkdownViewer source={markdownSource(markdown)} />
    )

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search Markdown" }),
      {
        target: { value: "needle" },
      }
    )

    await waitFor(() => {
      expect(
        container.querySelector('[data-pretext-markdown-highlighted=""]')
      ).toBeTruthy()
    })
    expect(
      screen.getByText("1 / 1", {
        selector: '[data-slot="pretext-markdown-search-status"]',
      })
    ).toBeTruthy()
    expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled()
    expect(
      container
        .querySelector("[data-source-highlight-start]")
        ?.getAttribute("data-source-highlight-start")
    ).toBe("94")
  })

  it("clears search state from the controls", async () => {
    render(
      <PretextMarkdownViewer source={markdownSource("alpha beta alpha")} />
    )

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search Markdown" }),
      {
        target: { value: "alpha" },
      }
    )
    expect(screen.getByLabelText("Clear Markdown search")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Clear Markdown search"))

    expect(
      (
        screen.getByRole("searchbox", {
          name: "Search Markdown",
        }) as HTMLInputElement
      ).value
    ).toBe("")
  })

  it("bridges browser-native find matches back to virtual source lines", async () => {
    const markdown = [
      "# Native Find",
      "",
      ...Array.from(
        { length: 90 },
        (_, index) => `Regular native-find paragraph ${index + 1}.`
      ),
      "",
      "The browser-native-find-only target is here.",
    ].join("\n")
    const { container } = render(
      <PretextMarkdownViewer source={markdownSource(markdown)} />
    )

    const nativeFindEntry = await waitFor(() => {
      const entry = container.querySelector<HTMLElement>(
        '[data-native-find-start-line="94"]'
      )
      expect(entry).toBeTruthy()
      return entry!
    })

    expect(nativeFindEntry.getAttribute("hidden")).toBe("until-found")
    nativeFindEntry.dispatchEvent(new Event("beforematch"))

    await waitFor(() => {
      expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled()
    })
    const lastScroll = [...(HTMLElement.prototype.scrollTo as any).mock.calls]
      .reverse()
      .find(([options]) => options && typeof options.top === "number")

    expect(lastScroll?.[0].top).toBeGreaterThan(0)
  })
})
