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

import { PptxViewer } from "@/registry/new-york-v4/ui/pptx-viewer"
import {
  getPptxFitScale,
  getPptxResetKey,
  type PptxSlideOverlayProps,
} from "@/registry/new-york-v4/ui/pptx-viewer-core"
import { parsePptxSlideSize } from "@/registry/new-york-v4/ui/pptx-viewer-presentation"
import { getPptxSource } from "@/registry/new-york-v4/ui/pptx-viewer-source"
import { resetPptxViewerForTests } from "@/registry/new-york-v4/ui/pptx-viewer-test-utils"

const pptxMock = vi.hoisted(() => ({
  destroy: vi.fn(),
  getSlideCount: vi.fn(() => 1),
  loadFile: vi.fn(async () => undefined),
  renderSlide: vi.fn(async () => undefined),
  viewerOptions: [] as Array<Record<string, unknown>>,
}))

const zipMock = vi.hoisted(() => ({
  xml: '<p:presentation><p:sldSz cx="9144000" cy="6858000"/></p:presentation>',
  loadAsync: vi.fn(async () => ({
    file: vi.fn(() => ({
      async: vi.fn(async () => zipMock.xml),
    })),
  })),
}))

vi.mock("pptxviewjs", () => ({
  PPTXViewer: class {
    constructor(options: Record<string, unknown>) {
      pptxMock.viewerOptions.push(options)
    }
    destroy = pptxMock.destroy
    getSlideCount = pptxMock.getSlideCount
    loadFile = pptxMock.loadFile
    renderSlide = pptxMock.renderSlide
  },
}))

vi.mock("jszip", () => ({
  default: {
    loadAsync: zipMock.loadAsync,
  },
}))

const bitmapMocks: Array<{ close: ReturnType<typeof vi.fn> }> = []
const originalGetAnimations = HTMLElement.prototype.getAnimations

class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
}

class MockIntersectionObserver {
  private callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }

  disconnect() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

function okPptxResponse() {
  return Promise.resolve(new Response(new Uint8Array([1, 2, 3]).buffer))
}

async function renderPptx(ui: React.ReactElement) {
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(ui)
  })
  return view
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

beforeEach(() => {
  pptxMock.destroy.mockClear()
  pptxMock.getSlideCount.mockReset()
  pptxMock.getSlideCount.mockReturnValue(1)
  pptxMock.loadFile.mockReset()
  pptxMock.loadFile.mockResolvedValue(undefined)
  pptxMock.renderSlide.mockReset()
  pptxMock.renderSlide.mockResolvedValue(undefined)
  pptxMock.viewerOptions.length = 0
  zipMock.xml =
    '<p:presentation><p:sldSz cx="9144000" cy="6858000"/></p:presentation>'
  zipMock.loadAsync.mockClear()
  bitmapMocks.length = 0

  vi.stubGlobal("ResizeObserver", MockResizeObserver)
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: vi.fn(() => []),
  })
  vi.stubGlobal("fetch", vi.fn(okPptxResponse))
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      const bitmap = {
        close: vi.fn(),
        height: 720,
        width: 960,
      }
      bitmapMocks.push(bitmap)
      return bitmap
    })
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  cleanup()
  resetPptxViewerForTests()
  if (originalGetAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: originalGetAnimations,
    })
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations")
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("PptxViewer helpers", () => {
  it("parses slide size from presentation.xml and falls back to 4:3", () => {
    expect(
      parsePptxSlideSize(
        '<p:presentation><p:sldSz cx="9144000" cy="6858000"/></p:presentation>'
      )
    ).toEqual({ width: 960, height: 720 })

    expect(parsePptxSlideSize("<p:presentation />")).toEqual({
      width: 960,
      height: 720,
    })
  })

  it("parses slide size across namespace prefixes and attribute order", () => {
    expect(
      parsePptxSlideSize(
        '<deck:presentation xmlns:deck="presentation"><deck:sldSz cy="5143500" cx="12192000"/></deck:presentation>'
      )
    ).toEqual({ width: 1280, height: 540 })
  })

  it("accepts an injected XML parser for slide size parsing", () => {
    const parseXml = vi.fn(() =>
      new DOMParser().parseFromString(
        '<deck:presentation xmlns:deck="presentation"><deck:sldSz cx="6096000" cy="3429000"/></deck:presentation>',
        "application/xml"
      )
    )

    expect(parsePptxSlideSize("<ignored />", parseXml)).toEqual({
      width: 640,
      height: 360,
    })
    expect(parseXml).toHaveBeenCalledWith("<ignored />")
  })

  it("clamps fit-width scale for narrow containers", () => {
    expect(getPptxFitScale(16, 960)).toBe(0.1)
    expect(getPptxFitScale(1952, 960)).toBe(2)
    expect(getPptxFitScale(null, 960)).toBe(1)
  })

  it("builds reset keys from render-affecting inputs", () => {
    expect(getPptxResetKey({ src: "/a.pptx" })).not.toBe(
      getPptxResetKey({ src: "/a.pptx", scale: 2 })
    )
    expect(getPptxResetKey({ src: "/a.pptx" })).not.toBe(
      getPptxResetKey({ src: "/a.pptx", defaultScale: 2 })
    )
    expect(getPptxResetKey({ src: "/a.pptx" })).not.toBe(
      getPptxResetKey({ src: "/a.pptx", eager: true })
    )
  })
})

