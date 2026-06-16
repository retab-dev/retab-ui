// @vitest-environment jsdom
import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import { PdfViewer } from "@/registry/new-york-v4/ui/pdf-viewer"
import { resetPdfDocumentResourceCacheForTests } from "@/lib/pdf-document-resource"

/**
 * These tests target multi-step *interactions* across the orchestrator —
 * rotation × zoom × fit-width × scrolling — rather than the individual hooks
 * (which already have dedicated suites). The seams between those modules are
 * where a regression is most likely to slip through, so each test drives a
 * sequence and pins down a precisely-computable result.
 */

const pdfjsMock = vi.hoisted(() => {
  type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (reason?: unknown) => void
  }
  const deferred = <T,>(): Deferred<T> => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  return {
    docs: new Map<string, unknown>(),
    pending: new Map<string, Deferred<unknown>>(),
    renderTasks: [] as Array<{ cancel: ReturnType<typeof vi.fn> }>,
    deferred,
    getDocument: vi.fn(),
    GlobalWorkerOptions: {} as { workerSrc?: string },
  }
})

vi.mock("pdfjs-dist", () => pdfjsMock)
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => pdfjsMock)

type MockPage = {
  rotate: number
  getViewport: (options: { scale: number; rotation?: number }) => {
    width: number
    height: number
  }
  render: ReturnType<typeof vi.fn>
}

function makePage(width: number, height: number, rotate = 0): MockPage {
  return {
    rotate,
    getViewport: ({ scale, rotation = rotate }) => {
      const rotated = rotation % 180 !== 0
      return {
        width: (rotated ? height : width) * scale,
        height: (rotated ? width : height) * scale,
      }
    },
    render: vi.fn(() => {
      const task = {
        promise: new Promise<void>(() => {}),
        cancel: vi.fn(),
      }
      pdfjsMock.renderTasks.push(task)
      return task
    }),
  }
}

function makeDoc(pageSizes: Array<[number, number]>) {
  const pages = pageSizes.map(([width, height]) => makePage(width, height))
  return {
    numPages: pages.length,
    pages,
    getPage: vi.fn((pageNumber: number) =>
      Promise.resolve(pages[pageNumber - 1])
    ),
    destroy: vi.fn(() => Promise.resolve()),
  }
}

function findByTextContent(text: string) {
  return screen.findByText((_, element) => element?.textContent === text)
}

class ResizeObserverMock {
  private callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this as never)
  }
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  private callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    this.callback(
      [{ target, isIntersecting: true } as IntersectionObserverEntry],
      this as never
    )
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.useRealTimers()
  pdfjsMock.docs.clear()
  pdfjsMock.pending.clear()
  pdfjsMock.renderTasks.length = 0
  pdfjsMock.getDocument.mockImplementation(
    (src: string | { data: Uint8Array }) => {
      const key =
        typeof src === "string" ? src : `data:${Array.from(src.data).join(",")}`
      if (pdfjsMock.docs.has(key)) {
        const value = pdfjsMock.docs.get(key)
        return {
          promise:
            value instanceof Error
              ? Promise.reject(value)
              : Promise.resolve(value),
        }
      }
      let pending = pdfjsMock.pending.get(key)
      if (!pending) {
        pending = pdfjsMock.deferred()
        pdfjsMock.pending.set(key, pending)
      }
      return { promise: pending.promise }
    }
  )
  pdfjsMock.GlobalWorkerOptions.workerSrc = undefined
  resetPdfDocumentResourceCacheForTests()

  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock)
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as never
  )
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0)
    return 1
  })
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  Element.prototype.getAnimations = vi.fn(() => [])

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return 832
    },
  })
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return 600
    },
  })
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return 1800
    },
  })
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset.slot === "scroll-area-viewport") {
      return { top: 0, height: 600 } as DOMRect
    }
    if (this.dataset.pageNumber) {
      return {
        top: (Number(this.dataset.pageNumber) - 1) * 1000,
        height: 1000,
      } as DOMRect
    }
    return { top: 0, height: 0 } as DOMRect
  }
})

afterEach(() => {
  cleanup()
  resetPdfDocumentResourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function pdfUrlSource(url: string) {
  return { kind: "url" as const, url }
}

function getViewport() {
  return document.querySelector<HTMLElement>(
    "[data-slot='scroll-area-viewport']"
  )
}

function setScrollTop(element: HTMLElement, value: number) {
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    value,
    writable: true,
  })
}

