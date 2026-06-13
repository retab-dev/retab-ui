// @vitest-environment jsdom

import * as React from "react"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { JsonInspector } from "@/registry/new-york-v4/ui/json-inspector"

beforeEach(() => {
  const requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }
  globalThis.requestAnimationFrame = requestAnimationFrame
  globalThis.cancelAnimationFrame = vi.fn()
  window.requestAnimationFrame = requestAnimationFrame
  window.cancelAnimationFrame = vi.fn()
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("JsonInspector virtualization", () => {
  it("mounts only the visible line projection for large JSON payloads", async () => {
    const data = {
      rows: Array.from({ length: 1_000 }, (_, index) => ({
        id: index,
        name: `row ${index}`,
      })),
    }

    const view = render(
      <div style={{ height: 120 }}>
        <JsonInspector data={data} />
      </div>
    )
    const viewport = view.container.querySelector<HTMLElement>(
      '[data-slot="json-inspector-virtual-scroll"]'
    )
    if (!viewport) throw new Error("Missing JSON inspector virtual scroll")
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 120,
    })

    await act(async () => {
      viewport.scrollTop = 4_000
      fireEvent.scroll(viewport)
    })

    const renderedLines = Array.from(
      view.container.querySelectorAll<HTMLElement>("[data-json-line-index]")
    )
    const lineIndexes = renderedLines.map((line) =>
      Number(line.dataset.jsonLineIndex)
    )

    expect(renderedLines.length).toBeLessThan(40)
    expect(Math.min(...lineIndexes)).toBeGreaterThanOrEqual(190)
    expect(Math.max(...lineIndexes)).toBeLessThan(220)
    expect(view.container.textContent).toContain('"row 50"')
    expect(view.container.textContent).not.toContain('"row 999"')
  })
})
