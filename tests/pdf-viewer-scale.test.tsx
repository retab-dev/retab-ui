// @vitest-environment jsdom
import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clampPdfScale,
  getPdfFitWidthScale,
  MAX_PDF_SCALE,
  MIN_PDF_SCALE,
  PDF_PAGE_HORIZONTAL_PADDING,
  useMeasuredElementWidth,
} from "@/registry/new-york-v4/ui/pdf-viewer-scale"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("pdf-viewer-scale", () => {
  it("clamps explicit scale values to the viewer bounds", () => {
    expect(clampPdfScale(0)).toBe(MIN_PDF_SCALE)
    expect(clampPdfScale(10)).toBe(MAX_PDF_SCALE)
    expect(clampPdfScale(Number.NaN)).toBe(1)
  })

  it("clamps fit-width scale with the same policy as manual zoom", () => {
    expect(getPdfFitWidthScale(0, 100)).toBe(1)
    expect(getPdfFitWidthScale(PDF_PAGE_HORIZONTAL_PADDING - 1, 100)).toBe(
      MIN_PDF_SCALE
    )
    expect(getPdfFitWidthScale(10000, 100)).toBe(MAX_PDF_SCALE)
  })

  it("cancels a pending measured-width frame when the element is replaced", async () => {
    let observedElement: Element | null = null
    let resizeCallback: ResizeObserverCallback | null = null
    const disconnect = vi.fn()
    const frames = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback
        }
        observe(element: Element) {
          observedElement = element
        }
        disconnect = disconnect
      }
    )
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = nextFrameId++
      frames.set(frameId, callback)
      return frameId
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      frames.delete(frameId)
    })

    function MeasuredWidth({ width }: { width: number }) {
      const measured = useMeasuredElementWidth()
      return (
        <>
          <div
            key={width}
            ref={measured.ref}
            data-testid="measured-element"
            data-width={width}
          />
          <output data-testid="width">{measured.width ?? "null"}</output>
        </>
      )
    }

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return Number(this.dataset.width ?? 0)
      },
    })

    const { rerender } = render(<MeasuredWidth width={200} />)

    await waitFor(() =>
      expect(screen.getByTestId("width").textContent).toBe("200")
    )
    expect(observedElement).toBe(screen.getByTestId("measured-element"))

    resizeCallback?.(
      [
        {
          target: screen.getByTestId("measured-element"),
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    )
    expect(frames.size).toBe(1)

    rerender(<MeasuredWidth width={360} />)

    await waitFor(() =>
      expect(screen.getByTestId("width").textContent).toBe("360")
    )
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })
})