describe("PptxViewer", () => {
  it("loads the deck lazily and disables pptxviewjs delayed chart rerenders", async () => {
    pptxMock.getSlideCount.mockReturnValue(2)

    await renderPptx(<PptxViewer src="/deck.pptx" />)

    expect(await screen.findByText("Slide 1 of 2")).toBeTruthy()
    expect(pptxMock.viewerOptions[0]).toMatchObject({
      autoChartRerenderDelayMs: 0,
      slideSizeMode: "actual",
    })
  })

  it("reacts to controlled scale prop changes", async () => {
    const view = await renderPptx(<PptxViewer src="/deck.pptx" scale={1} />)

    expect(await screen.findByText("100%")).toBeTruthy()

    await act(async () => {
      view.rerender(<PptxViewer src="/deck.pptx" scale={2} />)
    })

    expect(await screen.findByText("200%")).toBeTruthy()
  })

  it("uses an uncontrolled default scale before user zoom changes", async () => {
    await renderPptx(<PptxViewer src="/deck.pptx" defaultScale={1.5} />)

    expect(await screen.findByText("150%")).toBeTruthy()
  })

  it("ignores default scale changes after the uncontrolled initial mount", async () => {
    const view = await renderPptx(
      <PptxViewer src="/deck.pptx" defaultScale={1.5} />
    )

    expect(await screen.findByText("150%")).toBeTruthy()

    await act(async () => {
      view.rerender(<PptxViewer src="/deck.pptx" defaultScale={2} />)
    })

    expect(screen.getByText("150%")).toBeTruthy()
  })

  it("disables zoom controls for controlled scale without a change handler", async () => {
    await renderPptx(<PptxViewer src="/deck.pptx" scale={1} />)

    await screen.findByText("100%")

    expect(screen.getByLabelText("Zoom out")).toHaveProperty("disabled", true)
    expect(screen.getByLabelText("Zoom in")).toHaveProperty("disabled", true)
    expect(screen.getByLabelText("Fit width")).toHaveProperty("disabled", true)
  })

  it("reports controlled zoom and fit-width changes", async () => {
    const onScaleChange = vi.fn()

    await renderPptx(
      <PptxViewer src="/deck.pptx" scale={1} onScaleChange={onScaleChange} />
    )

    await screen.findByText("100%")
    fireEvent.click(screen.getByLabelText("Zoom in"))
    fireEvent.click(screen.getByLabelText("Fit width"))

    expect(onScaleChange).toHaveBeenCalledWith(1.2)
    expect(onScaleChange).toHaveBeenCalledWith(null)
  })

  it("passes slide overlay geometry with slide-native naming", async () => {
    const renderSlideOverlay = vi.fn((_props: PptxSlideOverlayProps) => (
      <div data-testid="pptx-slide-overlay-marker" />
    ))

    await renderPptx(
      <PptxViewer
        src="/deck.pptx"
        scale={1}
        renderSlideOverlay={renderSlideOverlay}
      />
    )

    expect(await screen.findByTestId("pptx-slide-overlay-marker")).toBeTruthy()
    expect(renderSlideOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 720,
        rotation: 0,
        scale: 1,
        slideNumber: 1,
        width: 960,
      })
    )
    expect(Object.keys(renderSlideOverlay.mock.calls[0]?.[0] ?? {})).toEqual([
      "slideNumber",
      "width",
      "height",
      "scale",
      "rotation",
    ])
  })

  it("reports visible slides through the slide-native callback", async () => {
    const onVisibleSlideChange = vi.fn()

    await renderPptx(
      <PptxViewer
        src="/deck.pptx"
        onVisibleSlideChange={onVisibleSlideChange}
      />
    )

    await screen.findByText("Slide 1 of 1")
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()

    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(onVisibleSlideChange).toHaveBeenCalledWith(1)
    })
  })

  it("passes rotated visible slide size to the public overlay prop", async () => {
    const renderSlideOverlay = vi.fn(() => null)

    await renderPptx(
      <PptxViewer
        src="/deck.pptx"
        scale={1}
        renderSlideOverlay={renderSlideOverlay}
      />
    )

    await screen.findByText("100%")
    fireEvent.click(screen.getByLabelText("Rotate"))

    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 960,
          rotation: 90,
          width: 720,
        })
      )
    })
  })

  it("shows a per-slide error when one slide render fails", async () => {
    pptxMock.renderSlide.mockRejectedValueOnce(new Error("render failed"))

    await renderPptx(<PptxViewer src="/broken-slide.pptx" />)

    expect(await screen.findByText("Couldn't render slide 1.")).toBeTruthy()
    expect(screen.getByText("Slide 1 of 1")).toBeTruthy()
  })

  it("evicts old deck sources and closes their cached bitmaps", async () => {
    for (let i = 0; i < 5; i += 1) {
      const view = await renderPptx(<PptxViewer src={`/deck-${i}.pptx`} />)
      await screen.findByText("Slide 1 of 1")
      await waitFor(() => {
        expect(bitmapMocks.length).toBeGreaterThan(i)
      })
      view.unmount()
    }

    await waitFor(() => {
      expect(bitmapMocks[0]?.close).toHaveBeenCalled()
    })
    expect(pptxMock.destroy).toHaveBeenCalled()
  })

  it("keeps retained deck sources alive until release after cache eviction", async () => {
    const source = await getPptxSource("/retained.pptx")
    const release = source.retain()

    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(`/evict-${i}.pptx`)
    }

    expect(pptxMock.destroy).not.toHaveBeenCalled()

    release()

    await waitFor(() => {
      expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
    })
  })

  it("cancels queued renders before they touch a stale canvas", async () => {
    const firstRender = deferred<undefined>()
    pptxMock.renderSlide.mockImplementationOnce(() => firstRender.promise)

    const source = await getPptxSource("/queued-cancel.pptx")
    const first = source.renderSlide({
      canvas: document.createElement("canvas"),
      isLive: () => true,
      renderScale: 1,
      slideIndex: 0,
    })
    const second = source.renderSlide({
      canvas: document.createElement("canvas"),
      isLive: () => false,
      renderScale: 1,
      slideIndex: 0,
    })

    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })

    firstRender.resolve(undefined)

    await expect(first).resolves.toEqual({ status: "rendered" })
    await expect(second).resolves.toEqual({ status: "cancelled" })
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
  })
})
