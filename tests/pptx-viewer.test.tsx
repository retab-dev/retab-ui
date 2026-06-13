// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import { PptxRendererError } from "@/registry/new-york-v4/ui/pptx-viewer-renderer"
import { createPptxScrollActivity } from "@/registry/new-york-v4/ui/pptx-viewer-scroll"
import { PptxSlideScroller } from "@/registry/new-york-v4/ui/pptx-viewer-slide"
import {
  evictPptxSource,
  getPptxSource,
  subscribePptxSourceLoadTiming,
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

class ManualIntersectionObserver {
  static instances: ManualIntersectionObserver[] = []

  readonly observe = vi.fn()
  readonly disconnect = vi.fn()
  readonly unobserve = vi.fn()
  readonly takeRecords = vi.fn(() => [])

  constructor(readonly callback: IntersectionObserverCallback) {
    ManualIntersectionObserver.instances.push(this)
  }

  setIntersecting(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          target: document.createElement("div"),
        } as unknown as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver
    )
  }
}

function okPptxResponse() {
  return Promise.resolve(new Response(new Uint8Array([1, 2, 3]).buffer))
}

function pptxUrlSource(url: string, fileName?: string) {
  return { kind: "url" as const, url, fileName }
}

function pptxUrlResource(url: string, fileName?: string) {
  return createViewerResource(pptxUrlSource(url, fileName)).content
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
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, reject, resolve }
}

