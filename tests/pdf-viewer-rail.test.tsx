// @vitest-environment jsdom
import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PdfViewerRail } from "@/registry/new-york-v4/ui/pdf-viewer-rail"

describe("PdfViewerRail", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("measures animated rail width and collapses without losing the measured width", () => {
    let resizeCallback: ResizeObserverCallback | null = null
    const disconnect = vi.fn()

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback
        }
        observe() {}
        disconnect = disconnect
      }
    )
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return Number(
          this.dataset.width ??
            (this.firstElementChild as HTMLElement | null)?.dataset.width ??
            0
        )
      },
    })

    const { rerender } = render(
      <PdfViewerRail side="left" open animate>
        <div data-testid="rail-content" data-width="180" />
      </PdfViewerRail>
    )

    const rail = screen.getByTestId("rail-content").parentElement!
      .parentElement as HTMLElement

    expect(rail.style.width).toBe("180px")

    rerender(
      <PdfViewerRail side="left" open={false} animate>
        <div data-testid="rail-content" data-width="180" />
      </PdfViewerRail>
    )
    expect(rail.style.width).toBe("0px")

    screen.getByTestId("rail-content").dataset.width = "240"
    const notifyResize = resizeCallback as unknown as ResizeObserverCallback
    expect(notifyResize).not.toBeNull()
    notifyResize(
      [
        {
          target: screen.getByTestId("rail-content").parentElement,
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    )

    rerender(
      <PdfViewerRail side="left" open animate>
        <div data-testid="rail-content" data-width="240" />
      </PdfViewerRail>
    )

    expect(rail.style.width).toBe("240px")
    cleanup()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it("does not force a width style when rail animation is disabled", () => {
    render(
      <PdfViewerRail side="right" open={false} animate={false}>
        <div data-testid="static-rail-content" />
      </PdfViewerRail>
    )

    const rail = screen.getByTestId("static-rail-content").parentElement!
      .parentElement as HTMLElement

    expect(rail.style.width).toBe("")
    expect(rail.dataset.state).toBe("closed")
    expect(rail.dataset.side).toBe("right")
  })
})
