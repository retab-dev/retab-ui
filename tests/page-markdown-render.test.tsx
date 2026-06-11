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

import { PageMarkdownViewer } from "@/components/viewers/page-markdown/page-markdown-viewer"

const PAGES = ["# First page\n\nAlpha", "## Second page\n\nBeta"]

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class MockIntersectionObserver {
      private callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      observe(target: Element) {
        this.callback(
          [
            {
              target,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: 0,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver
        )
      }

      disconnect() {}
      takeRecords() {
        return []
      }
      unobserve() {}
    }
  )
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 800,
  })
  HTMLElement.prototype.getAnimations = vi.fn(() => [])
  HTMLElement.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("PageMarkdownViewer", () => {
  it("renders the standard page toolbar and markdown actions", async () => {
    render(<PageMarkdownViewer pages={PAGES} />)

    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy()
    expect(screen.getByLabelText("Zoom out")).toBeTruthy()
    expect(screen.getByText("100%")).toBeTruthy()
    expect(screen.getByLabelText("Zoom in")).toBeTruthy()
    expect(screen.getByLabelText("Fit width")).toBeTruthy()
    expect(screen.getByLabelText("Copy markdown")).toBeTruthy()
    expect(screen.getByLabelText("Download markdown")).toBeTruthy()
    expect(await screen.findByText("First page")).toBeTruthy()
  })

  it("moves secondary actions into a menu when the toolbar is narrow", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 400,
    })

    render(<PageMarkdownViewer pages={PAGES} />)

    expect(screen.getByText("Page 1 of 2")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Rendered" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Text" })).toBeTruthy()
    expect(screen.getByLabelText("More markdown actions")).toBeTruthy()
    expect(screen.queryByLabelText("Copy markdown")).toBeNull()
    expect(screen.queryByLabelText("Download markdown")).toBeNull()
  })

  it("switches from rendered markdown to page text", async () => {
    const { container } = render(<PageMarkdownViewer pages={PAGES} />)

    fireEvent.click(screen.getByRole("tab", { name: "Text" }))

    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll("pre")).some(
          (pre) => pre.textContent === "# First page\n\nAlpha"
        )
      ).toBe(true)
    })
  })

  it("shows a generic page-by-page empty state", () => {
    render(<PageMarkdownViewer pages={[]} />)

    expect(screen.getByText("No markdown pages yet")).toBeTruthy()
    expect(
      screen.getByText(
        "Provide page-by-page markdown to see the rendered document here."
      )
    ).toBeTruthy()
  })
})
