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

import { ViewerFormatError } from "@/registry/new-york-v4/lib/viewer-errors"
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import { PptxViewer } from "@/registry/new-york-v4/ui/pptx-viewer"
import {
  getPptxBitmapCacheKey,
  getPptxFitScale,
  getPptxResetKey,
  type PptxSlideOverlayProps,
} from "@/registry/new-york-v4/ui/pptx-viewer-core"
import { parsePptxSlideSize } from "@/registry/new-york-v4/ui/pptx-viewer-presentation"
import { createPptxScrollActivity } from "@/registry/new-york-v4/ui/pptx-viewer-scroll"
import { PptxSlideScroller } from "@/registry/new-york-v4/ui/pptx-viewer-slide"
import {
  getPptxSource,
  type PptxRenderResult,
} from "@/registry/new-york-v4/ui/pptx-viewer-source"
import { resetPptxViewerForTests } from "@/registry/new-york-v4/ui/pptx-viewer-test-utils"
import { ViewerErrorBoundary } from "@/registry/new-york-v4/ui/viewer-error"

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
let drawImageMock: ReturnType<typeof vi.fn>
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

function pptxUrlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName }
}

function pptxUrlResource(url: string, fileName?: string) {
  return createViewerResource(pptxUrlSource(url, fileName))
}

function mockObjectUrls(url = "blob:pptx-download") {
  const createObjectURL = vi.fn(() => url)
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  })
  return { createObjectURL, revokeObjectURL }
}

function setElementNumberProperty(
  element: Element,
  key: "clientHeight" | "scrollHeight" | "scrollTop",
  value: number
) {
  Object.defineProperty(element, key, {
    configurable: true,
    value,
  })
}

function setElementRect(
  element: Element,
  rect: Partial<Pick<DOMRect, "top" | "height">>
) {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: (rect.top ?? 0) + (rect.height ?? 0),
        height: rect.height ?? 0,
        left: 0,
        right: 0,
        toJSON: () => ({}),
        top: rect.top ?? 0,
        width: 0,
        x: 0,
        y: rect.top ?? 0,
      }) as DOMRect
  )
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

function createFakePptxSource({
  hasBitmap = false,
  slideCount = 1,
}: {
  hasBitmap?: boolean
  slideCount?: number
} = {}) {
  return {
    baseSize: { height: 720, width: 960 },
    dispose: vi.fn(),
    hasBitmap: vi.fn(() => hasBitmap),
    renderSlide: vi.fn(
      async (): Promise<PptxRenderResult> => ({ status: "rendered" })
    ),
    retain: vi.fn(() => vi.fn()),
    slideCount,
  }
}