async function waitForPptxSourceFailureEviction() {
  await new Promise((resolve) => window.setTimeout(resolve, 0))
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

function renderedSlideIndexes(source: ReturnType<typeof createFakePptxSource>) {
  return (
    source.renderSlide.mock.calls as unknown as Array<[{ slideIndex: number }]>
  ).map(([call]) => call.slideIndex)
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
    // Declare xmlns:p (as real presentation.xml does) and use non-default dims so
    // this exercises the parse path rather than coincidentally matching the 960x720
    // parse-error fallback.
    expect(
      parsePptxSlideSize(
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>'
      )
    ).toEqual({ width: 1280, height: 720 })

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

  it("falls back to 4:3 when a supplied slide-size XML parser throws", () => {
    expect(
      parsePptxSlideSize("<p:presentation />", () => {
        throw new Error("parser unavailable")
      })
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
    expect(getPptxResetKey({ resourceKey: "url:/a.pptx" })).not.toBe(
      getPptxResetKey({ resourceKey: "url:/a.pptx", scale: 2 })
    )
    expect(getPptxResetKey({ resourceKey: "url:/a.pptx" })).not.toBe(
      getPptxResetKey({ resourceKey: "url:/a.pptx", defaultScale: 2 })
    )
    expect(getPptxResetKey({ resourceKey: "url:/a.pptx" })).not.toBe(
      getPptxResetKey({ resourceKey: "url:/a.pptx", eager: true })
    )
  })

  it("builds reset keys from normalized scale values", () => {
    expect(
      getPptxResetKey({ resourceKey: "url:/a.pptx", scale: Number.NaN })
    ).toBe(getPptxResetKey({ resourceKey: "url:/a.pptx", scale: 1 }))
    expect(
      getPptxResetKey({ resourceKey: "url:/a.pptx", defaultScale: Infinity })
    ).toBe(getPptxResetKey({ resourceKey: "url:/a.pptx", defaultScale: 1 }))
    expect(getPptxResetKey({ resourceKey: "url:/a.pptx", scale: 999 })).toBe(
      getPptxResetKey({ resourceKey: "url:/a.pptx", scale: 5 })
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

    await expect(getPptxSource(first.content)).resolves.toMatchObject({
      slideCount: 1,
    })
    await expect(getPptxSource(second.content)).resolves.toMatchObject({
      slideCount: 1,
    })

    expect(second).not.toBe(first)
    expect(second.keys.load).not.toBe(first.keys.load)
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

    await waitForPptxSourceFailureEviction()
    await expect(getPptxSource(resource)).resolves.toMatchObject({
      slideCount: 1,
    })
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(2)
  })

  it("cleans up and normalizes slide count read failures", async () => {
    pptxMock.getSlideCount.mockImplementationOnce(() => {
      throw new Error("count failed")
    })

    const error = await getPptxSource(
      pptxUrlResource("/broken-count.pptx")
    ).catch((caught) => caught)

    expect(error).toBeInstanceOf(ViewerFormatError)
    expect(error).toMatchObject({
      format: "pptx",
      kind: "load_failed",
    })
    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
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

  it("falls back to the default slide size when presentation.xml is missing", async () => {
    zipMock.loadAsync.mockResolvedValueOnce({
      file: vi.fn(() => null),
    } as never)

    await expect(
      getPptxSource(pptxUrlResource("/missing-presentation-xml.pptx"))
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
    await waitForPptxSourceFailureEviction()
    await expect(getPptxSource(resource)).resolves.toMatchObject({
      slideCount: 1,
    })

    expect(pptxMock.loadFile).toHaveBeenCalledTimes(2)
  })

  it("shares concurrent load failures and still retries the same URL later", async () => {
    const resource = pptxUrlResource("/concurrent-retry-after-failure.pptx")
    pptxMock.loadFile.mockRejectedValueOnce(new Error("shared load failed"))

    const first = getPptxSource(resource)
    const second = getPptxSource(resource)

    await expect(first).rejects.toMatchObject({ kind: "load_failed" })
    await expect(second).rejects.toMatchObject({ kind: "load_failed" })
    await waitForPptxSourceFailureEviction()
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
    await waitForPptxSourceFailureEviction()
    await expect(getPptxSource(resource)).resolves.toMatchObject({
      slideCount: 1,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)
  })

  it("serializes render calls and forwards render options to pptxviewjs", async () => {
    pptxMock.getSlideCount.mockReturnValueOnce(2)
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

  it("reports cached bitmap draw failures without invoking pptxviewjs again", async () => {
    const source = await getPptxSource(
      pptxUrlResource("/cached-bitmap-draw-failure.pptx")
    )

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })

    drawImageMock.mockImplementationOnce(() => {
      throw new Error("draw failed")
    })

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
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
  })

  it("reports cached bitmap draw failures when the canvas 2D context is unavailable", async () => {
    const source = await getPptxSource(
      pptxUrlResource("/cached-bitmap-no-context.pptx")
    )

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

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
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
  })

  it("uses the bitmap cached by an earlier queued render for duplicate live requests", async () => {
    const firstRender = deferred<undefined>()
    pptxMock.renderSlide.mockImplementationOnce(() => firstRender.promise)

    const source = await getPptxSource(
      pptxUrlResource("/queued-duplicate-cache.pptx")
    )
    const firstCanvas = document.createElement("canvas")
    const secondCanvas = document.createElement("canvas")
    const first = source.renderSlide({
      canvas: firstCanvas,
      renderScale: 1,
      slideIndex: 0,
    })
    const second = source.renderSlide({
      canvas: secondCanvas,
      renderScale: 1,
      slideIndex: 0,
    })

    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })

    firstRender.resolve(undefined)

    await expect(first).resolves.toEqual({ status: "rendered" })
    await expect(second).resolves.toEqual({ status: "rendered" })
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    expect(drawImageMock).toHaveBeenCalledWith(bitmapMocks[0], 0, 0)
    expect(secondCanvas.width).toBe(960)
    expect(secondCanvas.height).toBe(720)
  })

  it("reports queued cached bitmap draw failures without rerendering", async () => {
    const firstRender = deferred<undefined>()
    pptxMock.renderSlide.mockImplementationOnce(() => firstRender.promise)

    const source = await getPptxSource(
      pptxUrlResource("/queued-cached-bitmap-draw-failure.pptx")
    )
    const first = source.renderSlide({
      canvas: document.createElement("canvas"),
      renderScale: 1,
      slideIndex: 0,
    })
    const second = source.renderSlide({
      canvas: document.createElement("canvas"),
      renderScale: 1,
      slideIndex: 0,
    })

    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })

    drawImageMock.mockImplementationOnce(() => {
      throw new Error("queued draw failed")
    })
    firstRender.resolve(undefined)

    await expect(first).resolves.toEqual({ status: "rendered" })
    await expect(second).resolves.toMatchObject({
      error: expect.objectContaining({ kind: "render_failed" }),
      status: "failed",
    })
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
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

  it("keeps a successful render when bitmap snapshotting is unavailable", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("snapshot unsupported")
      })
    )

    const source = await getPptxSource(
      pptxUrlResource("/snapshot-unsupported.pptx")
    )

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })

    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(false)

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(2)
  })

  it("cancels a render when snapshot failure happens after it becomes stale", async () => {
    const snapshot = deferred<undefined>()
    let isLive = true

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        await snapshot.promise
        throw new Error("snapshot failed")
      })
    )

    const source = await getPptxSource(
      pptxUrlResource("/stale-snapshot-failure.pptx")
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
    snapshot.resolve(undefined)

    await expect(render).resolves.toEqual({ status: "cancelled" })
    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(false)
  })

  it("closes cached bitmaps when a source is disposed directly", async () => {
    const source = await getPptxSource(
      pptxUrlResource("/dispose-cached-bitmap.pptx")
    )

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })

    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(true)

    source.dispose()

    expect(bitmapMocks[0]?.close).toHaveBeenCalledTimes(1)
    expect(source.hasBitmap({ renderScale: 1, slideIndex: 0 })).toBe(false)
    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
  })

  it("rejects new renders after direct source disposal without touching pptxviewjs", async () => {
    const source = await getPptxSource(
      pptxUrlResource("/render-after-dispose.pptx")
    )
    source.dispose()
    pptxMock.renderSlide.mockClear()

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toMatchObject({
      error: expect.objectContaining({ kind: "disposed" }),
      status: "failed",
    })

    expect(pptxMock.renderSlide).not.toHaveBeenCalled()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it("disposes a loaded source idempotently", async () => {
    const source = await getPptxSource(pptxUrlResource("/dispose-once.pptx"))

    source.dispose()
    source.dispose()

    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
  })

  it("evicts the oldest cached slide bitmaps after the per-source limit", async () => {
    pptxMock.getSlideCount.mockReturnValueOnce(9)
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

  it("rejects out-of-range slide indexes before calling pptxviewjs", async () => {
    pptxMock.getSlideCount.mockReturnValueOnce(2)
    const source = await getPptxSource(pptxUrlResource("/bounds.pptx"))

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: -1,
      })
    ).resolves.toMatchObject({
      error: expect.objectContaining({ kind: "index_out_of_range" }),
      status: "failed",
    })
    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 2,
      })
    ).resolves.toMatchObject({
      error: expect.objectContaining({ kind: "index_out_of_range" }),
      status: "failed",
    })

    expect(pptxMock.renderSlide).not.toHaveBeenCalled()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it("rejects invalid render scales before calling pptxviewjs", async () => {
    const source = await getPptxSource(pptxUrlResource("/invalid-scale.pptx"))

    for (const renderScale of [0, -1, Number.NaN, Infinity]) {
      await expect(
        source.renderSlide({
          canvas: document.createElement("canvas"),
          renderScale,
          slideIndex: 0,
        })
      ).resolves.toMatchObject({
        error: expect.objectContaining({ kind: "bounds" }),
        status: "failed",
      })
    }

    expect(pptxMock.renderSlide).not.toHaveBeenCalled()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it("cancels renders when the liveness callback fails", async () => {
    const source = await getPptxSource(
      pptxUrlResource("/throwing-liveness.pptx")
    )

    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        isLive: () => {
          throw new Error("liveness failed")
        },
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "cancelled" })

    expect(pptxMock.renderSlide).not.toHaveBeenCalled()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it("cancels late renderer failures after a render becomes stale", async () => {
    const render = deferred<undefined>()
    let isLive = true
    pptxMock.renderSlide.mockReturnValueOnce(render.promise)
    const source = await getPptxSource(
      pptxUrlResource("/stale-renderer-failure.pptx")
    )

    const result = source.renderSlide({
      canvas: document.createElement("canvas"),
      isLive: () => isLive,
      renderScale: 1,
      slideIndex: 0,
    })

    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })

    isLive = false
    render.reject(new Error("late render failure"))

    await expect(result).resolves.toEqual({ status: "cancelled" })
    expect(createImageBitmap).not.toHaveBeenCalled()
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

  it("reports slide render timings for benchmark instrumentation", async () => {
    const onSlideRenderTiming = vi.fn()

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/timed.pptx")}
        onSlideRenderTiming={onSlideRenderTiming}
      />
    )

    await waitFor(() => {
      expect(onSlideRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          cached: false,
          durationMs: expect.any(Number),
          renderScale: expect.any(Number),
          slideNumber: 1,
          status: "rendered",
        })
      )
    })
  })

  it("reports source load timings for benchmark instrumentation", async () => {
    const onSourceLoadTiming = vi.fn()

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/timed-load.pptx")}
        onSourceLoadTiming={onSourceLoadTiming}
      />
    )

    await waitFor(() => {
      expect(onSourceLoadTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          byteLength: 3,
          importPptxMs: expect.any(Number),
          inspectMs: expect.any(Number),
          loadFileMs: expect.any(Number),
          readBytesMs: expect.any(Number),
          readSlideSizeMs: expect.any(Number),
          slideCount: 1,
          totalMs: expect.any(Number),
        })
      )
    })
  })

  it("does not restart a pending source load when only the load timing callback changes", async () => {
    const firstTiming = vi.fn()
    const secondTiming = vi.fn()
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/pending-load-timing.pptx")}
        onSourceLoadTiming={firstTiming}
      />
    )

    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/pending-load-timing.pptx")}
          onSourceLoadTiming={secondTiming}
        />
      )
    })

    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)

    load.resolve(undefined)

    await waitFor(() => {
      expect(secondTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          byteLength: 3,
          slideCount: 1,
        })
      )
    })
    expect(firstTiming).not.toHaveBeenCalled()
  })

  it("replays cached source load timings to a later viewer without reloading", async () => {
    const firstTiming = vi.fn()
    const secondTiming = vi.fn()

    const first = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/cached-load-timing.pptx")}
        onSourceLoadTiming={firstTiming}
      />
    )

    await waitFor(() => {
      expect(firstTiming).toHaveBeenCalledTimes(1)
    })
    first.unmount()
    pptxMock.loadFile.mockClear()

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/cached-load-timing.pptx")}
        onSourceLoadTiming={secondTiming}
      />
    )

    await waitFor(() => {
      expect(secondTiming).toHaveBeenCalledWith(firstTiming.mock.calls[0]?.[0])
    })
    expect(pptxMock.loadFile).not.toHaveBeenCalled()
  })

  it("replays cached source load timing after instrumentation is re-enabled", async () => {
    const firstTiming = vi.fn()
    const secondTiming = vi.fn()

    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/reenabled-load-timing.pptx")}
        onSourceLoadTiming={firstTiming}
      />
    )

    await waitFor(() => {
      expect(firstTiming).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(
        <PptxViewer source={pptxUrlSource("/reenabled-load-timing.pptx")} />
      )
    })

    pptxMock.loadFile.mockClear()

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/reenabled-load-timing.pptx")}
          onSourceLoadTiming={secondTiming}
        />
      )
    })

    await waitFor(() => {
      expect(secondTiming).toHaveBeenCalledWith(firstTiming.mock.calls[0]?.[0])
    })
    expect(pptxMock.loadFile).not.toHaveBeenCalled()
  })

  it("replays retained source load timing after source cache eviction", async () => {
    const onSourceLoadTiming = vi.fn()
    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/retained-evicted-timing.pptx")} />
    )

    await screen.findByText("Slide 1 of 1")

    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/evict-timing-${i}.pptx`))
    }

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/retained-evicted-timing.pptx")}
          onSourceLoadTiming={onSourceLoadTiming}
        />
      )
    })

    await waitFor(() => {
      expect(onSourceLoadTiming).toHaveBeenCalledWith(
        expect.objectContaining({ slideCount: 1 })
      )
    })
  })

  it("reports pending retained source load timing after source cache eviction", async () => {
    const onSourceLoadTiming = vi.fn()
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/pending-evicted-timing.pptx")} />
    )

    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/pending-evict-timing-${i}.pptx`))
    }

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/pending-evicted-timing.pptx")}
          onSourceLoadTiming={onSourceLoadTiming}
        />
      )
    })

    load.resolve(undefined)

    await waitFor(() => {
      expect(onSourceLoadTiming).toHaveBeenCalledWith(
        expect.objectContaining({ slideCount: 1 })
      )
    })
  })

  it("reports shared pending source load timings to each mounted viewer", async () => {
    const firstTiming = vi.fn()
    const secondTiming = vi.fn()
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    await renderPptx(
      <div>
        <PptxViewer
          source={pptxUrlSource("/shared-pending-load-timing.pptx")}
          onSourceLoadTiming={firstTiming}
        />
        <PptxViewer
          source={pptxUrlSource("/shared-pending-load-timing.pptx")}
          onSourceLoadTiming={secondTiming}
        />
      </div>
    )

    expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)

    load.resolve(undefined)

    await waitFor(() => {
      expect(firstTiming).toHaveBeenCalledTimes(1)
      expect(secondTiming).toHaveBeenCalledTimes(1)
    })
    expect(firstTiming.mock.calls[0]?.[0]).toBe(secondTiming.mock.calls[0]?.[0])
  })

  it("does not report pending source load timings after unmount", async () => {
    const onSourceLoadTiming = vi.fn()
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/unmounted-pending-load-timing.pptx")}
        onSourceLoadTiming={onSourceLoadTiming}
      />
    )

    view.unmount()
    load.resolve(undefined)

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(onSourceLoadTiming).not.toHaveBeenCalled()
  })

  it("does not report pending source load timing after instrumentation is removed", async () => {
    const onSourceLoadTiming = vi.fn()
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/removed-pending-load-timing.pptx")}
        onSourceLoadTiming={onSourceLoadTiming}
      />
    )

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/removed-pending-load-timing.pptx")}
        />
      )
    })

    load.resolve(undefined)

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(onSourceLoadTiming).not.toHaveBeenCalled()
  })

  it("cancels cached source load timing replay after unsubscribe", async () => {
    vi.useFakeTimers()
    const resource = pptxUrlResource("/cancelled-cached-load-timing.pptx")
    const replayTiming = vi.fn()

    await getPptxSource(resource)
    const unsubscribe = subscribePptxSourceLoadTiming(resource, replayTiming)

    unsubscribe()
    vi.runOnlyPendingTimers()
    expect(replayTiming).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("does not replay stale source load timing after a fresh load failure", async () => {
    const resource = pptxUrlResource("/stale-load-timing-after-failure.pptx")
    const staleTiming = vi.fn()

    await expect(getPptxSource(resource)).resolves.toMatchObject({
      slideCount: 1,
    })

    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/stale-timing-evict-${i}.pptx`))
    }

    pptxMock.loadFile.mockRejectedValueOnce(new Error("fresh load failed"))
    await expect(getPptxSource(resource)).rejects.toMatchObject({
      kind: "load_failed",
    })
    await waitForPptxSourceFailureEviction()

    subscribePptxSourceLoadTiming(resource, staleTiming)
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(staleTiming).not.toHaveBeenCalled()
  })

  it("cancels evicted cached source load timing replay after unsubscribe", async () => {
    vi.useFakeTimers()
    const resource = pptxUrlResource("/cancelled-evicted-load-timing.pptx")
    const replayTiming = vi.fn()

    await getPptxSource(resource)
    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(
        pptxUrlResource(`/cancelled-evicted-load-timing-${i}.pptx`)
      )
    }

    const unsubscribe = subscribePptxSourceLoadTiming(resource, replayTiming)

    unsubscribe()
    vi.runOnlyPendingTimers()
    expect(replayTiming).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("evicts the oldest source load timing after the replay cache limit", async () => {
    const first = pptxUrlResource("/timing-cache-limit-0.pptx")
    const latest = pptxUrlResource("/timing-cache-limit-32.pptx")
    const firstTiming = vi.fn()
    const latestTiming = vi.fn()

    await getPptxSource(first)
    for (let i = 1; i <= 32; i += 1) {
      await getPptxSource(pptxUrlResource(`/timing-cache-limit-${i}.pptx`))
    }

    subscribePptxSourceLoadTiming(first, firstTiming)
    subscribePptxSourceLoadTiming(latest, latestTiming)
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(firstTiming).not.toHaveBeenCalled()
    expect(latestTiming).toHaveBeenCalledWith(
      expect.objectContaining({ slideCount: 1 })
    )
  })

  it("isolates source load timing subscriber failures", async () => {
    const resource = pptxUrlResource("/isolated-source-timing.pptx")
    const load = deferred<undefined>()
    const throwingTiming = vi.fn(() => {
      throw new Error("timing callback failed")
    })
    const secondTiming = vi.fn()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    const sourcePromise = getPptxSource(resource)
    subscribePptxSourceLoadTiming(resource, throwingTiming)
    subscribePptxSourceLoadTiming(resource, secondTiming)

    load.resolve(undefined)

    await expect(sourcePromise).resolves.toMatchObject({ slideCount: 1 })
    expect(throwingTiming).toHaveBeenCalledTimes(1)
    expect(secondTiming).toHaveBeenCalledWith(
      expect.objectContaining({ slideCount: 1 })
    )
  })

  it("reports failed slide render timings", async () => {
    const onSlideRenderTiming = vi.fn()
    pptxMock.renderSlide.mockRejectedValueOnce(new Error("render failed"))

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/timed-failure.pptx")}
        onSlideRenderTiming={onSlideRenderTiming}
      />
    )

    await waitFor(() => {
      expect(onSlideRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          cached: false,
          durationMs: expect.any(Number),
          renderScale: expect.any(Number),
          slideNumber: 1,
          status: "failed",
        })
      )
    })
  })

  it("does not let slide timing callback errors fail a rendered slide", async () => {
    const onSlideRenderTiming = vi.fn(() => {
      throw new Error("timing callback failed")
    })

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/throwing-slide-timing.pptx")}
        onSlideRenderTiming={onSlideRenderTiming}
      />
    )

    await waitFor(() => {
      expect(onSlideRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({ status: "rendered" })
      )
    })
    expect(screen.queryByText("Couldn't render slide 1.")).toBeNull()
  })

  it("does not report slide render timings for renders cancelled by unmount", async () => {
    const onSlideRenderTiming = vi.fn()
    const renderResult = deferred<PptxRenderResult>()
    const source = createFakePptxSource()
    source.renderSlide.mockReturnValueOnce(renderResult.promise)
    const activity = createManualPptxActivity(false).activity

    const view = render(
      <PptxSlideScroller
        source={source}
        zoomScale={1}
        rotation={0}
        eager={false}
        activity={activity}
        onSlideRenderTiming={onSlideRenderTiming}
        containerRef={vi.fn()}
        viewportRef={vi.fn()}
        onScroll={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(1)
    })

    view.unmount()

    await act(async () => {
      renderResult.resolve({ status: "cancelled" })
    })

    expect(onSlideRenderTiming).not.toHaveBeenCalled()
  })

  it("reports slide render timings for live renders that return cancelled", async () => {
    const onSlideRenderTiming = vi.fn()
    const source = createFakePptxSource()
    source.renderSlide.mockResolvedValueOnce({ status: "cancelled" })
    const activity = createManualPptxActivity(false).activity

    render(
      <PptxSlideScroller
        source={source}
        zoomScale={1}
        rotation={0}
        eager={false}
        activity={activity}
        onSlideRenderTiming={onSlideRenderTiming}
        containerRef={vi.fn()}
        viewportRef={vi.fn()}
        onScroll={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(onSlideRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          cached: false,
          slideNumber: 1,
          status: "cancelled",
        })
      )
    })
  })

  it("reports deferred slide timings as cached when a bitmap appears before idle", async () => {
    const onSlideRenderTiming = vi.fn()
    const { activity, runIdle } = createManualPptxActivity()
    const source = createFakePptxSource()
    let hasBitmap = false
    source.hasBitmap.mockImplementation(() => hasBitmap)

    render(
      <PptxSlideScroller
        source={source}
        zoomScale={1}
        rotation={0}
        eager={false}
        activity={activity}
        onSlideRenderTiming={onSlideRenderTiming}
        containerRef={vi.fn()}
        viewportRef={vi.fn()}
        onScroll={vi.fn()}
      />
    )

    expect(source.renderSlide).not.toHaveBeenCalled()
    hasBitmap = true

    await act(async () => {
      runIdle()
    })

    await waitFor(() => {
      expect(onSlideRenderTiming).toHaveBeenCalledWith(
        expect.objectContaining({
          cached: true,
          status: "rendered",
        })
      )
    })
  })

  it("does not restart a pending slide render when only the timing callback changes", async () => {
    const firstTiming = vi.fn()
    const secondTiming = vi.fn()
    const renderResult = deferred<PptxRenderResult>()
    const source = createFakePptxSource()
    source.renderSlide.mockReturnValueOnce(renderResult.promise)
    const activity = createManualPptxActivity(false).activity

    const view = render(
      <PptxSlideScroller
        source={source}
        zoomScale={1}
        rotation={0}
        eager={false}
        activity={activity}
        onSlideRenderTiming={firstTiming}
        containerRef={vi.fn()}
        viewportRef={vi.fn()}
        onScroll={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(
        <PptxSlideScroller
          source={source}
          zoomScale={1}
          rotation={0}
          eager={false}
          activity={activity}
          onSlideRenderTiming={secondTiming}
          containerRef={vi.fn()}
          viewportRef={vi.fn()}
          onScroll={vi.fn()}
        />
      )
    })

    expect(source.renderSlide).toHaveBeenCalledTimes(1)

    await act(async () => {
      renderResult.resolve({ status: "rendered" })
    })

    expect(firstTiming).not.toHaveBeenCalled()
    expect(secondTiming).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rendered" })
    )
  })

  it("keeps the same canvas lifecycle when scroller props rerender unchanged", async () => {
    const renderResult = deferred<PptxRenderResult>()
    const source = createFakePptxSource()
    source.renderSlide.mockReturnValueOnce(renderResult.promise)
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

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(1)
    })

    const canvas = document.querySelector("canvas")

    await act(async () => {
      view.rerender(
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

    expect(document.querySelector("canvas")).toBe(canvas)
    expect(source.renderSlide).toHaveBeenCalledTimes(1)

    await act(async () => {
      renderResult.resolve({ status: "rendered" })
    })
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

  it("shares loaded Blob sources while keeping Blob download metadata per viewer", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    const { createObjectURL } = mockObjectUrls("blob:shared-download")

    await renderPptx(
      <div>
        <PptxViewer
          source={{
            kind: "blob",
            blob,
            downloadUrl: "/download/blob-a.pptx",
            fileName: "blob-a.pptx",
            identityKey: "blob:shared",
          }}
        />
        <PptxViewer
          source={{
            kind: "blob",
            blob,
            fileName: "blob-b.pptx",
            identityKey: "blob:shared",
          }}
        />
      </div>
    )

    expect(await screen.findAllByText("Slide 1 of 1")).toHaveLength(2)

    const link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/download/blob-a.pptx")
    expect(link.getAttribute("download")).toBe("blob-a.pptx")

    const button = screen.getByRole("button", { name: "Download" })
    fireEvent.click(button)
    await waitFor(() => {
      expect(click).toHaveBeenCalled()
    })

    expect(createObjectURL).toHaveBeenCalledWith(blob)
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

  it("supports bare layout, document slots, and hidden toolbar", async () => {
    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/structured.pptx")}
        bare
        toolbar={false}
        slots={{
          top: <div data-testid="pptx-header">header</div>,
          left: <div data-testid="pptx-aside">aside</div>,
        }}
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

  it("keeps the toolbar hidden while a toolbarless viewer is loading", async () => {
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/toolbarless-loading.pptx")}
        toolbar={false}
      />
    )

    expect(document.querySelector('[data-slot="pptx-viewer"]')).toBeTruthy()
    expect(document.querySelectorAll('[data-slot="button"]')).toHaveLength(0)
    expect(screen.queryByText("Slide 1 of 1")).toBeNull()

    load.resolve(undefined)
    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull()

    view.unmount()
  })

  it("recovers from a real load failure when the source changes", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    pptxMock.loadFile.mockRejectedValue(new Error("bad deck"))

    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/broken-then-fixed.pptx")} />
    )

    expect(
      await screen.findByText("Couldn't load this presentation.")
    ).toBeTruthy()

    pptxMock.loadFile.mockReset()
    pptxMock.loadFile.mockResolvedValue(undefined)

    await act(async () => {
      view.rerender(
        <PptxViewer source={pptxUrlSource("/fixed-after-broken.pptx")} />
      )
    })

    expect(await screen.findByText("Slide 1 of 1")).toBeTruthy()
    expect(consoleError).toHaveBeenCalled()
  })

  it("retries a real load failure for the same source", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    pptxMock.loadFile
      .mockRejectedValueOnce(new Error("bad deck"))
      .mockResolvedValue(undefined)

    await renderPptx(
      <PptxViewer source={pptxUrlSource("/retry-same-source.pptx")} />
    )

    expect(
      await screen.findByText("Couldn't load this presentation.")
    ).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    })

    expect(await screen.findByText("Slide 1 of 1")).toBeTruthy()
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalled()
  })

  it("does not render an abandoned pending source after switching to a new source", async () => {
    const slowLoad = deferred<undefined>()
    pptxMock.loadFile
      .mockReturnValueOnce(slowLoad.promise)
      .mockResolvedValueOnce(undefined)

    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/slow-source.pptx")} />
    )

    expect(screen.queryByText("Slide 1 of 1")).toBeNull()

    await act(async () => {
      view.rerender(<PptxViewer source={pptxUrlSource("/fast-source.pptx")} />)
    })

    expect(await screen.findByText("Slide 1 of 1")).toBeTruthy()
    await waitFor(() => {
      expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
    })

    slowLoad.resolve(undefined)

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(screen.getByText("Slide 1 of 1")).toBeTruthy()
    expect(pptxMock.renderSlide).toHaveBeenCalledTimes(1)
  })

  it("resets document-local rotation when the source changes", async () => {
    const renderSlideOverlay = vi.fn(() => null)
    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/rotated-source-a.pptx")}
        scale={1}
        renderSlideOverlay={renderSlideOverlay}
      />
    )

    await screen.findByText("100%")
    fireEvent.click(screen.getByLabelText("Rotate"))

    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ rotation: 90 })
      )
    })
    renderSlideOverlay.mockClear()

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/rotated-source-b.pptx")}
          scale={1}
          renderSlideOverlay={renderSlideOverlay}
        />
      )
    })

    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ rotation: 0 })
      )
    })
    expect(renderSlideOverlay).not.toHaveBeenCalledWith(
      expect.objectContaining({ rotation: 90 })
    )
  })

  it("keeps document-local rotation when only download metadata changes", async () => {
    const renderSlideOverlay = vi.fn(() => null)
    const view = await renderPptx(
      <PptxViewer
        source={{
          kind: "url",
          downloadUrl: "/download/metadata-a.pptx",
          fileName: "metadata-a.pptx",
          url: "/metadata-stable-deck.pptx",
        }}
        scale={1}
        renderSlideOverlay={renderSlideOverlay}
      />
    )

    await screen.findByText("100%")
    fireEvent.click(screen.getByLabelText("Rotate"))

    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ rotation: 90 })
      )
    })
    renderSlideOverlay.mockClear()

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={{
            kind: "url",
            downloadUrl: "/download/metadata-b.pptx",
            fileName: "metadata-b.pptx",
            url: "/metadata-stable-deck.pptx",
          }}
          scale={1}
          renderSlideOverlay={renderSlideOverlay}
        />
      )
    })

    fireEvent.click(screen.getByLabelText("Rotate"))

    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ rotation: 180 })
      )
    })
  })

  it("does not replay source load timing when only download metadata changes", async () => {
    const onSourceLoadTiming = vi.fn()
    const view = await renderPptx(
      <PptxViewer
        source={{
          kind: "url",
          downloadUrl: "/download/timing-metadata-a.pptx",
          fileName: "timing-metadata-a.pptx",
          url: "/timing-metadata-stable-deck.pptx",
        }}
        onSourceLoadTiming={onSourceLoadTiming}
      />
    )

    await waitFor(() => {
      expect(onSourceLoadTiming).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={{
            kind: "url",
            downloadUrl: "/download/timing-metadata-b.pptx",
            fileName: "timing-metadata-b.pptx",
            url: "/timing-metadata-stable-deck.pptx",
          }}
          onSourceLoadTiming={onSourceLoadTiming}
        />
      )
    })

    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(onSourceLoadTiming).toHaveBeenCalledTimes(1)
  })

  it("resets uncontrolled zoom to the new source fit scale", async () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(512)
    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/zoom-source-a.pptx")} />
    )

    expect(await screen.findByText("50%")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(await screen.findByText("60%")).toBeTruthy()

    await act(async () => {
      view.rerender(
        <PptxViewer source={pptxUrlSource("/zoom-source-b.pptx")} />
      )
    })

    expect(await screen.findByText("50%")).toBeTruthy()
    clientWidth.mockRestore()
  })

  it("uses fit-width zoom from the measured slide container before manual zoom", async () => {
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(512)

    await renderPptx(<PptxViewer source={pptxUrlSource("/fit-width.pptx")} />)

    expect(await screen.findByText("50%")).toBeTruthy()

    clientWidth.mockRestore()
  })

  it("renders fit-width mode when ResizeObserver is unavailable", async () => {
    vi.stubGlobal("ResizeObserver", undefined)
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(512)

    await renderPptx(
      <PptxViewer source={pptxUrlSource("/no-resize-observer.pptx")} />
    )

    expect(await screen.findByText("50%")).toBeTruthy()
    clientWidth.mockRestore()
  })

  it("renders fit-width mode when ResizeObserver throws", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor() {
          throw new Error("resize observer unavailable")
        }
      }
    )
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(512)

    await renderPptx(
      <PptxViewer source={pptxUrlSource("/throwing-resize-observer.pptx")} />
    )

    expect(await screen.findByText("50%")).toBeTruthy()
    clientWidth.mockRestore()
  })

  it("renders fit-width mode when ResizeObserver observe throws", async () => {
    class ObserveThrowingResizeObserver {
      static instances: ObserveThrowingResizeObserver[] = []

      disconnect = vi.fn()
      observe = vi.fn(() => {
        throw new Error("resize observer observe failed")
      })

      constructor() {
        ObserveThrowingResizeObserver.instances.push(this)
      }
    }
    vi.stubGlobal("ResizeObserver", ObserveThrowingResizeObserver)
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(512)

    await renderPptx(
      <PptxViewer source={pptxUrlSource("/throwing-resize-observe.pptx")} />
    )

    expect(await screen.findByText("50%")).toBeTruthy()
    expect(
      ObserveThrowingResizeObserver.instances.some(
        (observer) => observer.disconnect.mock.calls.length > 0
      )
    ).toBe(true)
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

  it("normalizes invalid controlled scale values before rendering", async () => {
    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/nan-scale.pptx")}
        scale={Number.NaN}
      />
    )

    expect(await screen.findByText("100%")).toBeTruthy()

    await act(async () => {
      view.rerender(
        <PptxViewer source={pptxUrlSource("/nan-scale.pptx")} scale={999} />
      )
    })

    expect(await screen.findByText("500%")).toBeTruthy()
  })

  it("uses an uncontrolled default scale before user zoom changes", async () => {
    await renderPptx(
      <PptxViewer source={pptxUrlSource("/deck.pptx")} defaultScale={1.5} />
    )

    expect(await screen.findByText("150%")).toBeTruthy()
  })

  it("normalizes invalid uncontrolled default scale values", async () => {
    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/nan-default-scale.pptx")}
        defaultScale={Number.NaN}
      />
    )

    expect(await screen.findByText("100%")).toBeTruthy()
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

  it("clamps controlled zoom requests before reporting them", async () => {
    const onScaleChange = vi.fn()
    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/controlled-clamp.pptx")}
        scale={5}
        onScaleChange={onScaleChange}
      />
    )

    await screen.findByText("500%")
    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(onScaleChange).toHaveBeenLastCalledWith(5)

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/controlled-clamp.pptx")}
          scale={0.25}
          onScaleChange={onScaleChange}
        />
      )
    })

    await screen.findByText("25%")
    fireEvent.click(screen.getByLabelText("Zoom out"))
    expect(onScaleChange).toHaveBeenLastCalledWith(0.25)
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

  it("reports the current visible slide to a replacement visible-slide callback", async () => {
    pptxMock.getSlideCount.mockReturnValue(2)
    const firstVisible = vi.fn()
    const secondVisible = vi.fn()

    const view = await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/visible-callback-replacement.pptx")}
        onVisibleSlideChange={firstVisible}
      />
    )

    await screen.findByText("Slide 1 of 2")
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const slides = [
      ...document.querySelectorAll<HTMLElement>("[data-slide-number]"),
    ]
    expect(viewport).toBeTruthy()
    expect(slides).toHaveLength(2)

    setElementNumberProperty(viewport!, "clientHeight", 100)
    setElementNumberProperty(viewport!, "scrollTop", 732)

    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(firstVisible).toHaveBeenCalledWith(2)
    })

    await act(async () => {
      view.rerender(
        <PptxViewer
          source={pptxUrlSource("/visible-callback-replacement.pptx")}
          onVisibleSlideChange={secondVisible}
        />
      )
    })

    fireEvent.scroll(viewport!)

    expect(secondVisible).toHaveBeenCalledWith(2)
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

  it("reports zero scroll progress when the slide viewport has no overflow", async () => {
    const onScrollProgressChange = vi.fn()

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/no-scroll-progress.pptx")}
        onScrollProgressChange={onScrollProgressChange}
      />
    )

    await screen.findByText("Slide 1 of 1")
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setElementNumberProperty(viewport!, "clientHeight", 100)
    setElementNumberProperty(viewport!, "scrollHeight", 100)
    setElementNumberProperty(viewport!, "scrollTop", 50)

    fireEvent.scroll(viewport!)

    expect(onScrollProgressChange).toHaveBeenLastCalledWith(0)
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

  it("uses a native PPTX scroll viewport while preserving the viewport slot", () => {
    const source = createFakePptxSource()
    const activity = createManualPptxActivity(false).activity

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

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    expect(viewport?.classList.contains("overflow-auto")).toBe(true)
    expect(
      document.querySelector('[data-slot="scroll-area-scrollbar"]')
    ).toBeNull()
    expect(
      viewport?.querySelector('[data-slot="pptx-slide-virtual-canvas"]')
    ).toBeTruthy()
  })

  it("mounts a bounded virtual slide window instead of every slide shell", async () => {
    const source = createFakePptxSource({ slideCount: 20 })
    const activity = createManualPptxActivity(false).activity

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

    await waitFor(() => {
      const slides = document.querySelectorAll('[data-slot="pptx-slide"]')
      expect(slides.length).toBeGreaterThan(0)
      expect(slides.length).toBeLessThan(20)
    })
    expect(new Set(renderedSlideIndexes(source))).toEqual(new Set([0, 1, 2]))
  })

  it("renders virtual slides without constructing IntersectionObserver", async () => {
    vi.stubGlobal("IntersectionObserver", undefined)
    const source = createFakePptxSource()
    const activity = createManualPptxActivity(false).activity

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

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(1)
    })
  })

  it("ignores throwing IntersectionObserver constructors because slide membership is math-based", async () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor() {
          throw new Error("intersection observer unavailable")
        }
      }
    )
    const source = createFakePptxSource()
    const activity = createManualPptxActivity(false).activity

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

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(1)
    })
  })

  it("moves the virtual slide window on scroll", async () => {
    const source = createFakePptxSource({ slideCount: 20 })
    const activity = createManualPptxActivity(false).activity

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

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setElementNumberProperty(viewport!, "clientHeight", 720)
    setElementNumberProperty(viewport!, "scrollTop", 16 + 9 * 736)
    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(
        document.querySelector(
          '[data-slot="pptx-slide"][data-slide-number="10"]'
        )
      ).toBeTruthy()
      expect(
        document.querySelector(
          '[data-slot="pptx-slide"][data-slide-number="1"]'
        )
      ).toBeNull()
    })
  })

  it("does not rewrite unchanged projection styles or reorder stable shells on scroll", async () => {
    const source = createFakePptxSource({ slideCount: 20 })
    const activity = createManualPptxActivity(false).activity
    const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty")
    const insertBefore = vi.spyOn(Node.prototype, "insertBefore")
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })

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

    await waitFor(() => {
      expect(document.querySelector('[data-slot="pptx-slide"]')).toBeTruthy()
    })

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setElementNumberProperty(viewport!, "clientHeight", 720)
    setElementNumberProperty(viewport!, "scrollTop", 0)
    setProperty.mockClear()
    insertBefore.mockClear()

    fireEvent.scroll(viewport!)

    expect(setProperty).not.toHaveBeenCalled()
    expect(insertBefore).not.toHaveBeenCalled()
  })

  it("positions virtual slide shells with transforms instead of top writes", async () => {
    const source = createFakePptxSource({ slideCount: 20 })
    const activity = createManualPptxActivity(false).activity

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

    await waitFor(() => {
      expect(document.querySelector('[data-slot="pptx-slide"]')).toBeTruthy()
    })

    const shell = document.querySelector<HTMLElement>(
      '[data-slot="pptx-slide-slot"]'
    )
    expect(shell?.style.top).toBe("")
    expect(shell?.style.transform).toBe("translate(-50%, 16px)")
  })

  it("does not render slides after a virtual shell leaves the window", async () => {
    const { activity, runIdle } = createManualPptxActivity()
    const source = createFakePptxSource({ slideCount: 20 })

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

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setElementNumberProperty(viewport!, "clientHeight", 720)
    setElementNumberProperty(viewport!, "scrollTop", 16 + 9 * 736)
    fireEvent.scroll(viewport!)

    await waitFor(() => {
      expect(
        document.querySelector(
          '[data-slot="pptx-slide"][data-slide-number="10"]'
        )
      ).toBeTruthy()
      expect(
        document.querySelector(
          '[data-slot="pptx-slide"][data-slide-number="1"]'
        )
      ).toBeNull()
    })

    await act(async () => {
      runIdle()
    })

    expect(renderedSlideIndexes(source)).not.toContain(0)
  })

  it("removes virtual slide shells when the scroller unmounts", async () => {
    const source = createFakePptxSource({ slideCount: 20 })
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

    await waitFor(() => {
      expect(document.querySelector('[data-slot="pptx-slide"]')).toBeTruthy()
    })

    view.unmount()

    expect(document.querySelector('[data-slot="pptx-slide"]')).toBeNull()
  })

  it("sizes slide frames from scaled rotated visible dimensions", () => {
    const source = createFakePptxSource()
    const activity = createManualPptxActivity(false).activity

    render(
      <PptxSlideScroller
        source={source}
        zoomScale={1.5}
        rotation={90}
        eager={false}
        activity={activity}
        containerRef={vi.fn()}
        viewportRef={vi.fn()}
        onScroll={vi.fn()}
      />
    )

    const frame = document.querySelector<HTMLElement>(
      '[data-slot="pptx-slide"]'
    )
    expect(frame?.style.width).toBe("1080px")
    expect(frame?.style.height).toBe("1440px")
  })

  it("does not surface a pending render error after a slide leaves the virtual window", async () => {
    const source = createFakePptxSource({ slideCount: 20 })
    const renderResult = deferred<PptxRenderResult>()
    source.renderSlide.mockReturnValueOnce(renderResult.promise)
    const activity = createManualPptxActivity(false).activity

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

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledWith(
        expect.objectContaining({ slideIndex: 0 })
      )
    })

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    expect(viewport).toBeTruthy()
    setElementNumberProperty(viewport!, "clientHeight", 720)
    setElementNumberProperty(viewport!, "scrollTop", 16 + 9 * 736)
    fireEvent.scroll(viewport!)

    await act(async () => {
      renderResult.resolve({
        status: "failed",
        error: new PptxRendererError("render_failed", "late failure"),
      })
    })

    expect(screen.queryByText("Couldn't render slide 1.")).toBeNull()
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

  it("falls back to DPR 1 for non-finite device pixel ratios", async () => {
    const source = createFakePptxSource()
    const activity = createManualPptxActivity(false).activity
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: Infinity,
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
          renderScale: 1.2,
          slideIndex: 0,
        })
      )
    })
  })

  it("retries a failed slide frame when the render scale changes", async () => {
    const source = createFakePptxSource()
    source.renderSlide
      .mockResolvedValueOnce({
        status: "failed",
        error: new PptxRendererError("render_failed", "bad"),
      })
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

  it("clears a failed slide frame when the source changes", async () => {
    const failedSource = createFakePptxSource()
    failedSource.renderSlide.mockResolvedValueOnce({
      status: "failed",
      error: new PptxRendererError("render_failed", "bad"),
    })
    const recoveredSource = createFakePptxSource()
    const activity = createManualPptxActivity(false).activity

    const view = render(
      <PptxSlideScroller
        source={failedSource}
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
          source={recoveredSource}
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

    await waitFor(() => {
      expect(recoveredSource.renderSlide).toHaveBeenCalledTimes(1)
      expect(screen.queryByText("Couldn't render slide 1.")).toBeNull()
    })
  })

  it("shows a slide error when renderSlide unexpectedly rejects", async () => {
    const source = createFakePptxSource()
    source.renderSlide.mockRejectedValueOnce(new Error("unexpected failure"))
    const activity = createManualPptxActivity(false).activity

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

    expect(await screen.findByText("Couldn't render slide 1.")).toBeTruthy()
  })

  it("ignores stale failed render results after a newer render succeeds", async () => {
    const source = createFakePptxSource()
    const firstRender = deferred<PptxRenderResult>()
    source.renderSlide
      .mockReturnValueOnce(firstRender.promise)
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

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(1)
    })

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
    })

    await act(async () => {
      firstRender.resolve({
        status: "failed",
        error: new PptxRendererError("render_failed", "stale"),
      })
    })

    expect(screen.queryByText("Couldn't render slide 1.")).toBeNull()
  })

  it("ignores stale successful render results after a newer render fails", async () => {
    const source = createFakePptxSource()
    const firstRender = deferred<PptxRenderResult>()
    source.renderSlide
      .mockReturnValueOnce(firstRender.promise)
      .mockResolvedValueOnce({
        status: "failed",
        error: new PptxRendererError("render_failed", "new failure"),
      })
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

    await waitFor(() => {
      expect(source.renderSlide).toHaveBeenCalledTimes(1)
    })

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

    expect(await screen.findByText("Couldn't render slide 1.")).toBeTruthy()

    await act(async () => {
      firstRender.resolve({ status: "rendered" })
    })

    expect(screen.getByText("Couldn't render slide 1.")).toBeTruthy()
  })

  it("keeps a mounted viewer source alive across cache eviction", async () => {
    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/mounted-retained.pptx")} />
    )
    await screen.findByText("Slide 1 of 1")

    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/mounted-evict-${i}.pptx`))
    }

    expect(pptxMock.destroy).not.toHaveBeenCalled()

    view.unmount()

    await waitFor(() => {
      expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
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

  it("ignores duplicate release calls after deferred source disposal", async () => {
    const source = await getPptxSource(pptxUrlResource("/double-release.pptx"))
    const release = source.retain()

    source.dispose()
    expect(pptxMock.destroy).not.toHaveBeenCalled()

    release()
    release()

    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
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

  it("disposes pending loads that resolve after the source cache is cleared", async () => {
    const load = deferred<undefined>()
    pptxMock.loadFile.mockImplementationOnce(() => load.promise)

    const sourcePromise = getPptxSource(
      pptxUrlResource("/pending-clear-dispose.pptx")
    )

    await waitFor(() => {
      expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)
    })

    resetPptxViewerForTests()
    load.resolve(undefined)
    const source = await sourcePromise

    await waitFor(() => {
      expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
    })
    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toMatchObject({ status: "failed" })
  })

  it("disposes pending loads that resolve after direct source eviction", async () => {
    const load = deferred<undefined>()
    pptxMock.loadFile.mockImplementationOnce(() => load.promise)
    const resource = pptxUrlResource("/pending-direct-evict.pptx")

    const sourcePromise = getPptxSource(resource)

    await waitFor(() => {
      expect(pptxMock.loadFile).toHaveBeenCalledTimes(1)
    })

    evictPptxSource(resource)
    load.resolve(undefined)
    const source = await sourcePromise

    await waitFor(() => {
      expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
    })
    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toMatchObject({ status: "failed" })
  })

  it("defers direct eviction of a retained loaded source until release", async () => {
    const resource = pptxUrlResource("/retained-direct-evict.pptx")
    const source = await getPptxSource(resource)
    const release = source.retain()

    evictPptxSource(resource)

    expect(pptxMock.destroy).not.toHaveBeenCalled()
    await expect(
      source.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toEqual({ status: "rendered" })

    release()

    expect(pptxMock.destroy).toHaveBeenCalledTimes(1)
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

  it("pins a still-loading deck so concurrent loads cannot evict or duplicate it", async () => {
    const load = deferred<undefined>()
    pptxMock.loadFile.mockImplementationOnce(() => load.promise)

    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/pinned-pending.pptx")} />
    )

    // Load enough other decks to overflow the size-4 source cache while the
    // first deck is still loading.
    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/pin-evictor-${i}.pptx`))
    }
    // One pending deck + four evictors: the pending entry is pinned, so an old
    // evictor is dropped instead of the still-loading deck.
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(5)

    load.resolve(undefined)
    expect(await screen.findByText("Slide 1 of 1")).toBeTruthy()

    // The Suspense retry must reuse the pinned entry rather than start a second
    // load and orphan the original renderer.
    expect(pptxMock.loadFile).toHaveBeenCalledTimes(5)
    expect(pptxMock.viewerOptions).toHaveLength(5)
    expect(screen.queryByText("Couldn't render slide 1.")).toBeNull()

    view.unmount()
  })

  it("lets a pinned deck become evictable once its load settles", async () => {
    const load = deferred<undefined>()
    pptxMock.loadFile.mockImplementationOnce(() => load.promise)

    const pinned = pptxUrlResource("/settles-then-evictable.pptx")
    const pinnedPromise = getPptxSource(pinned)

    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/settle-evictor-${i}.pptx`))
    }

    load.resolve(undefined)
    const pinnedSource = await pinnedPromise

    // After settling, the entry is evictable again: four more loads push it out
    // and dispose it (no retainer holds it).
    for (let i = 0; i < 4; i += 1) {
      await getPptxSource(pptxUrlResource(`/post-settle-evictor-${i}.pptx`))
    }

    await expect(
      pinnedSource.renderSlide({
        canvas: document.createElement("canvas"),
        renderScale: 1,
        slideIndex: 0,
      })
    ).resolves.toMatchObject({ status: "failed" })
  })

  it("shows the suspense fallback with the requested slide aspect ratio while loading", async () => {
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/pending-fallback.pptx")}
        fallbackSlideSize={{ width: 1600, height: 900 }}
      />
    )

    const skeleton = document.querySelector<HTMLElement>(
      '[data-slot="pptx-slide-skeleton"]'
    )
    expect(skeleton?.style.aspectRatio).toBe("1600 / 900")
    expect(screen.queryByText("Slide 1 of 1")).toBeNull()

    load.resolve(undefined)
    expect(await screen.findByText("Slide 1 of 1")).toBeTruthy()
    expect(
      document.querySelector('[data-slot="pptx-slide-skeleton"]')
    ).toBeNull()
  })

  it("keeps the bare layout while suspended on a pending load", async () => {
    const load = deferred<undefined>()
    pptxMock.loadFile.mockReturnValueOnce(load.promise)

    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/pending-bare.pptx")} bare />
    )

    const root = document.querySelector('[data-slot="pptx-viewer"]')
    expect(root?.classList.contains("h-full")).toBe(true)
    expect(root?.classList.contains("rounded-xl")).toBe(false)

    load.resolve(undefined)
    await screen.findByText("Slide 1 of 1")
    view.unmount()
  })

  it("combines zoom and rotation in the overlay geometry", async () => {
    const renderSlideOverlay = vi.fn(() => null)

    await renderPptx(
      <PptxViewer
        source={pptxUrlSource("/zoom-rotate-overlay.pptx")}
        scale={2}
        renderSlideOverlay={renderSlideOverlay}
      />
    )

    await screen.findByText("200%")
    // base 960x720 * 2 = 1920x1440, upright.
    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 1440,
          rotation: 0,
          scale: 2,
          width: 1920,
        })
      )
    })

    fireEvent.click(screen.getByLabelText("Rotate"))

    // Rotated a quarter turn swaps the scaled axes.
    await waitFor(() => {
      expect(renderSlideOverlay).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 1920,
          rotation: 90,
          scale: 2,
          width: 1440,
        })
      )
    })
  })

  it("sizes the slide frame to the zoomed slide in the full viewer", async () => {
    await renderPptx(
      <PptxViewer source={pptxUrlSource("/frame-size.pptx")} scale={2} />
    )

    await screen.findByText("200%")
    const frame = document.querySelector<HTMLElement>(
      '[data-slot="pptx-slide"]'
    )
    expect(frame?.style.width).toBe("1920px")
    expect(frame?.style.height).toBe("1440px")
  })

  it("offers a download of the original presentation after a load failure", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    pptxMock.loadFile.mockRejectedValue(new Error("bad deck"))

    await renderPptx(
      <PptxViewer
        source={{
          kind: "url",
          downloadUrl: "/download/original.pptx",
          fileName: "original.pptx",
          url: "/load-failure-download.pptx",
        }}
      />
    )

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Couldn't load this presentation.")
    const download = within(alert).getByRole("link", { name: /download/i })
    expect(download.getAttribute("href")).toBe("/download/original.pptx")
    expect(download.getAttribute("download")).toBe("original.pptx")
    expect(consoleError).toHaveBeenCalled()
  })

  it("clears a per-slide render error after switching to a working source", async () => {
    pptxMock.renderSlide.mockRejectedValueOnce(new Error("render failed"))

    const view = await renderPptx(
      <PptxViewer source={pptxUrlSource("/render-fail-then-fix.pptx")} />
    )

    expect(await screen.findByText("Couldn't render slide 1.")).toBeTruthy()

    await act(async () => {
      view.rerender(<PptxViewer source={pptxUrlSource("/render-fixed.pptx")} />)
    })

    await waitFor(() => {
      expect(screen.queryByText("Couldn't render slide 1.")).toBeNull()
    })
    expect(screen.getByText("Slide 1 of 1")).toBeTruthy()
  })
})
