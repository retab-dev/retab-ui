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
import { PdfThumbnailSidebar } from "@/registry/new-york-v4/ui/pdf-thumbnail-sidebar"
import {
  getDocumentResource,
  PdfHighlight,
  PdfViewer,
  type PdfViewerHandle,
} from "@/registry/new-york-v4/ui/pdf-viewer"
import { __resetPdfDocumentCacheForTests } from "@/registry/new-york-v4/ui/pdf-viewer-resource"

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
  pdfjsMock.getDocument.mockImplementation((src: string) => {
    if (pdfjsMock.docs.has(src)) {
      const value = pdfjsMock.docs.get(src)
      return {
        promise:
          value instanceof Error
            ? Promise.reject(value)
            : Promise.resolve(value),
      }
    }
    let pending = pdfjsMock.pending.get(src)
    if (!pending) {
      pending = pdfjsMock.deferred()
      pdfjsMock.pending.set(src, pending)
    }
    return { promise: pending.promise }
  })
  pdfjsMock.GlobalWorkerOptions.workerSrc = undefined
  __resetPdfDocumentCacheForTests()

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
  __resetPdfDocumentCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function pdfUrlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName }
}

function pdfUrlResource(url: string, fileName?: string) {
  return createViewerResource(pdfUrlSource(url, fileName))
}