function createManualPptxActivity(isScrolling = true) {
  const waiters = new Set<() => void>()
  return {
    activity: {
      handleScroll: vi.fn(),
      isScrolling: vi.fn(() => isScrolling),
      onIdle: vi.fn((callback: () => void) => {
        waiters.add(callback)
        return () => waiters.delete(callback)
      }),
    },
    runIdle() {
      for (const callback of [...waiters]) callback()
    },
  }
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
  mockObjectUrls()
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
  drawImageMock = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: drawImageMock,
  } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  cleanup()
  resetPptxViewerForTests()
  clearViewerResourceRegistryForTests()
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

  it("falls back to 4:3 for invalid slide size XML", () => {
    expect(parsePptxSlideSize("<p:presentation")).toEqual({
      width: 960,
      height: 720,
    })
    expect(
      parsePptxSlideSize(
        '<p:presentation><p:sldSz cx="-1" cy="6858000"/></p:presentation>'
      )
    ).toEqual({
      width: 960,
      height: 720,
    })
    expect(
      parsePptxSlideSize(
        '<p:presentation><p:sldSz cx="nan" cy="6858000"/></p:presentation>'
      )
    ).toEqual({
      width: 960,
      height: 720,
    })
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
    expect(getPptxFitScale(10000, 960)).toBe(5)
    expect(getPptxFitScale(null, 960)).toBe(1)
    expect(getPptxFitScale(Number.NaN, 960)).toBe(1)
    expect(getPptxFitScale(800, 0)).toBe(1)
  })

  it("rounds bitmap cache keys to stable thousandths", () => {
    expect(getPptxBitmapCacheKey({ slideIndex: 2, renderScale: 1.2344 })).toBe(
      "2@1234"
    )
    expect(getPptxBitmapCacheKey({ slideIndex: 2, renderScale: 1.2345 })).toBe(
      "2@1235"
    )
  })

  it("builds reset keys from render-affecting inputs", () => {
    expect(getPptxResetKey({ cacheKey: "url:/a.pptx" })).not.toBe(
      getPptxResetKey({ cacheKey: "url:/a.pptx", scale: 2 })
    )
    expect(getPptxResetKey({ cacheKey: "url:/a.pptx" })).not.toBe(
      getPptxResetKey({ cacheKey: "url:/a.pptx", defaultScale: 2 })
    )
    expect(getPptxResetKey({ cacheKey: "url:/a.pptx" })).not.toBe(
      getPptxResetKey({ cacheKey: "url:/a.pptx", eager: true })
    )
  })

  it("does not reuse a loaded presentation when a new Blob reuses the same identity", async () => {
    const first = createViewerResource(
      blobSource(new Uint8Array([1, 2, 3]), {
        fileName: "same.pptx",
        identityKey: "blob:reused-pptx",
      })
    )
    const second = createViewerResource(
      blobSource(new Uint8Array([4, 5, 6]), {
        fileName: "same.pptx",
        identityKey: "blob:reused-pptx",
      })
    )

    await expect(getPptxSource(first)).resolves.toMatchObject({ slideCount: 1 })
    await expect(getPptxSource(second)).resolves.toMatchObject({
      slideCount: 1,
    })

    expect(second).not.toBe(first)
    expect(second.cacheKey).not.toBe(first.cacheKey)
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(2)
  })

  it("models presentation parse failures as format errors", async () => {
    pptxMock.loadFile.mockRejectedValueOnce(new Error("bad pptx"))

    const error = await getPptxSource(pptxUrlResource("/bad.pptx")).catch(
      (caught) => caught
    )

    expect(error).toBeInstanceOf(ViewerFormatError)
    expect(error).toMatchObject({
      format: "pptx",
      kind: "load_failed",
    })
    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
  })

  it("rejects loaded presentations with no usable slides", async () => {
    const resource = pptxUrlResource("/empty.pptx")
    pptxMock.getSlideCount.mockReturnValueOnce(0)

    const error = await getPptxSource(resource).catch((caught) => caught)

    expect(error).toBeInstanceOf(ViewerFormatError)
    expect(error).toMatchObject({
      format: "pptx",
      kind: "load_failed",
      message: "Presentation does not contain any slides.",
    })
    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)

    await expect(getPptxSource(resource)).resolves.toMatchObject({
      slideCount: 1,
    })
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(2)
  })

  it("falls back to the default slide size when the PPTX archive cannot be inspected", async () => {
    zipMock.loadAsync.mockRejectedValueOnce(new Error("zip failed"))

    await expect(
      getPptxSource(pptxUrlResource("/unknown-size.pptx"))
    ).resolves.toMatchObject({
      baseSize: { width: 960, height: 720 },
      slideCount: 1,
    })
  })

  it("removes failed source cache entries so a later retry can load the same URL", async () => {
    const resource = pptxUrlResource("/retry-after-failure.pptx")
    pptxMock.loadFile.mockRejectedValueOnce(new Error("first load failed"))

    await expect(getPptxSource(resource)).rejects.toMatchObject({
      kind: "load_failed",
    })
    await expect(getPptxSource(resource)).resolves.toMatchObject({
      slideCount: 1,
    })

    expect(pptxMock.loadFile).toHaveBeenCalledTimes(2)
  })

  it("removes HTTP error source cache entries so the same URL can retry", async () => {
    const resource = pptxUrlResource("/retry-after-http-error.pptx")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockImplementation(okPptxResponse)
    vi.stubGlobal("fetch", fetchMock)

    await expect(getPptxSource(resource)).rejects.toMatchObject({
      domain: "resource",
      kind: "http_error",
      status: 500,
    })
    await expect(getPptxSource(resource)).resolves.toMatchObject({
      slideCount: 1,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)
  })

  it("serializes render calls and forwards render options to pptxviewjs", async () => {
    const source = await getPptxSource(pptxUrlResource("/render-options.pptx"))
    const firstRender = deferred<undefined>()
    pptxMock.renderSlide.mockImplementationOnce(() => firstRender.promise)

    const first = source.renderSlide({
      canvas: document.createElement("canvas"),
      renderScale: 2,
      slideIndex: 0,
    })
    const second = source.renderSlide({
      canvas: document.createElement("canvas"),
      renderScale: 3,
      slideIndex: 1,
    })

    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })
    expect(pptxMock.renderSlide).toHaveBeenLastCalledWith(
      0,
      expect.any(HTMLCanvasElement),
      { quality: "high", scale: 2 }
    )

    firstRender.resolve(undefined)
    await expect(first).resolves.toEqual({ status: "rendered" })
    await expect(second).resolves.toEqual({ status: "rendered" })

    expect(pptxMock.renderSlide).toHaveBeenNthCalledWith(
      2,
      1,
      expect.any(HTMLCanvasElement),
      { quality: "high", scale: 3 }
    )
  })

  it("draws cached bitmaps without invoking pptxviewjs again", async () => {
    const source = await getPptxSource(pptxUrlResource("/cached-bitmap.pptx"))
    const firstCanvas = document.createElement("canvas")
    const secondCanvas = document.createElement("canvas")

    await expect(
      source.renderSlide({
        canvas: firstCanvas,
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })
    await expect(
      source.renderSlide({
        canvas: secondCanvas,
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })

    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    expect(drawImageMock).toHaveBeenCalledWith(bitmapMocks[0], 0, 0)
    expect(secondCanvas.width).toBe(960)
    expect(secondCanvas.height).toBe(720)
  })

  it("does not cache bitmap snapshots after the source is disposed mid-render", async () => {
    const firstRender = deferred<undefined>()
    pptxMock.renderSlide.mockImplementationOnce(() => firstRender.promise)

    const source = await getPptxSource(
      pptxUrlResource("/disposed-mid-render.pptx")
    )
    const render = source.renderSlide({
      canvas: document.createElement("canvas"),
      renderScale: 1,
      slideIndex: 0,
    })

    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })

    source.dispose()
    firstRender.resolve(undefined)

    await expect(render).resolves.toEqual({ status: "cancelled" })
    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(false)
    expect(createImageBitmap).not.toHaveBeenCalled()
    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
  })

  it("closes bitmap snapshots that finish after the source is disposed", async () => {
    const bitmapReady = deferred<{
      close: ReturnType<typeof vi.fn>
      height: number
      width: number
    }>()
    const bitmap = { close: vi.fn(), height: 720, width: 960 }

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => bitmapReady.promise)
    )

    const source = await getPptxSource(
      pptxUrlResource("/disposed-mid-snapshot.pptx")
    )
    const render = source.renderSlide({
      canvas: document.createElement("canvas"),
      renderScale: 1,
      slideIndex: 0,
    })

    await waitFor(() => {
      expect(createImageBitmap).toHaveBeenCalled()
    })

    source.dispose()
    bitmapReady.resolve(bitmap)

    await expect(render).resolves.toEqual({ status: "cancelled" })
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(false)
  })

  it("closes a bitmap snapshot when a render is cancelled after pptxviewjs completes", async () => {
    const bitmapReady = deferred<{
      close: ReturnType<typeof vi.fn>
      height: number
      width: number
    }>()
    const bitmap = { close: vi.fn(), height: 720, width: 960 }
    let isLive = true

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => bitmapReady.promise)
    )

    const source = await getPptxSource(
      pptxUrlResource("/cancel-after-snapshot.pptx")
    )
    const render = source.renderSlide({
      canvas: document.createElement("canvas"),
      isLive: () => isLive,
      renderScale: 1,
      slideIndex: 0,
    })

    await waitFor(() => {
      expect(createImageBitmap).toHaveBeenCalled()
    })

    isLive = false
    bitmapReady.resolve(bitmap)

    await expect(render).resolves.toEqual({ status: "cancelled" })
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(false)
  })

  it("evicts the oldest cached slide bitmaps after the per-source limit", async () => {
    const source = await getPptxSource(pptxUrlResource("/bitmap-lru.pptx"))

    for (let slideIndex = 0; slideIndex < 9; slideIndex += 1) {
      await expect(
        source.renderSlide({
          canvas: document.createElement("canvas"),
          renderScale: 1,
          slideIndex,
        })
      ).resolves.toEqual({ status: "rendered" })
    }

    expect(bitmapMocks[0]?.close).toHaveBeenCalledTimes(1)
    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(false)
    expect(source.hasBitmap({ renderScale: 1, slideIndex: 1 })).toBe(true)
  })

  it("can retry a slide render after a renderer failure", async () => {
    const source = await getPptxSource(
      pptxUrlResource("/retry-slide-render.pptx")
    )
    pptxMock.renderSlide.mockRejectedValueOnce(new Error("first render failed"))

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toMatchObject({
      error: expect.objectContaining({ kind: "render_failed" }),
      status: "failed",
    })

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(2)
  })

  it("notifies scroll idle listeners once and supports cancellation", () => {
    vi.useFakeTimers()
    const activity = createPptxScrollActivity(50)
    const first = vi.fn()
    const cancelled = vi.fn()

    const off = activity.onIdle(cancelled)
    activity.onIdle(first)
    activity.handleScroll()
    activity.handleScroll()
    off()

    expect(activity.isScrolling()).toBe(true)
    vi.advanceTimersByTime(49)
    expect(first).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(activity.isScrolling()).toBe(false)
    expect(first).toHaveBeenCalledTimes(1)
    expect(cancelled).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe("PptxViewer", () => {
  it("loads the deck lazily and disables pptxviewjs delayed chart rerenders", async () => {
    pptxMock.getSlideCount.mockReturnValue(2)

    await renderPptx(<PptxViewer source={pptxUrlSource("/deck.pptx")} />)

    expect(await screen.findByText("Slide 1 of 2")).toBeTruthy()
    expect(pptxMock.viewerOptions[0]).toMatchObject({
      autoChartRerenderDelayMs: 0,
      slideSizeMode: "actual",
    })
  })

  it("renders one frame per slide and asks pptxviewjs for zero-based slide indexes", async () => {
    pptxMock.getSlideCount.mockReturnValue(3)

    await renderPptx(<PptxViewer source={pptxUrlSource("/three.pptx")} />)

    expect(await screen.findByText("Slide 1 of 3")).toBeTruthy()
    expect(document.querySelectorAll('[data-slot="pptx-slide"]')).toHaveLength(
      3
    )
    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(3)
    })
    const renderedSlideIndexes = (
      pptxMock.renderSlide.mock.calls as unknown as Array<[number]>
    ).map(([slideIndex]) => slideIndex)
    expect(renderedSlideIndexes).toEqual([0, 1, 2])
  })

  it("shares one loaded source across viewers with the same source identity", async () => {
    const fetchMock = vi.fn(okPptxResponse)
    vi.stubGlobal("fetch", fetchMock)

    await renderPptx(
      <div>
        <PptxViewer source={pptxUrlSource("/shared-deck.pptx")} />
        <PptxViewer source={pptxUrlSource("/shared-deck.pptx")} />
      </div>
    )

    expect(await screen.findAllByText("Slide 1 of 1")).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)
    expect(pptxMock.viewerOptions).toHaveLength(1)
  })

  it("shares loaded sources while keeping URL download metadata per viewer", async () => {
    const fetchMock = vi.fn(okPptxResponse)
    vi.stubGlobal("fetch", fetchMock)

    await renderPptx(
      <div>
        <PptxViewer
          source={{
            kind: "url",
            downloadUrl: "/download/a.pptx",
            fileName: "a.pptx",
            url: "/same-content.pptx",
          }}
        />
        <PptxViewer
          source={{
            kind: "url",
            downloadUrl: "/download/b.pptx",
            fileName: "b.pptx",
            url: "/same-content.pptx",
          }}
        />
      </div>
    )

    expect(await screen.findAllByText("Slide 1 of 1")).toHaveLength(2)

    const links = await screen.findAllByRole("link", { name: "Download" })
    expect(
      links.map((link) => ({
        download: link.getAttribute("download"),
        href: link.getAttribute("href"),
      }))
    ).toEqual([
      { download: "a.pptx", href: "/download/a.pptx" },
      { download: "b.pptx", href: "/download/b.pptx" },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)
  })

  it("loads a canonical Blob source without fetching", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls(
      "blob:local-pptx-download"
    )
    const fetchMock = vi.fn(okPptxResponse)
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    vi.stubGlobal("fetch", fetchMock)

    await renderPptx(
      <PptxViewer
        source={blobSource(new Uint8Array([1, 2, 3]), {
          fileName: "local.pptx",
          identityKey: "blob:local-pptx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        })}
      />
    )

    expect(await screen.findByText("Slide 1 of 1")).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)
    expect(createObjectURL).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Download" }))
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    })
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-pptx-download")
  })

  it("revokes Blob download URLs after triggering download", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls(
      "blob:temporary-pptx"
    )
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    )

    await renderPptx(
      <PptxViewer
        source={blobSource(new Uint8Array([1, 2, 3]), {
          fileName: "temporary.pptx",
          identityKey: "blob:temporary-pptx",
        })}
      />
    )

    fireEvent.click(await screen.findByRole("button", { name: "Download" }))
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:temporary-pptx")
    })
  })

  it("uses URL download metadata without creating an object URL", async () => {
    const { createObjectURL } = mockObjectUrls()

    await renderPptx(
      <PptxViewer
        source={{
          kind: "url",
          downloadUrl: "/download/deck-export.pptx",
          fileName: "deck.pptx",
          url: "/api/deck",
        }}
      />
    )

    const link = await screen.findByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/download/deck-export.pptx")
    expect(link.getAttribute("download")).toBe("deck.pptx")
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it("supports bare layout, custom header and aside, and hidden toolbar", async () => {
    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/structured.pptx")}
        bare
        toolbar={false}
        header={<div data-testid="pptx-header">header</div>}
        aside={<div data-testid="pptx-aside">aside</div>}
      />
    )

    expect(await screen.findByTestId("pptx-header")).toBeTruthy()
    expect(screen.getByTestId("pptx-aside")).toBeTruthy()
    expect(screen.queryByText("Slide 1 of 1")).toBeNull()
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull()
    expect(
      document
        .querySelector('[data-slot="pptx-viewer"]')
        ?.classList.contains("h-full")
    ).toBe(true)
  })

  it("uses fit-width zoom from the measured slide container before manual zoom", async () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(512)

    await renderPptx(<PptxViewer source={pptxUrlSource("/fit-width.pptx")} />)

    expect(await screen.findByText("50%")).toBeTruthy()

    clientWidth.mockRestore()
  })

  it("reacts to controlled scale prop changes", async () => {
    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/deck.pptx")} scale={1} />
    )

    expect(await screen.findByText("100%")).toBeTruthy()

    await act(async () => {
      view.rerender(
        <PptxViewer source={pptxUrlSource("/deck.pptx")} scale={2} />
      )
    })

    expect(await screen.findByText("200%")).toBeTruthy()
  })

  it("uses an uncontrolled default scale before user zoom changes", async () => {
    await renderPptx(
      <PptxViewer source={pptxUrlSource("/deck.pptx")} defaultScale={1.5} />
    )

    expect(await screen.findByText("150%")).toBeTruthy()
  })

  it("ignores default scale changes after the uncontrolled initial mount", async () => {
    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/deck.pptx")} defaultScale={1.5} />
    )

    expect(await screen.findByText("150%")).toBeTruthy()

    await act(async () => {
      view.rerender(
        <PptxViewer source={pptxUrlSource("/deck.pptx")} defaultScale={2} />
      )
    })

    expect(screen.getByText("150%")).toBeTruthy()
  })

  it("disables zoom controls for controlled scale without a change handler", async () => {
    await renderPptx(
      <PptxViewer source={pptxUrlSource("/deck.pptx")} scale={1} />
    )

    await screen.findByText("100%")

    expect(screen.getByLabelText("Zoom out")).toHaveProperty("disabled", true)
    expect(screen.getByLabelText("Zoom in")).toHaveProperty("disabled", true)
    expect(screen.getByLabelText("Fit width")).toHaveProperty("disabled", true)
  })

  it("reports controlled zoom and fit-width changes", async () => {
    const onScaleChange = vi.fn()

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/deck.pptx")}
        scale={1}
        onScaleChange={onScaleChange}
      />
    )

    await screen.findByText("100%")
    fireEvent.click(screen.getByLabelText("Zoom in"))
    fireEvent.click(screen.getByLabelText("Fit width"))

    expect(onScaleChange).toHaveBeenCalledWith(1.2)
    expect(onScaleChange).toHaveBeenCalledWith(null)
  })

  it("clamps uncontrolled zoom changes to the supported range", async () => {
    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/clamped-zoom.pptx")}
        defaultScale={5}
      />
    )

    expect(await screen.findByText("500%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(screen.getByText("500%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Fit width"))
    await waitFor(() => {
      expect(screen.getByText("100%")).toBeTruthy()
    })

    for (let i = 0; i < 10; i += 1) {
      fireEvent.click(screen.getByLabelText("Zoom out"))
    }
    expect(screen.getByText("25%")).toBeTruthy()
  })

  it("passes slide overlay geometry with slide-native naming", async () => {
    const renderSlideOverlay = vi.fn((_props: PptxSlideOverlayProps) => (
      <div data-testid="pptx-slide-overlay-marker" />
    ))

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/deck.pptx")}
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
        source={pptxUrlSource("/deck.pptx")}
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

  it("reports the nearest visible slide and clamps scroll progress", async () => {
    pptxMock.getSlideCount.mockReturnValue(3)
    const onVisibleSlideChange = vi.fn()
    const onScrollProgressChange = vi.fn()

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/scroll-progress.pptx")}
        onScrollProgressChange={onScrollProgressChange}
        onVisibleSlideChange={onVisibleSlideChange}
      />
    )

    await screen.findByText("Slide 1 of 3")
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const slides = [
      ...document.querySelectorAll<HTMLElement>("[data-slide-number]"),
    ]
    expect(viewport).toBeTruthy()
    expect(slides).toHaveLength(3)

    setElementRect(viewport!, { height: 100, top: 0 })
    setElementRect(slides[0]!, { top: -250 })
    setElementRect(slides[1]!, { top: 10 })
    setElementRect(slides[2]!, { top: 300 })
    setElementNumberProperty(viewport!, "clientHeight", 100)
    setElementNumberProperty(viewport!, "scrollHeight", 500)
    setElementNumberProperty(viewport!, "scrollTop", 800)

    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(onVisibleSlideChange).toHaveBeenCalledWith(2)
    })
    expect(onScrollProgressChange).toHaveBeenLastCalledWith(1)
    expect(await screen.findByText("Slide 2 of 3")).toBeTruthy()
  })

  it("passes rotated visible slide size to the public overlay prop", async () => {
    const renderSlideOverlay = vi.fn(() => null)

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/deck.pptx")}
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

  it("cycles overlay rotation and visible dimensions through all four orientations", async () => {
    const renderSlideOverlay = vi.fn(() => null)

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/rotation-cycle.pptx")}
        scale={1}
        renderSlideOverlay={renderSlideOverlay}
      />
    )

    await screen.findByText("100%")
    const rotate = screen.getByLabelText("Rotate")
    fireEvent.click(rotate)
    fireEvent.click(rotate)
    fireEvent.click(rotate)
    fireEvent.click(rotate)

    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ height: 720, rotation: 0, width: 960 })
      )
    })
    const rotations = (
      renderSlideOverlay.mock.calls as unknown as Array<[PptxSlideOverlayProps]>
    ).map(([props]) => props.rotation)
    expect(rotations).toEqual(expect.arrayContaining([0, 90, 180, 270]))
  })

  it("shows a per-slide error when one slide render fails", async () => {
    pptxMock.renderSlide.mockRejectedValueOnce(new Error("render failed"))

    await renderPptx(
      <PptxViewer source={pptxUrlSource("/broken-slide.pptx")} />
    )

    expect(await screen.findByText("Couldn't render slide 1.")).toBeTruthy()
    expect(screen.getByText("Slide 1 of 1")).toBeTruthy()
  })

  it("resets the load error boundary when its reset key changes", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)

    function ThrowingDeck({ shouldThrow }: { shouldThrow: boolean }) {
      if (shouldThrow) throw new Error("broken deck")
      return <div>Recovered deck</div>
    }

    const view = render(
      <ViewerErrorBoundary
        download={{
          fileName: "broken.pptx",
          getPayload: () => ({ kind: "none" }),
          id: "download-original",
          label: "Download original",
          origin: "original",
        }}
        format="pptx"
        resetKey="broken"
      >
        <ThrowingDeck shouldThrow />
      </ViewerErrorBoundary>
    )

    expect(
      await screen.findByText("Couldn't load this presentation.")
    ).toBeTruthy()

    await act(async () => {
      view.rerender(
        <ViewerErrorBoundary
          download={{
            fileName: "fixed.pptx",
            getPayload: () => ({ kind: "none" }),
            id: "download-original",
            label: "Download original",
            origin: "original",
          }}
          format="pptx"
          resetKey="fixed"
        >
          <ThrowingDeck shouldThrow={false} />
        </ViewerErrorBoundary>
      )
    })

    expect(await screen.findByText("Recovered deck")).toBeTruthy()
    expect(consoleError).toHaveBeenCalled()
  })

  it("defers uncached slide renders until scrolling settles", async () => {
    const { activity, runIdle } = createManualPptxActivity()
    const source = createFakePptxSource()

    await act(async () => {
      render(
        <PptxSlideScroller
          source={source}
          zoomScale={1}
          rotation={0}
          eager={false}
          activity={activity}
          containerRef={vi.fn()}
          viewportRef={vi.fn()}
          onScroll={vi.fn()}
        />
      )
    })

    expect(source.renderSlide).not.toHaveBeenCalled()

    await act(async () => {
      runIdle()
    })

    expect(source.renderSlide).toHaveBeenCalledTimes(1)
  })

  it("does not run deferred slide renders after unmount", async () => {
    const { activity, runIdle } = createManualPptxActivity()
    const source = createFakePptxSource()

    const view = render(
      <PptxSlideScroller
        source={source}
        zoomScale={1}
        rotation={0}
        eager={false}
        activity={activity}
        containerRef={vi.fn()}
        viewportRef={vi.fn()}
        onScroll={vi.fn()}
      />
    )

    view.unmount()

    await act(async () => {
      runIdle()
    })

    expect(source.renderSlide).not.toHaveBeenCalled()
  })

  it("renders immediately during scrolling when eager or cached", async () => {
    const eagerActivity = createManualPptxActivity().activity
    const cachedActivity = createManualPptxActivity().activity
    const eagerSource = createFakePptxSource()
    const cachedSource = createFakePptxSource({ hasBitmap: true })

    render(
      <div>
        <PptxSlideScroller
          source={eagerSource}
          zoomScale={1}
          rotation={0}
          eager
          activity={eagerActivity}
          containerRef={vi.fn()}
          viewportRef={vi.fn()}
          onScroll={vi.fn()}
        />
        <PptxSlideScroller
          source={cachedSource}
          zoomScale={1}
          rotation={0}
          eager={false}
          activity={cachedActivity}
          containerRef={vi.fn()}
          viewportRef={vi.fn()}
          onScroll={vi.fn()}
        />
      </div>
    )

    expect(eagerSource.renderSlide).toHaveBeenCalledTimes(1)
    expect(cachedSource.renderSlide).toHaveBeenCalledTimes(1)
  })

  it("renders slides at zoom scale multiplied by device pixel ratio", async () => {
    const source = createFakePptxSource()
    const activity = createManualPptxActivity(false).activity
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2.5,
    })

    await act(async () => {
      render(
        <PptxSlideScroller
          source={source}
          zoomScale={1.2}
          rotation={0}
          eager={false}
          activity={activity}
          containerRef={vi.fn()}
          viewportRef={vi.fn()}
          onScroll={vi.fn()}
        />
      )
    })

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledWith(
        expect.objectContaining({
          renderScale: 3,
          slideIndex: 0,
        })
      )
    })
  })

  it("retries a failed slide frame when the render scale changes", async () => {
    const source = createFakePptxSource()
    source.renderSlide
      .mockResolvedValueOnce({ status: "failed", error: new Error("bad") })
      .mockResolvedValueOnce({ status: "rendered" })
    const activity = createManualPptxActivity(false).activity

    const view = render(
      <PptxSlideScroller
        source={source}
        zoomScale={1}
        rotation={0}
        eager={false}
        activity={activity}
        containerRef={vi.fn()}
        viewportRef={vi.fn()}
        onScroll={vi.fn()}
      />
    )

    expect(await screen.findByText("Couldn't render slide 1.")).toBeTruthy()

    await act(async () => {
      view.rerender(
        <PptxSlideScroller
          source={source}
          zoomScale={2}
          rotation={0}
          eager={false}
          activity={activity}
          containerRef={vi.fn()}
          viewportRef={vi.fn()}
          onScroll={vi.fn()}
        />
      )
    })

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(2)
      expect(screen.queryByText("Couldn't render slide 1.")).toBeNull()
    })
  })

  it("evicts old deck sources and closes their cached bitmaps", async () => {
    for (let i = 0; i < 5; i += 1) {
      const view = await renderPptx(
        <PptxViewer source={pptxUrlSource(`/deck-${i}.pptx`)} />
      )
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
    const source = await getPptxSource(pptxUrlResource("/retained.pptx"))
    const release = source.retain()

    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/evict-${i}.pptx`))
    }

    expect(pptxMock.destroy).not.toHaveBeenCalled()

    release()

    await waitFor(() => {
      expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
    })
  })

  it("does not hand callers a disposed source when pending loads are evicted", async () => {
    const firstLoad = deferred<undefined>()
    pptxMock.loadFile.mockImplementationOnce(() => firstLoad.promise)

    const firstSourcePromise = getPptxSource(pptxUrlResource("/pending-0.pptx"))

    for (let i = 1; i <= 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/pending-${i}.pptx`))
    }

    firstLoad.resolve(undefined)
    const firstSource = await firstSourcePromise

    await expect(
      firstSource.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })
  })

  it("cancels queued renders before they touch a stale canvas", async () => {
    const firstRender = deferred<undefined>()
    pptxMock.renderSlide.mockImplementationOnce(() => firstRender.promise)

    const source = await getPptxSource(pptxUrlResource("/queued-cancel.pptx"))
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