/**
 * Replace the synchronous beforeEach RAF with a manually-driven queue. The
 * synchronous mock runs the callback *before* requestAnimationFrame returns its
 * id, which leaves the scroll hook's coalescing ref stale and suppresses a
 * second scroll in the same test. Real RAF returns the id first and runs the
 * callback later; manual frames reproduce that ordering so consecutive scrolls
 * behave as they do in the browser.
 */
function useManualFrames() {
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback)
    return frames.length
  })
  return () =>
    act(() => {
      frames.splice(0).forEach((callback) => callback(0))
    })
}

describe("PdfViewer — rotation × fit-width interactions", () => {
  it("only swaps the fit-width axis at 90°/270°, not at 180°", async () => {
    // A 100×200 page in an 832px column.
    // Upright fit: (832 - 32) / 100 = 8 → clamped to 5 → 500%.
    // Rotated 90°: width axis becomes the page height 200 → 800 / 200 = 400%.
    // Rotated 180°: upright again (no swap) → back to 500%.
    pdfjsMock.docs.set("/rotate-fit-axis.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/rotate-fit-axis.pdf")} />)
    })
    expect(await screen.findByText("500%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Rotate"))
    expect(await screen.findByText("400%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Rotate"))
    expect(await screen.findByText("500%")).toBeTruthy()
  })

  it("preserves a manual zoom across a rotation instead of refitting", async () => {
    // defaultScale puts the viewer in manual-zoom mode, so rotating must not
    // snap it back to fit-width.
    pdfjsMock.docs.set("/rotate-keep-zoom.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/rotate-keep-zoom.pdf")}
          defaultScale={2}
        />
      )
    })
    expect(await screen.findByText("200%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Rotate"))
    // Manual scale is untouched by rotation.
    expect(await screen.findByText("200%")).toBeTruthy()
  })

  it("fits the rotated axis when clearing a manual zoom after rotating", async () => {
    // 100×200 page. Start zoomed (manual 200%), rotate 90° (still manual 200%),
    // then Fit width: the fit must use the now-horizontal axis (page height 200)
    // → (832 - 32) / 200 = 400%, not the upright 500%.
    pdfjsMock.docs.set("/zoom-rotate-fit.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/zoom-rotate-fit.pdf")}
          defaultScale={2}
        />
      )
    })
    expect(await screen.findByText("200%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Rotate"))
    expect(await screen.findByText("200%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Fit width"))
    expect(await screen.findByText("400%")).toBeTruthy()
  })

  it("clamps a non-finite controlled scale to the maximum in the controls", async () => {
    pdfjsMock.docs.set("/infinite-scale.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/infinite-scale.pdf")}
          scale={Number.POSITIVE_INFINITY}
        />
      )
    })
    await findByTextContent("Page 1 of 1")
    // clampPdfScale(Infinity) → MAX (5) → 500%, matching a huge finite scale.
    expect(screen.getByText("500%")).toBeTruthy()
  })

  it("does not request a scale change when rotating a controlled viewer", async () => {
    pdfjsMock.docs.set("/rotate-controlled.pdf", makeDoc([[100, 200]]))
    const onScaleChange = vi.fn()

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/rotate-controlled.pdf")}
          scale={1.5}
          onScaleChange={onScaleChange}
        />
      )
    })
    await findByTextContent("Page 1 of 1")
    expect(screen.getByText("150%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Rotate"))

    expect(onScaleChange).not.toHaveBeenCalled()
    expect(screen.getByText("150%")).toBeTruthy()
  })
})

describe("PdfViewer — rotation cycle", () => {
  it("cycles the page rotation 0 → 90 → 180 → 270 → 0 over four clicks", async () => {
    pdfjsMock.docs.set("/rotate-cycle.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/rotate-cycle.pdf")}
          renderPageOverlay={({ rotation }) => (
            <div data-testid="rotation">{rotation}</div>
          )}
        />
      )
    })
    expect((await screen.findByTestId("rotation")).textContent).toBe("0")

    const expected = ["90", "180", "270", "0"]
    for (const value of expected) {
      fireEvent.click(screen.getByLabelText("Rotate"))
      await waitFor(() =>
        expect(screen.getByTestId("rotation").textContent).toBe(value)
      )
    }
  })

  it("restores the page box dimensions after a full rotation cycle", async () => {
    // Fixed scale isolates the rotation swap from fit-width rescaling.
    pdfjsMock.docs.set("/rotate-dims.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/rotate-dims.pdf")} defaultScale={1} />
      )
    })
    await findByTextContent("Page 1 of 1")

    const slot = () =>
      document.querySelector<HTMLElement>("[data-page-number='1']")!
    const upright = { width: "100px", minHeight: "200px" }
    const sideways = { width: "200px", minHeight: "100px" }

    const expectBox = (box: { width: string; minHeight: string }) => {
      expect(slot().style.width).toBe(box.width)
      expect(slot().style.minHeight).toBe(box.minHeight)
    }

    expectBox(upright)
    fireEvent.click(screen.getByLabelText("Rotate")) // 90°
    expectBox(sideways)
    fireEvent.click(screen.getByLabelText("Rotate")) // 180°
    expectBox(upright)
    fireEvent.click(screen.getByLabelText("Rotate")) // 270°
    expectBox(sideways)
    fireEvent.click(screen.getByLabelText("Rotate")) // 360° → 0°
    expectBox(upright)
  })
})