describe("PdfViewer", () => {
  it("does not render toolbar chrome in the fallback when toolbar is false", async () => {
    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/pending.pdf")} toolbar={false} />
      )
      await Promise.resolve()
    })

    expect(screen.queryByLabelText("Zoom in")).toBeNull()
    expect(screen.queryByLabelText("Download")).toBeNull()
    expect(document.querySelector("[data-slot='pdf-viewer']")).toBeTruthy()

    pdfjsMock.pending.get("/pending.pdf")?.resolve(makeDoc([[100, 200]]))
    await act(async () => {
      await Promise.resolve()
    })
  })

  it("treats scale as controlled and reports toolbar scale requests", async () => {
    pdfjsMock.docs.set("/controlled.pdf", makeDoc([[100, 200]]))
    const onScaleChange = vi.fn()
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/controlled.pdf")}
          scale={2}
          onScaleChange={onScaleChange}
        />
      )
    })

    await findByTextContent("Page 1 of 1")
    expect(screen.getByText("200%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(onScaleChange).toHaveBeenCalledWith(2.4)
    expect(screen.getByText("200%")).toBeTruthy()

    view.rerender(
      <PdfViewer
        source={pdfUrlSource("/controlled.pdf")}
        scale={3}
        onScaleChange={onScaleChange}
      />
    )
    expect(await screen.findByText("300%")).toBeTruthy()
  })

  it("reports a controlled fit-width request as null", async () => {
    pdfjsMock.docs.set("/controlled-fit.pdf", makeDoc([[100, 200]]))
    const onScaleChange = vi.fn()

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/controlled-fit.pdf")}
          scale={2}
          onScaleChange={onScaleChange}
        />
      )
    })
    await findByTextContent("Page 1 of 1")

    fireEvent.click(screen.getByLabelText("Fit width"))

    expect(onScaleChange).toHaveBeenCalledWith(null)
    expect(screen.getByText("200%")).toBeTruthy()
  })

  it("clamps fit-width scale in the rendered toolbar", async () => {
    pdfjsMock.docs.set("/fit-clamp.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/fit-clamp.pdf")} />)
    })

    expect(await screen.findByText("500%")).toBeTruthy()
  })

  it("returns uncontrolled manual zoom back to fit width", async () => {
    pdfjsMock.docs.set("/uncontrolled-fit.pdf", makeDoc([[400, 800]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/uncontrolled-fit.pdf")}
          defaultScale={1}
        />
      )
    })
    await screen.findByText("100%")

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(await screen.findByText("120%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Fit width"))
    expect(await screen.findByText("200%")).toBeTruthy()
  })

  it("reports the initial visible page after mounting", async () => {
    pdfjsMock.docs.set(
      "/initial-page.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ])
    )
    const onVisiblePageChange = vi.fn()

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/initial-page.pdf")}
          onVisiblePageChange={onVisiblePageChange}
        />
      )
    })

    await waitFor(() => expect(onVisiblePageChange).toHaveBeenCalledWith(1))
  })

  it("renders a bounded initial page window without IntersectionObserver", async () => {
    vi.stubGlobal("IntersectionObserver", undefined)
    const doc = makeDoc(
      Array.from({ length: 100 }, () => [100, 200] as [number, number])
    )
    pdfjsMock.docs.set("/no-intersection-observer.pdf", doc)

    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/no-intersection-observer.pdf")} />
      )
    })

    await waitFor(() => {
      expect(doc.getPage).toHaveBeenCalledWith(1)
      expect(doc.getPage).toHaveBeenCalledWith(2)
    })
    expect(document.querySelectorAll("[data-page-number]").length).toBeLessThan(
      100
    )
    expect(document.querySelectorAll("canvas").length).toBeLessThan(100)
  })

  it("does not keep rejected document loads cached for the same source", async () => {
    pdfjsMock.docs.set("/retry.pdf", new Error("load failed"))

    await expect(
      getDocumentResource(pdfUrlResource("/retry.pdf"))
    ).rejects.toMatchObject({
      format: "pdf",
      kind: "parse_failed",
    })

    const doc = makeDoc([[100, 200]])
    pdfjsMock.docs.set("/retry.pdf", doc)

    await expect(
      getDocumentResource(pdfUrlResource("/retry.pdf"))
    ).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
  })

  it("does not reload a URL document when rerendered with an equivalent source object", async () => {
    pdfjsMock.docs.set("/stable-source.pdf", makeDoc([[100, 200]]))

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(<PdfViewer source={pdfUrlSource("/stable-source.pdf")} />)
    })
    await findByTextContent("Page 1 of 1")

    view.rerender(<PdfViewer source={pdfUrlSource("/stable-source.pdf")} />)

    expect(await findByTextContent("Page 1 of 1")).toBeTruthy()
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)
  })

  it("releases the previous document when switching sources", async () => {
    const firstDoc = makeDoc([[100, 200]])
    const secondDoc = makeDoc([[100, 200]])
    pdfjsMock.docs.set("/switch-first.pdf", firstDoc)
    pdfjsMock.docs.set("/switch-second.pdf", secondDoc)

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(<PdfViewer source={pdfUrlSource("/switch-first.pdf")} />)
    })
    await findByTextContent("Page 1 of 1")

    await act(async () => {
      view.rerender(<PdfViewer source={pdfUrlSource("/switch-second.pdf")} />)
    })
    await findByTextContent("Page 1 of 1")

    for (let index = 0; index < 6; index += 1) {
      const otherDoc = makeDoc([[100, 200]])
      pdfjsMock.docs.set(`/switch-other-${index}.pdf`, otherDoc)
      await getDocumentResource(pdfUrlResource(`/switch-other-${index}.pdf`))
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(firstDoc.destroy).toHaveBeenCalledTimes(1)
    expect(secondDoc.destroy).not.toHaveBeenCalled()
  })

  it("scrolls a normalized page target through the imperative handle", async () => {
    pdfjsMock.docs.set(
      "/scroll.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ])
    )

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null)
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageTarget(
                2,
                { top: 25 },
                { behavior: "auto" }
              )
            }
          >
            Jump
          </button>
          <PdfViewer ref={ref} source={pdfUrlSource("/scroll.pdf")} />
        </>
      )
    }

    await act(async () => {
      render(<Harness />)
    })
    await findByTextContent("Page 1 of 2")

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    const slot = document.querySelector<HTMLElement>("[data-page-number='2']")
    expect(viewport).toBeTruthy()
    expect(slot).toBeTruthy()

    const scrollTo = vi.fn()
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 100,
      writable: true,
    })
    viewport!.scrollTo = scrollTo
    viewport!.getBoundingClientRect = () =>
      ({ top: 10, height: 500 }) as DOMRect
    slot!.getBoundingClientRect = () => ({ top: 210, height: 1000 }) as DOMRect

    fireEvent.click(screen.getByRole("button", { name: "Jump" }))

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1234,
      behavior: "auto",
    })
  })

  it("clamps normalized target top before imperative scrolling", async () => {
    pdfjsMock.docs.set(
      "/scroll-clamp.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ])
    )

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null)
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageTarget(
                2,
                { top: 200 },
                { behavior: "auto" }
              )
            }
          >
            Jump past page
          </button>
          <PdfViewer ref={ref} source={pdfUrlSource("/scroll-clamp.pdf")} />
        </>
      )
    }

    await act(async () => {
      render(<Harness />)
    })
    await findByTextContent("Page 1 of 2")

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    const slot = document.querySelector<HTMLElement>("[data-page-number='2']")
    expect(viewport).toBeTruthy()
    expect(slot).toBeTruthy()

    const scrollTo = vi.fn()
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 100,
      writable: true,
    })
    viewport!.scrollTo = scrollTo
    viewport!.getBoundingClientRect = () =>
      ({ top: 10, height: 500 }) as DOMRect
    slot!.getBoundingClientRect = () => ({ top: 210, height: 1000 }) as DOMRect

    fireEvent.click(screen.getByRole("button", { name: "Jump past page" }))

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1984,
      behavior: "auto",
    })
  })

  it("clamps negative normalized target top before imperative scrolling", async () => {
    pdfjsMock.docs.set(
      "/scroll-negative-clamp.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ])
    )

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null)
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageTarget(
                2,
                { top: -25 },
                { behavior: "auto" }
              )
            }
          >
            Jump before page
          </button>
          <PdfViewer
            ref={ref}
            source={pdfUrlSource("/scroll-negative-clamp.pdf")}
          />
        </>
      )
    }

    await act(async () => {
      render(<Harness />)
    })
    await findByTextContent("Page 1 of 2")

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    const slot = document.querySelector<HTMLElement>("[data-page-number='2']")
    expect(viewport).toBeTruthy()
    expect(slot).toBeTruthy()

    const scrollTo = vi.fn()
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 100,
      writable: true,
    })
    viewport!.scrollTo = scrollTo
    viewport!.getBoundingClientRect = () =>
      ({ top: 10, height: 500 }) as DOMRect
    slot!.getBoundingClientRect = () => ({ top: 210, height: 1000 }) as DOMRect

    fireEvent.click(screen.getByRole("button", { name: "Jump before page" }))

    expect(scrollTo).toHaveBeenCalledWith({
      top: 984,
      behavior: "auto",
    })
  })

  it("ignores invalid imperative page scroll requests", async () => {
    pdfjsMock.docs.set("/invalid-scroll.pdf", makeDoc([[100, 200]]))

    function Harness() {
      const ref = React.useRef<PdfViewerHandle>(null)
      return (
        <>
          <button
            type="button"
            onClick={() =>
              ref.current?.scrollToPageTarget(
                2,
                { top: 25 },
                { behavior: "auto" }
              )
            }
          >
            Invalid jump
          </button>
          <PdfViewer ref={ref} source={pdfUrlSource("/invalid-scroll.pdf")} />
        </>
      )
    }

    await act(async () => {
      render(<Harness />)
    })
    await findByTextContent("Page 1 of 1")

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    expect(viewport).toBeTruthy()
    const scrollTo = vi.fn()
    viewport!.scrollTo = scrollTo

    fireEvent.click(screen.getByRole("button", { name: "Invalid jump" }))

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("reports zero scroll progress when content is not scrollable", async () => {
    pdfjsMock.docs.set("/no-scroll-progress.pdf", makeDoc([[100, 200]]))
    const onScrollProgressChange = vi.fn()

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/no-scroll-progress.pdf")}
          onScrollProgressChange={onScrollProgressChange}
        />
      )
    })
    await findByTextContent("Page 1 of 1")

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    expect(viewport).toBeTruthy()

    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 600,
    })
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 600,
    })
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 300,
      writable: true,
    })

    fireEvent.scroll(viewport!)

    expect(onScrollProgressChange).toHaveBeenLastCalledWith(0)
  })

  it.each([
    ["negative", -50, 0],
    ["overlarge", 2400, 1],
  ])(
    "clamps %s scroll progress to the valid range",
    async (_label, scrollTop, expectedProgress) => {
      pdfjsMock.docs.set("/progress-clamp.pdf", makeDoc([[100, 200]]))
      const onScrollProgressChange = vi.fn()

      await act(async () => {
        render(
          <PdfViewer
            source={pdfUrlSource("/progress-clamp.pdf")}
            onScrollProgressChange={onScrollProgressChange}
          />
        )
      })
      await findByTextContent("Page 1 of 1")

      const viewport = document.querySelector<HTMLElement>(
        "[data-slot='scroll-area-viewport']"
      )
      expect(viewport).toBeTruthy()

      Object.defineProperty(viewport, "clientHeight", {
        configurable: true,
        value: 600,
      })
      Object.defineProperty(viewport, "scrollHeight", {
        configurable: true,
        value: 1800,
      })
      Object.defineProperty(viewport, "scrollTop", {
        configurable: true,
        value: scrollTop,
        writable: true,
      })

      onScrollProgressChange.mockClear()
      fireEvent.scroll(viewport!)
      await waitFor(() =>
        expect(onScrollProgressChange).toHaveBeenLastCalledWith(
          expectedProgress
        )
      )
    }
  )

  it("selects the current page using the 20 percent viewport marker", async () => {
    pdfjsMock.docs.set(
      "/scroll-marker.pdf",
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
          source={pdfUrlSource("/scroll-marker.pdf")}
          onVisiblePageChange={onVisiblePageChange}
        />
      )
    })
    await findByTextContent("Page 1 of 3")

    const viewport = document.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']"
    )
    expect(viewport).toBeTruthy()

    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 950,
      writable: true,
    })
    viewport!.getBoundingClientRect = () => ({ top: 0, height: 500 }) as DOMRect

    fireEvent.scroll(viewport!)

    await waitFor(() => expect(onVisiblePageChange).toHaveBeenLastCalledWith(2))
    expect(await findByTextContent("Page 2 of 3")).toBeTruthy()
  })

  it("renders document slots and toggles both side rails together", async () => {
    pdfjsMock.docs.set("/slots.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/slots.pdf")}
          defaultRailsOpen={false}
          slots={{
            top: <div>Top slot</div>,
            bottom: <div>Bottom slot</div>,
            left: <aside>Left rail</aside>,
            right: <aside>Right rail</aside>,
            overlay: <button type="button">Overlay action</button>,
          }}
        />
      )
    })
    await findByTextContent("Page 1 of 1")

    expect(screen.getByText("Top slot")).toBeTruthy()
    expect(screen.getByText("Bottom slot")).toBeTruthy()
    expect(screen.getByText("Left rail")).toBeTruthy()
    expect(screen.getByText("Right rail")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Overlay action" })).toBeTruthy()

    const toggle = screen.getByLabelText("Show sidebar")
    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    expect(
      Array.from(
        document.querySelectorAll("[data-slot='pdf-viewer-rail']")
      ).map((rail) => rail.getAttribute("data-state"))
    ).toEqual(["closed", "closed"])

    fireEvent.click(toggle)

    expect(
      screen.getByLabelText("Hide sidebar").getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      Array.from(
        document.querySelectorAll("[data-slot='pdf-viewer-rail']")
      ).map((rail) => rail.getAttribute("data-state"))
    ).toEqual(["open", "open"])
  })

  it("does not render a rail toggle when railToggle is disabled", async () => {
    pdfjsMock.docs.set("/rail-toggle-disabled.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/rail-toggle-disabled.pdf")}
          railToggle={false}
          slots={{ left: <aside>Fixed rail</aside> }}
        />
      )
    })
    await findByTextContent("Page 1 of 1")

    expect(screen.queryByLabelText("Hide sidebar")).toBeNull()
    expect(screen.queryByLabelText("Show sidebar")).toBeNull()
    expect(
      document
        .querySelector("[data-slot='pdf-viewer-rail']")
        ?.getAttribute("data-state")
    ).toBe("open")
  })

  it("renders page overlays with current geometry and rotation", async () => {
    pdfjsMock.docs.set("/overlay.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/overlay.pdf")}
          defaultScale={1}
          renderPageOverlay={({
            pageNumber,
            width,
            height,
            scale,
            rotation,
          }) => (
            <>
              <div data-testid="overlay-props">
                {pageNumber}:{width}x{height}:{scale}:{rotation}
              </div>
              <PdfHighlight
                data-testid="highlight"
                area={{ left: 10, top: 20, width: 30, height: 40 }}
              />
            </>
          )}
        />
      )
    })

    await waitFor(() =>
      expect(screen.getByTestId("overlay-props").textContent).toBe(
        "1:100x200:1:0"
      )
    )
    expect(screen.getByTestId("highlight").getAttribute("style")).toContain(
      "left: 10%;"
    )

    fireEvent.click(screen.getByLabelText("Rotate"))

    await waitFor(() =>
      expect(screen.getByTestId("overlay-props").textContent).toBe(
        "1:200x100:1:90"
      )
    )
  })

  it("combines intrinsic page rotation with toolbar rotation while rendering", async () => {
    const page = makePage(100, 200, 90)
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    }
    pdfjsMock.docs.set("/rotated.pdf", doc)

    await act(async () => {
      render(
        <PdfViewer source={pdfUrlSource("/rotated.pdf")} defaultScale={1} />
      )
    })

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1))
    expect(page.render.mock.calls.at(-1)?.[0].viewport).toMatchObject({
      width: 200,
      height: 100,
    })

    fireEvent.click(screen.getByLabelText("Rotate"))

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(2))
    expect(page.render.mock.calls.at(-1)?.[0].viewport).toMatchObject({
      width: 100,
      height: 200,
    })
  })

  it("renders page canvases at device pixel ratio without changing css size", async () => {
    const page = makePage(100, 200)
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    }
    pdfjsMock.docs.set("/dpr.pdf", doc)

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    })

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/dpr.pdf")} defaultScale={1} />)
    })

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1))
    const renderCall = page.render.mock.calls[0]?.[0]
    const canvas = renderCall.canvas as HTMLCanvasElement

    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(400)
    expect(canvas.style.width).toBe("100px")
    expect(canvas.style.height).toBe("200px")
    expect(renderCall.transform).toEqual([2, 0, 0, 2, 0, 0])
  })

  it("cancels stale page render tasks when scale changes and when unmounted", async () => {
    pdfjsMock.docs.set("/cancel-render.pdf", makeDoc([[100, 200]]))

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <PdfViewer
          source={pdfUrlSource("/cancel-render.pdf")}
          defaultScale={1}
        />
      )
    })

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(1))
    const firstTask = pdfjsMock.renderTasks[0]

    fireEvent.click(screen.getByLabelText("Zoom in"))

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(2))
    expect(firstTask.cancel).toHaveBeenCalledTimes(1)

    const secondTask = pdfjsMock.renderTasks[1]
    view.unmount()

    expect(secondTask.cancel).toHaveBeenCalledTimes(1)
  })

  it("wires download metadata through the toolbar anchor", async () => {
    pdfjsMock.docs.set("/signed-pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(
        <PdfViewer
          source={{
            kind: "url",
            url: "/signed-pdf",
            fileName: "report.pdf",
            downloadUrl: "/download/report.pdf",
          }}
        />
      )
    })
    await findByTextContent("Page 1 of 1")

    const download = screen.getByLabelText("Download")
    expect(download.tagName).toBe("A")
    expect(download.getAttribute("href")).toBe("/download/report.pdf")
    expect(download.getAttribute("download")).toBe("report.pdf")
  })

  it("shares a document load between the viewer and matching thumbnail sidebar source", async () => {
    pdfjsMock.docs.set(
      "/shared-sidebar.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
      ])
    )

    await act(async () => {
      render(
        <PdfViewer
          source={pdfUrlSource("/shared-sidebar.pdf", "named-shared.pdf")}
          slots={{ left: <PdfThumbnailSidebar src="/shared-sidebar.pdf" /> }}
        />
      )
    })

    await findByTextContent("Page 1 of 2")
    await screen.findByText("2")
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(1)
  })

  it("keeps a mounted thumbnail sidebar document retained during cache pruning", async () => {
    const sidebarDoc = makeDoc([
      [100, 200],
      [100, 200],
    ])
    pdfjsMock.docs.set("/sidebar-retained.pdf", sidebarDoc)

    await act(async () => {
      render(<PdfThumbnailSidebar src="/sidebar-retained.pdf" />)
    })
    await screen.findByText("1")

    const otherDocs: ReturnType<typeof makeDoc>[] = []
    for (let index = 0; index < 7; index += 1) {
      const otherDoc = makeDoc([[100, 200]])
      otherDocs.push(otherDoc)
      pdfjsMock.docs.set(`/sidebar-other-${index}.pdf`, otherDoc)
      await getDocumentResource(pdfUrlResource(`/sidebar-other-${index}.pdf`))
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(otherDocs.some((doc) => doc.destroy.mock.calls.length > 0)).toBe(
      true
    )
    expect(sidebarDoc.destroy).not.toHaveBeenCalled()
  })

  it("releases the previous thumbnail sidebar document when switching sources", async () => {
    const firstDoc = makeDoc([[100, 200]])
    const secondDoc = makeDoc([[100, 200]])
    pdfjsMock.docs.set("/sidebar-switch-first.pdf", firstDoc)
    pdfjsMock.docs.set("/sidebar-switch-second.pdf", secondDoc)

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(<PdfThumbnailSidebar src="/sidebar-switch-first.pdf" />)
    })
    await screen.findByText("1")

    await act(async () => {
      view.rerender(<PdfThumbnailSidebar src="/sidebar-switch-second.pdf" />)
    })
    await screen.findByText("1")

    for (let index = 0; index < 6; index += 1) {
      const otherDoc = makeDoc([[100, 200]])
      pdfjsMock.docs.set(`/sidebar-switch-other-${index}.pdf`, otherDoc)
      await getDocumentResource(
        pdfUrlResource(`/sidebar-switch-other-${index}.pdf`)
      )
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(firstDoc.destroy).toHaveBeenCalledTimes(1)
    expect(secondDoc.destroy).not.toHaveBeenCalled()
  })

  it("marks the active thumbnail and reports selected page clicks", async () => {
    const onSelectPage = vi.fn()
    pdfjsMock.docs.set(
      "/thumbnail-select.pdf",
      makeDoc([
        [100, 200],
        [100, 200],
        [100, 200],
      ])
    )

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <PdfThumbnailSidebar
          src="/thumbnail-select.pdf"
          currentPage={2}
          onSelectPage={onSelectPage}
        />
      )
    })
    await screen.findByText("3")

    expect(screen.getByRole("button", { current: "page" }).textContent).toBe(
      "2"
    )

    fireEvent.click(screen.getByText("3").closest("button")!)
    expect(onSelectPage).toHaveBeenCalledWith(3)

    view.rerender(
      <PdfThumbnailSidebar
        src="/thumbnail-select.pdf"
        currentPage={3}
        onSelectPage={onSelectPage}
      />
    )

    expect(screen.getByRole("button", { current: "page" }).textContent).toBe(
      "3"
    )
  })

  it("cancels thumbnail render tasks when thumbnails unmount", async () => {
    pdfjsMock.docs.set("/thumbnail-cancel.pdf", makeDoc([[100, 200]]))

    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(<PdfThumbnailSidebar src="/thumbnail-cancel.pdf" />)
    })

    await waitFor(() => expect(pdfjsMock.renderTasks).toHaveLength(1))
    const task = pdfjsMock.renderTasks[0]

    view.unmount()

    expect(task.cancel).toHaveBeenCalledTimes(1)
  })

  it("renders thumbnails immediately when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined)
    const doc = makeDoc([[100, 200]])
    pdfjsMock.docs.set("/thumbnail-no-observer.pdf", doc)

    await act(async () => {
      render(
        <PdfThumbnailSidebar src="/thumbnail-no-observer.pdf" width={50} />
      )
    })

    await waitFor(() => expect(doc.getPage).toHaveBeenCalledWith(1))
    const canvas = document.querySelector<HTMLCanvasElement>("canvas")
    expect(canvas).toBeTruthy()
    expect(canvas?.style.width).toBe("50px")
    expect(canvas?.style.height).toBe("100px")
  })

  it("sizes thumbnails from intrinsically rotated page viewports", async () => {
    const page = makePage(100, 200, 90)
    const doc = {
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve(page)),
      destroy: vi.fn(() => Promise.resolve()),
    }
    pdfjsMock.docs.set("/thumbnail-rotated.pdf", doc)

    await act(async () => {
      render(<PdfThumbnailSidebar src="/thumbnail-rotated.pdf" width={50} />)
    })

    await waitFor(() => expect(page.render).toHaveBeenCalledTimes(1))
    const canvas = document.querySelector<HTMLCanvasElement>("canvas")
    expect(canvas?.style.width).toBe("50px")
    expect(canvas?.style.height).toBe("25px")
  })
})
