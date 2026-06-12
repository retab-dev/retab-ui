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
import {
  getDocumentResource,
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

  it("clamps fit-width scale in the rendered toolbar", async () => {
    pdfjsMock.docs.set("/fit-clamp.pdf", makeDoc([[100, 200]]))

    await act(async () => {
      render(<PdfViewer source={pdfUrlSource("/fit-clamp.pdf")} />)
    })

    expect(await screen.findByText("500%")).toBeTruthy()
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

  it("does not keep rejected document loads cached for the same src", async () => {
    pdfjsMock.docs.set("/retry.pdf", new Error("load failed"))

    await expect(
      getDocumentResource(pdfUrlResource("/retry.pdf"))
    ).rejects.toThrow("load failed")

    const doc = makeDoc([[100, 200]])
    pdfjsMock.docs.set("/retry.pdf", doc)

    await expect(
      getDocumentResource(pdfUrlResource("/retry.pdf"))
    ).resolves.toBe(doc)
    expect(pdfjsMock.getDocument).toHaveBeenCalledTimes(2)
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
})