describe("PdfViewer — scroll-driven page reporting", () => {
  it("reports a page change once and not again while the marker stays on it", async () => {
    // defaultScale 1 keeps the layout deterministic: page height 200, 16px
    // padding, 16px gaps → page 2 starts at offsetTop 232. The 20% viewport
    // marker sits at scrollTop + 120 (0.2 × 600).
    pdfjsMock.docs.set(
      "/scroll-report.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
        [100, 200],
      ])
    )
    const onVisiblePageChange = vi.fn()

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/scroll-report.pdf")}
          defaultScale={1}
          onVisiblePageChange={onVisiblePageChange}
        />
      )
    })
    await findByTextContent("Page 1 of 3")
    await waitFor(() =>
      expect(onVisiblePageChange).toHaveBeenLastCalledWith(1)
    )

    const flushFrames = useManualFrames()
    const viewport = getViewport()!
    // marker = 150 + 120 = 270 ≥ 232 → page 2.
    setScrollTop(viewport, 150)
    fireEvent.scroll(viewport)
    flushFrames()
    expect(onVisiblePageChange).toHaveBeenLastCalledWith(2)

    onVisiblePageChange.mockClear()
    // Still inside page 2 (marker 280 < page 3 at 448): no new report.
    setScrollTop(viewport, 160)
    fireEvent.scroll(viewport)
    flushFrames()
    expect(onVisiblePageChange).not.toHaveBeenCalled()
  })

  it("re-reports page 1 after scrolling away and back, and the controls tracks it", async () => {
    pdfjsMock.docs.set(
      "/scroll-back.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
        [100, 200],
      ])
    )
    const onVisiblePageChange = vi.fn()

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/scroll-back.pdf")}
          defaultScale={1}
          onVisiblePageChange={onVisiblePageChange}
        />
      )
    })
    await findByTextContent("Page 1 of 3")

    const flushFrames = useManualFrames()
    const viewport = getViewport()!

    setScrollTop(viewport, 150) // marker 270 → page 2
    fireEvent.scroll(viewport)
    flushFrames()
    expect(onVisiblePageChange).toHaveBeenLastCalledWith(2)
    await findByTextContent("Page 2 of 3")

    onVisiblePageChange.mockClear()
    setScrollTop(viewport, 0) // marker 120 → back to page 1
    fireEvent.scroll(viewport)
    flushFrames()
    expect(onVisiblePageChange).toHaveBeenLastCalledWith(1)
    await findByTextContent("Page 1 of 3")
  })

  it("reports exact scroll progress at the top, middle, and bottom", async () => {
    // Mocked scrollHeight 1800, clientHeight 600 → scrollable span 1200.
    pdfjsMock.docs.set(
      "/scroll-progress.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
        [100, 200],
        [100, 200],
      ])
    )
    const onScrollProgressChange = vi.fn()

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/scroll-progress.pdf")}
          defaultScale={1}
          onScrollProgressChange={onScrollProgressChange}
        />
      )
    })
    await findByTextContent("Page 1 of 4")

    const flushFrames = useManualFrames()
    const viewport = getViewport()!

    setScrollTop(viewport, 600) // 600 / 1200 = 0.5
    fireEvent.scroll(viewport)
    flushFrames()
    expect(onScrollProgressChange).toHaveBeenLastCalledWith(0.5)

    setScrollTop(viewport, 1500) // beyond the bottom → clamps to 1
    fireEvent.scroll(viewport)
    flushFrames()
    expect(onScrollProgressChange).toHaveBeenLastCalledWith(1)
  })
})
