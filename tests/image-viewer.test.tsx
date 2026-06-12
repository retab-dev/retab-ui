// @vitest-environment jsdom
import fs from "node:fs"
import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  type RenderResult,
} from "@testing-library/react"
// @ts-expect-error utif ships no type declarations.
import UTIF from "utif"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Source } from "@/registry/new-york-v4/lib/document-source"
import {
  createFrameSource,
  createNativeImageFrameSourceFromBlob,
  ImageFrameIndexError,
  ImageSourceDisposedError,
} from "@/registry/new-york-v4/lib/image-frame-source"
import { FrameSourceManager } from "@/registry/new-york-v4/lib/image-source-cache"
import {
  createTiffFrameSource,
  TiffWorkerClient,
  TiffWorkerError,
  type TiffWorkerRequest,
  type TiffWorkerResponse,
} from "@/registry/new-york-v4/lib/image-tiff-source"
import { ViewerFormatError } from "@/registry/new-york-v4/lib/viewer-errors"
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import {
  renderImageSourceOverlay,
  rotateImageArea,
} from "@/registry/new-york-v4/ui/image-source"
import {
  clearImageSourceCacheForTests,
  createImageSourceForTests,
  getImageSource,
  ImageViewer,
  looksLikeTiff,
  type ImageViewerHandle,
} from "@/registry/new-york-v4/ui/image-viewer"
import { ImageFrame } from "@/registry/new-york-v4/ui/image-viewer-frame"
import { ViewerErrorBoundary } from "@/registry/new-york-v4/ui/viewer-error"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  clearImageSourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function imageUrlSource(url: string, fileName?: string, mimeType?: string) {
  return { kind: "url" as const, url, fileName, mimeType }
}

function imageUrlResource(url: string, fileName?: string, mimeType?: string) {
  return createViewerResource(imageUrlSource(url, fileName, mimeType))
}

describe("ViewerResource registry", () => {
  it("interns URL resources by resolved descriptor identity", () => {
    const first = imageUrlResource("/same.png", "same.png")
    const second = imageUrlResource("/same.png", "same.png")
    const renamed = imageUrlResource("/same.png", "renamed.png")

    expect(second).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(renamed).not.toBe(first)
  })

  it("interns Blob resources only for the same Blob object and descriptor", async () => {
    const blob = new Blob(["first"], { type: "image/png" })
    const first = createViewerResource(
      blobSource(blob, {
        identityKey: "blob:same",
        fileName: "same.png",
      })
    )
    const second = createViewerResource(
      blobSource(blob, {
        identityKey: "blob:same",
        fileName: "same.png",
      })
    )
    const changedBytes = createViewerResource(
      blobSource(new Blob(["second"], { type: "image/png" }), {
        identityKey: "blob:same",
        fileName: "same.png",
      })
    )

    expect(second).toBe(first)
    expect(changedBytes).not.toBe(first)
    expect(changedBytes.cacheKey).not.toBe(first.cacheKey)
    await expect(first.readText()).resolves.toBe("first")
    await expect(changedBytes.readText()).resolves.toBe("second")
  })

  it("does not globally intern inline text payloads", async () => {
    const first = createViewerResource({
      kind: "text",
      text: "first",
      fileName: "same.txt",
      identityKey: "text:same",
    })
    const second = createViewerResource({
      kind: "text",
      text: "second",
      fileName: "same.txt",
      identityKey: "text:same",
    })

    expect(second).not.toBe(first)
    expect(second.cacheKey).not.toBe(first.cacheKey)
    await expect(first.readText()).resolves.toBe("first")
    await expect(second.readText()).resolves.toBe("second")
  })
})

function bitmap(width = 10, height = 10) {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function frameCount(count: number) {
  return Array.from({ length: count }, () => ({ width: 10, height: 10 }))
}

class FakeTiffWorker {
  onmessage: ((event: MessageEvent<TiffWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  readonly posts: {
    message: TiffWorkerRequest
    transfer: readonly Transferable[] | undefined
  }[] = []
  readonly terminate = vi.fn()

  postMessage(
    message: TiffWorkerRequest,
    transfer?: readonly Transferable[]
  ): void {
    this.posts.push({ message, transfer })
  }

  emit(message: TiffWorkerResponse) {
    this.onmessage?.({ data: message } as MessageEvent<TiffWorkerResponse>)
  }

  emitError(message = "worker failed") {
    this.onerror?.({ message } as ErrorEvent)
  }

  emitMessageError() {
    this.onmessageerror?.({} as MessageEvent)
  }
}

function createFakeWorkerClient() {
  const worker = new FakeTiffWorker()
  const client = new TiffWorkerClient(() => worker as unknown as Worker)
  return { worker, client }
}

function stubImageLoading(imageBitmap = bitmap()) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { "content-type": "image/png" },
        })
      )
    )
  )
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve(imageBitmap))
  )
}

function stubViewerLayout() {
  if (!HTMLElement.prototype.getAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    })
  }
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class IntersectionObserver {
      observe() {}
      disconnect() {}
    }
  )
}

function stubElementClientWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width)
}

function stubElementClientSize(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(height)
}

function stubObservableLayout({
  frameListWidth = 320,
  clientHeight = 240,
  isIntersecting = true,
}: {
  frameListWidth?: number
  clientHeight?: number
  isIntersecting?: boolean
} = {}) {
  stubElementClientSize(frameListWidth, clientHeight)
  if (!HTMLElement.prototype.getAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    })
  }
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      disconnect() {}
    }
  )

  const observers: Array<{
    callback: IntersectionObserverCallback
    elements: Element[]
  }> = []
  vi.stubGlobal(
    "IntersectionObserver",
    class FakeIntersectionObserver {
      readonly callback: IntersectionObserverCallback
      readonly elements: Element[] = []

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        observers.push({ callback, elements: this.elements })
      }

      observe(element: Element) {
        this.elements.push(element)
        queueMicrotask(() => {
          this.callback(
            [
              {
                target: element,
                isIntersecting,
              } as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver
          )
        })
      }

      disconnect() {}
    }
  )

  return {
    triggerAll(nextIsIntersecting: boolean) {
      for (const observer of observers) {
        observer.callback(
          observer.elements.map(
            (element) =>
              ({
                target: element,
                isIntersecting: nextIsIntersecting,
              }) as IntersectionObserverEntry
          ),
          {} as IntersectionObserver
        )
      }
    },
  }
}

function stubCanvasContext() {
  const context = {
    drawImage: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    imageSmoothingQuality: "low",
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  )
  return context
}

function stubTiffMetadataLoading(
  frames: readonly { width: number; height: number }[]
) {
  class MetadataWorker extends FakeTiffWorker {
    override postMessage(
      message: TiffWorkerRequest,
      transfer?: readonly Transferable[]
    ): void {
      super.postMessage(message, transfer)
      if (message.type === "init") {
        queueMicrotask(() => {
          this.emit({
            type: "initOk",
            frames: frames.map((frame) => ({
              intrinsicSize: { width: frame.width, height: frame.height },
            })),
          })
        })
      }
    }
  }

  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(new ArrayBuffer(4), {
          headers: { "content-type": "image/tiff" },
        })
      )
    )
  )
  vi.stubGlobal("Worker", MetadataWorker)
}

async function waitForWorkerPost(worker: FakeTiffWorker) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (worker.posts.length > 0) return
    await Promise.resolve()
  }
  throw new Error("TIFF worker did not receive a message")
}

describe("ImageViewer TIFF detection", () => {
  it("detects TIFFs by extension, content type, and magic bytes", () => {
    expect(looksLikeTiff("/scan.tif", null, new ArrayBuffer(4))).toBe(true)
    expect(looksLikeTiff("/scan", "image/tiff", new ArrayBuffer(4))).toBe(true)
    expect(
      looksLikeTiff("/scan", null, Uint8Array.of(0x49, 0x49, 0x2a, 0).buffer)
    ).toBe(true)
    expect(
      looksLikeTiff("/scan", null, Uint8Array.of(0x4d, 0x4d, 0, 0x2a).buffer)
    ).toBe(true)
    expect(
      looksLikeTiff("/scan.png", "image/png", Uint8Array.of(1, 2, 3, 4).buffer)
    ).toBe(false)
  })

  it("decodes the real TIFF demo fixture with UTIF", () => {
    const bytes = fs.readFileSync("public/samples/nvidia-10q-scan.tiff")
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    )
    const ifds = UTIF.decode(arrayBuffer)
    const firstFrame = ifds[0]

    expect(ifds.length).toBeGreaterThan(0)
    expect(firstFrame.t256?.[0] ?? firstFrame.width).toBe(1275)
    expect(firstFrame.t257?.[0] ?? firstFrame.height).toBe(1650)

    UTIF.decodeImage(arrayBuffer, firstFrame)
    const rgba = UTIF.toRGBA8(firstFrame)

    expect(rgba.length).toBe(1275 * 1650 * 4)
  })
})

describe("ImageSource lifecycle", () => {
  it("shares concurrent frame decodes for the same frame", async () => {
    const decodedBitmap = bitmap()
    const decode = vi.fn(() => Promise.resolve(decodedBitmap))
    const source = createImageSourceForTests("tiff", frameCount(1), decode)

    const first = source.acquire(0)
    const second = source.acquire(0)

    await expect(first).resolves.toBe(decodedBitmap)
    await expect(second).resolves.toBe(decodedBitmap)
    expect(decode).toHaveBeenCalledTimes(1)
  })

  it("clears failed in-flight decodes so a frame can retry", async () => {
    let attempts = 0
    const secondBitmap = bitmap()
    const source = createImageSourceForTests(
      "tiff",
      frameCount(1),
      async () => {
        attempts += 1
        if (attempts === 1) throw new Error("decode failed")
        return secondBitmap
      }
    )

    await expect(source.acquire(0)).rejects.toThrow("decode failed")
    await expect(source.acquire(0)).resolves.toBe(secondBitmap)
    expect(attempts).toBe(2)
  })

  it("does not leak frame pins when a shared in-flight decode fails", async () => {
    let attempts = 0
    const recoveredBitmap = bitmap()
    const nextFrameBitmap = bitmap()
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(2).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: async (frameIndex) => {
        if (frameIndex === 0) {
          attempts += 1
          if (attempts === 1) throw new Error("shared decode failed")
          return recoveredBitmap
        }
        return nextFrameBitmap
      },
    })

    const first = source.acquire(0)
    const second = source.acquire(0)
    await expect(first).rejects.toThrow("Image decode failed")
    await expect(second).rejects.toThrow("Image decode failed")

    await expect(source.acquire(0)).resolves.toBe(recoveredBitmap)
    source.release(0)
    await expect(source.acquire(1)).resolves.toBe(nextFrameBitmap)
    source.release(1)

    expect(recoveredBitmap.close).toHaveBeenCalledTimes(1)
    expect(nextFrameBitmap.close).not.toHaveBeenCalled()
    source.dispose()
  })

  it("keeps a shared in-flight decode alive until every consumer releases it", async () => {
    const pending = deferred<ImageBitmap>()
    const decodedBitmap = bitmap()
    const cancelDecode = vi.fn()
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(1).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: () => pending.promise,
      cancelDecode,
    })

    const first = source.acquire(0)
    const second = source.acquire(0)
    source.release(0)
    pending.resolve(decodedBitmap)

    await expect(first).resolves.toBe(decodedBitmap)
    await expect(second).resolves.toBe(decodedBitmap)
    expect(cancelDecode).not.toHaveBeenCalled()

    source.release(0)
    source.dispose()
  })

  it("cleans up and retries when a decoder throws synchronously", async () => {
    let attempts = 0
    const recoveredBitmap = bitmap()
    const nextFrameBitmap = bitmap()
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(2).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: (frameIndex) => {
        if (frameIndex === 0) {
          attempts += 1
          if (attempts === 1) throw new Error("sync decode failed")
          return Promise.resolve(recoveredBitmap)
        }
        return Promise.resolve(nextFrameBitmap)
      },
    })

    await expect(source.acquire(0)).rejects.toThrow("Image decode failed")
    await expect(source.acquire(0)).resolves.toBe(recoveredBitmap)
    source.release(0)
    await expect(source.acquire(1)).resolves.toBe(nextFrameBitmap)
    source.release(1)

    expect(attempts).toBe(2)
    expect(recoveredBitmap.close).toHaveBeenCalledTimes(1)
    source.dispose()
  })

  it("rejects pending decodes on dispose and closes late decoded bitmaps", async () => {
    const pending = deferred<ImageBitmap>()
    const lateBitmap = bitmap()
    const onDispose = vi.fn()
    const source = createImageSourceForTests(
      "tiff",
      frameCount(1),
      () => pending.promise,
      onDispose
    )

    const acquired = source.acquire(0)
    source.dispose(new Error("disposed by test"))
    pending.resolve(lateBitmap)

    await expect(acquired).rejects.toThrow("disposed by test")
    await Promise.resolve()
    expect(onDispose).toHaveBeenCalledTimes(1)
    expect(lateBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("cancels in-flight decodes when the source is disposed", async () => {
    const pending = deferred<ImageBitmap>()
    const lateBitmap = bitmap()
    const cancelDecode = vi.fn()
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(1).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: () => pending.promise,
      cancelDecode,
    })

    const acquired = source.acquire(0)
    source.dispose(new Error("viewer closed"))
    pending.resolve(lateBitmap)

    await expect(acquired).rejects.toThrow("viewer closed")
    expect(cancelDecode).toHaveBeenCalledWith(0, expect.any(Error))
    await Promise.resolve()
    expect(lateBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("closes least-recent unpinned bitmaps past the decoded-frame cap", async () => {
    const bitmaps = Array.from({ length: 17 }, () => bitmap())
    const source = createImageSourceForTests(
      "tiff",
      frameCount(17),
      async (i) => {
        return bitmaps[i]
      }
    )

    for (let i = 0; i < bitmaps.length; i += 1) {
      await source.acquire(i)
      source.release(i)
    }

    expect(bitmaps[0].close).toHaveBeenCalledTimes(1)
    source.dispose()
  })

  it("closes cached bitmaps on dispose", async () => {
    const decodedBitmap = bitmap()
    const source = createImageSourceForTests(
      "tiff",
      frameCount(1),
      async () => decodedBitmap
    )

    await source.acquire(0)
    source.release(0)
    source.dispose()

    expect(decodedBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("keeps pinned bitmaps while evicting unpinned bitmaps", async () => {
    const bitmaps = [bitmap(), bitmap(), bitmap()]
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(3).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 2,
      decode: async (frameIndex) => bitmaps[frameIndex],
    })

    await source.acquire(0)
    await source.acquire(1)
    source.release(1)
    await source.acquire(2)

    expect(bitmaps[0].close).not.toHaveBeenCalled()
    expect(bitmaps[1].close).toHaveBeenCalledTimes(1)
    expect(bitmaps[2].close).not.toHaveBeenCalled()
    source.dispose()
  })

  it("tracks multiple pins for the same decoded frame", async () => {
    const bitmaps = [bitmap(), bitmap()]
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(2).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: async (frameIndex) => bitmaps[frameIndex],
    })

    await source.acquire(0)
    await source.acquire(0)
    source.release(0)
    await source.acquire(1)

    expect(bitmaps[0].close).not.toHaveBeenCalled()
    source.release(0)
    expect(bitmaps[0].close).toHaveBeenCalledTimes(1)
    source.dispose()
  })

  it("keeps cached frame pins independent from later cache hits", async () => {
    const bitmaps = [bitmap(), bitmap()]
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(2).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: async (frameIndex) => bitmaps[frameIndex],
    })

    await source.acquire(0)
    source.release(0)
    await source.acquire(0)
    await source.acquire(0)
    source.release(0)
    await source.acquire(1)

    expect(bitmaps[0].close).not.toHaveBeenCalled()
    source.release(0)
    expect(bitmaps[0].close).toHaveBeenCalledTimes(1)
    source.dispose()
  })

  it("cancels an unpinned in-flight frame decode", async () => {
    const pending = deferred<ImageBitmap>()
    const lateBitmap = bitmap()
    const cancelDecode = vi.fn()
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(1).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: () => pending.promise,
      cancelDecode,
    })

    const acquired = source.acquire(0)
    source.release(0)
    pending.resolve(lateBitmap)

    await expect(acquired).rejects.toThrow("Image frame decode canceled")
    expect(cancelDecode).toHaveBeenCalledTimes(1)
    expect(lateBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("does not throw from release when decode cancellation fails", async () => {
    const pending = deferred<ImageBitmap>()
    const lateBitmap = bitmap()
    const cancelDecode = vi.fn(() => {
      throw new Error("cancel transport failed")
    })
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(1).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: () => pending.promise,
      cancelDecode,
    })

    const acquired = source.acquire(0)
    expect(() => source.release(0)).not.toThrow()
    pending.resolve(lateBitmap)

    await expect(acquired).rejects.toThrow("Image frame decode canceled")
    expect(cancelDecode).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(lateBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("continues source disposal when decode cancellation fails", async () => {
    const pending = deferred<ImageBitmap>()
    const lateBitmap = bitmap()
    const cancelDecode = vi.fn(() => {
      throw new Error("cancel transport failed")
    })
    const onDispose = vi.fn()
    const source = createFrameSource({
      kind: "tiff",
      frames: frameCount(1).map((frame) => ({
        intrinsicSize: { width: frame.width, height: frame.height },
      })),
      maxDecodedFrames: 1,
      decode: () => pending.promise,
      cancelDecode,
      onDispose,
    })

    const acquired = source.acquire(0)
    expect(() => source.dispose(new Error("viewer closed"))).not.toThrow()
    pending.resolve(lateBitmap)

    await expect(acquired).rejects.toThrow("viewer closed")
    expect(cancelDecode).toHaveBeenCalledTimes(1)
    expect(onDispose).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(lateBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("reuses the native image probe bitmap for the first acquire", async () => {
    const probeBitmap = bitmap(30, 40)
    const createImageBitmap = vi.fn(() => Promise.resolve(probeBitmap))
    vi.stubGlobal("createImageBitmap", createImageBitmap)

    const source = await createNativeImageFrameSourceFromBlob(new Blob(), 16)
    await expect(source.acquire(0)).resolves.toBe(probeBitmap)

    expect(createImageBitmap).toHaveBeenCalledTimes(1)
    source.release(0)
    source.dispose()
    expect(probeBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("rejects invalid frame indexes before decode", async () => {
    const decode = vi.fn(() => Promise.resolve(bitmap()))
    const source = createImageSourceForTests("tiff", frameCount(1), decode)

    await expect(source.acquire(-1)).rejects.toBeInstanceOf(
      ImageFrameIndexError
    )
    await expect(source.acquire(1)).rejects.toBeInstanceOf(ImageFrameIndexError)
    await expect(source.acquire(0.5)).rejects.toBeInstanceOf(
      ImageFrameIndexError
    )
    expect(() => source.release(-1)).not.toThrow()
    expect(decode).not.toHaveBeenCalled()
  })

  it("models invalid frame indexes as format errors", async () => {
    const source = createImageSourceForTests("tiff", frameCount(1), vi.fn())

    await expect(source.acquire(1)).rejects.toMatchObject({
      format: "image",
      kind: "index_out_of_range",
    })
    await expect(source.acquire(1)).rejects.toBeInstanceOf(ViewerFormatError)
  })

  it("removes rejected source loads from the cache so later loads retry", async () => {
    const fetch = vi.fn()
    fetch
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { "content-type": "image/png" },
        })
      )
    vi.stubGlobal("fetch", fetch)
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve(bitmap()))
    )

    await expect(
      getImageSource(imageUrlResource("/retry.png"))
    ).rejects.toThrow("Failed to load resource: 500")
    await expect(
      getImageSource(imageUrlResource("/retry.png"))
    ).resolves.toMatchObject({
      kind: "native-image",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe("FrameSourceManager lifecycle", () => {
  it("shares in-flight loads for the same resource identity", async () => {
    const manager = new FrameSourceManager()
    stubImageLoading()

    const first = manager.load(
      imageUrlResource("/shared.png"),
      () => new Worker("")
    )
    const second = manager.load(
      imageUrlResource("/shared.png"),
      () => new Worker("")
    )

    expect(first).toBe(second)
    await expect(first).resolves.toMatchObject({ kind: "native-image" })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("removes rejected source loads from the cache so later loads retry", async () => {
    const manager = new FrameSourceManager()
    const fetch = vi.fn()
    fetch
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { "content-type": "image/png" },
        })
      )
    vi.stubGlobal("fetch", fetch)
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve(bitmap()))
    )

    await expect(
      manager.load(imageUrlResource("/retry.png"), () => new Worker(""))
    ).rejects.toThrow("Failed to load resource: 500")
    await expect(
      manager.load(imageUrlResource("/retry.png"), () => new Worker(""))
    ).resolves.toMatchObject({ kind: "native-image" })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("aborts pending fetches when cleared", async () => {
    const manager = new FrameSourceManager()
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      "fetch",
      vi.fn((_src: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"))
          })
        })
      })
    )

    const load = manager.load(
      imageUrlResource("/abort.png"),
      () => new Worker("")
    )
    await Promise.resolve()
    manager.clear()

    expect(signal?.aborted).toBe(true)
    await expect(load).rejects.toThrow("Loading was cancelled.")
  })

  it("loads declared native images from a blob without materializing an ArrayBuffer", async () => {
    const manager = new FrameSourceManager()
    const blob = new Blob([Uint8Array.of(1, 2, 3, 4)], { type: "image/png" })
    const response = {
      ok: true,
      headers: { get: vi.fn(() => "image/png") },
      blob: vi.fn(() => Promise.resolve(blob)),
      arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(4))),
    } as unknown as Response
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response))
    )
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve(bitmap()))
    )

    await expect(
      manager.load(
        imageUrlResource("/declared-native.png"),
        () => new Worker("")
      )
    ).resolves.toMatchObject({ kind: "native-image" })

    expect(response.blob).toHaveBeenCalledTimes(1)
    expect(response.arrayBuffer).not.toHaveBeenCalled()
  })

  it("loads declared TIFF images from an ArrayBuffer", async () => {
    const manager = new FrameSourceManager()
    const worker = new FakeTiffWorker()
    const response = {
      ok: true,
      headers: { get: vi.fn(() => "image/tiff") },
      blob: vi.fn(() => Promise.resolve(new Blob())),
      arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(4))),
    } as unknown as Response
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response))
    )

    const load = manager.load(
      imageUrlResource("/declared.tiff"),
      () => worker as unknown as Worker
    )
    await waitForWorkerPost(worker)

    expect(response.arrayBuffer).toHaveBeenCalledTimes(1)
    expect(response.blob).not.toHaveBeenCalled()
    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
    })
    await expect(load).resolves.toMatchObject({ kind: "tiff" })
  })

  it("sniffs unknown TIFF responses from bytes", async () => {
    const manager = new FrameSourceManager()
    const worker = new FakeTiffWorker()
    const response = {
      ok: true,
      headers: { get: vi.fn(() => null) },
      blob: vi.fn(() =>
        Promise.resolve(new Blob([Uint8Array.of(0x49, 0x49, 0x2a, 0)]))
      ),
      arrayBuffer: vi.fn(() =>
        Promise.resolve(Uint8Array.of(0x49, 0x49, 0x2a, 0).buffer)
      ),
    } as unknown as Response
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response))
    )

    const load = manager.load(
      imageUrlResource("/unknown"),
      () => worker as unknown as Worker
    )
    await waitForWorkerPost(worker)

    expect(response.blob).toHaveBeenCalledTimes(1)
    expect(response.arrayBuffer).not.toHaveBeenCalled()
    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
    })
    await expect(load).resolves.toMatchObject({ kind: "tiff" })
  })

  it("loads unknown native responses as a blob without full ArrayBuffer buffering", async () => {
    const manager = new FrameSourceManager()
    const responseBlob = new Blob([Uint8Array.of(1, 2, 3, 4)], {
      type: "image/png",
    })
    const clone = {
      blob: vi.fn(() => Promise.resolve(responseBlob)),
    }
    const response = {
      ok: true,
      headers: { get: vi.fn(() => null) },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Uint8Array.of(1, 2))
          controller.enqueue(Uint8Array.of(3, 4))
          controller.close()
        },
      }),
      blob: vi.fn(() => Promise.resolve(responseBlob)),
      arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(4))),
      clone: vi.fn(() => clone),
    } as unknown as Response
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response))
    )
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.resolve(bitmap()))
    )

    await expect(
      manager.load(imageUrlResource("/unknown-native"), () => new Worker(""))
    ).resolves.toMatchObject({ kind: "native-image" })

    expect(response.arrayBuffer).not.toHaveBeenCalled()
    expect(response.blob).toHaveBeenCalledTimes(1)
    expect(response.clone).not.toHaveBeenCalled()
    expect(clone.blob).not.toHaveBeenCalled()
  })

  it("disposes the source after the last lease release settles", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager()
    stubImageLoading()
    const source = await manager.load(
      imageUrlResource("/lease.png"),
      () => new Worker("")
    )
    const dispose = vi.spyOn(source, "dispose")

    const firstLease = manager.retain(imageUrlResource("/lease.png"), source)
    const secondLease = manager.retain(imageUrlResource("/lease.png"), source)

    firstLease?.release()
    expect(dispose).not.toHaveBeenCalled()
    secondLease?.release()
    expect(dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)

    expect(dispose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("cancels last-release disposal when the source is retained again", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager()
    stubImageLoading()
    const source = await manager.load(
      imageUrlResource("/lease-again.png"),
      () => new Worker("")
    )
    const dispose = vi.spyOn(source, "dispose")

    const firstLease = manager.retain(
      imageUrlResource("/lease-again.png"),
      source
    )
    firstLease?.release()
    const secondLease = manager.retain(
      imageUrlResource("/lease-again.png"),
      source
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(dispose).not.toHaveBeenCalled()
    secondLease?.release()
    await vi.advanceTimersByTimeAsync(0)

    expect(dispose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("ignores duplicate lease releases", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager()
    stubImageLoading()
    const source = await manager.load(
      imageUrlResource("/duplicate-release.png"),
      () => new Worker("")
    )
    const dispose = vi.spyOn(source, "dispose")
    const lease = manager.retain(
      imageUrlResource("/duplicate-release.png"),
      source
    )

    lease?.release()
    lease?.release()
    await vi.advanceTimersByTimeAsync(0)

    expect(dispose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("marks pending loads for disposal when cleared", async () => {
    const manager = new FrameSourceManager()
    const pendingBitmap = deferred<ImageBitmap>()
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3, 4]), {
            headers: { "content-type": "image/png" },
          })
        )
      )
    )
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => pendingBitmap.promise)
    )

    const load = manager.load(
      imageUrlResource("/pending.png"),
      () => new Worker("")
    )
    await Promise.resolve()
    manager.clear()
    pendingBitmap.resolve(bitmap())

    await expect(load).rejects.toThrow("Image source was disposed before use")
  })

  it("disposes resolved unclaimed sources after the unclaimed timeout", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager({ unclaimedSourceTimeoutMs: 50 })
    stubImageLoading()
    const source = await manager.load(
      imageUrlResource("/unclaimed.png"),
      () => new Worker("")
    )
    const dispose = vi.spyOn(source, "dispose")

    await vi.advanceTimersByTimeAsync(49)
    expect(dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(dispose).toHaveBeenCalledTimes(1)
    const retry = manager.load(
      imageUrlResource("/unclaimed.png"),
      () => new Worker("")
    )
    await expect(retry).resolves.toMatchObject({ kind: "native-image" })
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("cancels unclaimed disposal when a source is retained", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager({ unclaimedSourceTimeoutMs: 50 })
    stubImageLoading()
    const source = await manager.load(
      imageUrlResource("/claimed.png"),
      () => new Worker("")
    )
    const dispose = vi.spyOn(source, "dispose")
    const lease = manager.retain(imageUrlResource("/claimed.png"), source)

    await vi.advanceTimersByTimeAsync(50)
    expect(dispose).not.toHaveBeenCalled()
    lease?.release()
    await vi.advanceTimersByTimeAsync(0)
    expect(dispose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("cancels unclaimed timers when cleared", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager({ unclaimedSourceTimeoutMs: 50 })
    stubImageLoading()
    const source = await manager.load(
      imageUrlResource("/clear-unclaimed.png"),
      () => new Worker("")
    )
    const dispose = vi.spyOn(source, "dispose")

    manager.clear()
    await vi.advanceTimersByTimeAsync(50)

    expect(dispose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe("TiffWorkerClient", () => {
  it("posts init bytes with transfer and resolves frame descriptors", async () => {
    const { worker, client } = createFakeWorkerClient()
    const buffer = new ArrayBuffer(4)
    const initialized = client.init(buffer)

    expect(worker.posts[0]).toEqual({
      message: { type: "init", buffer },
      transfer: [buffer],
    })

    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 12, height: 34 } }],
    })
    await expect(initialized).resolves.toEqual([
      { intrinsicSize: { width: 12, height: 34 } },
    ])
  })

  it("rejects init errors with TiffWorkerError", async () => {
    const { worker, client } = createFakeWorkerClient()
    const initialized = client.init(new ArrayBuffer(4))

    worker.emit({ type: "initError", message: "bad tiff" })

    await expect(initialized).rejects.toBeInstanceOf(TiffWorkerError)
    await expect(initialized).rejects.toThrow("bad tiff")
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it("rejects pending decode requests when TIFF initialization fails", async () => {
    const { worker, client } = createFakeWorkerClient()
    const initialized = client.init(new ArrayBuffer(4))
    const decoded = client.decode(0)

    worker.emit({ type: "initError", message: "bad tiff" })
    await expect(initialized).rejects.toThrow("bad tiff")
    await expect(decoded).rejects.toThrow("bad tiff")
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it("terminates the worker if the init post cannot be sent", async () => {
    const { worker, client } = createFakeWorkerClient()
    vi.spyOn(worker, "postMessage").mockImplementation(() => {
      throw new Error("message port closed")
    })

    await expect(client.init(new ArrayBuffer(4))).rejects.toThrow(
      "Failed to initialize TIFF worker"
    )
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    await expect(client.decode(0)).rejects.toThrow("TIFF worker disposed")
  })

  it("rejects duplicate initialization without orphaning the first init", async () => {
    const { worker, client } = createFakeWorkerClient()
    const first = client.init(new ArrayBuffer(4))
    const second = client.init(new ArrayBuffer(4))

    await expect(second).rejects.toThrow("TIFF worker already initializing")
    expect(worker.posts.map((post) => post.message.type)).toEqual(["init"])

    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 8, height: 9 } }],
    })

    await expect(first).resolves.toEqual([
      { intrinsicSize: { width: 8, height: 9 } },
    ])
  })

  it("rejects initialization after the TIFF worker is already initialized", async () => {
    const { worker, client } = createFakeWorkerClient()
    const initialized = client.init(new ArrayBuffer(4))
    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 7, height: 11 } }],
    })

    await expect(initialized).resolves.toEqual([
      { intrinsicSize: { width: 7, height: 11 } },
    ])
    await expect(client.init(new ArrayBuffer(4))).rejects.toThrow(
      "TIFF worker already initialized"
    )
    expect(worker.posts.map((post) => post.message.type)).toEqual(["init"])
  })

  it("posts decode requests with unique ids and resolves the matching bitmap", async () => {
    const { worker, client } = createFakeWorkerClient()
    const first = client.decode(3)
    const second = client.decode(4)
    const firstBitmap = bitmap()
    const secondBitmap = bitmap()

    expect(worker.posts.map((post) => post.message)).toEqual([
      { type: "decodeFrame", requestId: 0, frameIndex: 3 },
      { type: "decodeFrame", requestId: 1, frameIndex: 4 },
    ])

    worker.emit({ type: "decodeFrameOk", requestId: 1, bitmap: secondBitmap })
    worker.emit({ type: "decodeFrameOk", requestId: 0, bitmap: firstBitmap })

    await expect(first).resolves.toBe(firstBitmap)
    await expect(second).resolves.toBe(secondBitmap)
  })

  it("rejects only the matching decode request on decodeFrameError", async () => {
    const { worker, client } = createFakeWorkerClient()
    const first = client.decode(0)
    const second = client.decode(1)
    const secondBitmap = bitmap()

    worker.emit({
      type: "decodeFrameError",
      requestId: 0,
      message: "frame failed",
    })
    worker.emit({ type: "decodeFrameOk", requestId: 1, bitmap: secondBitmap })

    await expect(first).rejects.toThrow("frame failed")
    await expect(second).resolves.toBe(secondBitmap)
  })

  it("terminates the worker if a decode request cannot be sent", async () => {
    const { worker, client } = createFakeWorkerClient()
    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 12, height: 12 } }],
    })
    vi.spyOn(worker, "postMessage").mockImplementation(() => {
      throw new Error("message port closed")
    })

    await expect(client.decode(0)).rejects.toThrow(
      "Failed to request TIFF frame decode"
    )
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    await expect(client.decode(1)).rejects.toThrow("TIFF worker disposed")
  })

  it("cancels pending decode requests and closes late worker bitmaps", async () => {
    const { worker, client } = createFakeWorkerClient()
    const decoded = client.decode(2)

    client.cancelDecode(2, new Error("not visible"))

    expect(worker.posts.map((post) => post.message)).toEqual([
      { type: "decodeFrame", requestId: 0, frameIndex: 2 },
      { type: "cancelDecode", requestId: 0 },
    ])
    await expect(decoded).rejects.toThrow("not visible")

    const lateBitmap = bitmap()
    worker.emit({ type: "decodeFrameOk", requestId: 0, bitmap: lateBitmap })
    expect(lateBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("rejects init and pending decodes on worker errors", async () => {
    const { worker, client } = createFakeWorkerClient()
    const initialized = client.init(new ArrayBuffer(4))
    const decoded = client.decode(0)

    worker.emitError("transport failed")

    await expect(initialized).rejects.toThrow("transport failed")
    await expect(decoded).rejects.toThrow("transport failed")
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    await expect(client.decode(1)).rejects.toThrow("TIFF worker disposed")
  })

  it("rejects pending decodes on message errors", async () => {
    const { worker, client } = createFakeWorkerClient()
    const decoded = client.decode(0)

    worker.emitMessageError()

    await expect(decoded).rejects.toThrow("TIFF worker sent an unreadable")
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it("rejects pending work and terminates on dispose", async () => {
    const { worker, client } = createFakeWorkerClient()
    const initialized = client.init(new ArrayBuffer(4))
    const decoded = client.decode(0)

    client.dispose(new Error("closed"))

    await expect(initialized).rejects.toThrow("closed")
    await expect(decoded).rejects.toThrow("closed")
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it("closes unexpected late decoded bitmaps", async () => {
    const { worker, client } = createFakeWorkerClient()
    const lateBitmap = bitmap()

    client.dispose()
    worker.emit({ type: "decodeFrameOk", requestId: 9, bitmap: lateBitmap })

    expect(lateBitmap.close).toHaveBeenCalledTimes(1)
  })

  it("creates a TIFF frame source backed by the worker client", async () => {
    const worker = new FakeTiffWorker()
    const sourcePromise = createTiffFrameSource(
      new ArrayBuffer(4),
      () => worker as unknown as Worker,
      2
    )
    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 20, height: 30 } }],
    })
    const source = await sourcePromise
    const acquired = source.acquire(0)
    const decodedBitmap = bitmap()

    worker.emit({ type: "decodeFrameOk", requestId: 0, bitmap: decodedBitmap })

    await expect(acquired).resolves.toBe(decodedBitmap)
    source.dispose()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})

describe("ImageFrame rendering lifecycle", () => {
  it("does not acquire a frame until the frame is near the viewport", async () => {
    const layout = stubObservableLayout({ isIntersecting: false })
    stubCanvasContext()
    const decode = vi.fn(() => Promise.resolve(bitmap(30, 20)))
    const source = createImageSourceForTests("image", frameCount(1), decode)

    render(<ImageFrame source={source} frameIndex={0} scale={1} rotation={0} />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(decode).not.toHaveBeenCalled()

    await act(async () => {
      layout.triggerAll(true)
    })

    await waitFor(() => expect(decode).toHaveBeenCalledTimes(1))
  })

  it("draws an observed frame at device-pixel size and releases it on unmount", async () => {
    stubObservableLayout()
    const context = stubCanvasContext()
    vi.stubGlobal("devicePixelRatio", 2)
    const decodedBitmap = bitmap(50, 20)
    const source = createImageSourceForTests(
      "image",
      [{ width: 50, height: 20 }],
      vi.fn(() => Promise.resolve(decodedBitmap))
    )
    const release = vi.spyOn(source, "release")

    const { container, unmount } = render(
      <ImageFrame source={source} frameIndex={0} scale={2} rotation={90} />
    )

    const canvas = await waitFor(() => {
      const element = container.querySelector("canvas")
      expect(element).toBeTruthy()
      return element as HTMLCanvasElement
    })
    await waitFor(() => expect(context.drawImage).toHaveBeenCalledTimes(1))

    expect(canvas.width).toBe(80)
    expect(canvas.height).toBe(200)
    expect(context.scale).toHaveBeenCalledWith(2, 2)
    expect(context.translate).toHaveBeenCalledWith(20, 50)
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(context.drawImage).toHaveBeenCalledWith(
      decodedBitmap,
      -50,
      -20,
      100,
      40
    )

    unmount()
    expect(release).toHaveBeenCalledWith(0)
  })

  it("surfaces non-disposal decode failures through the image error boundary", async () => {
    stubObservableLayout()
    stubCanvasContext()
    const source = createImageSourceForTests("image", frameCount(1), () =>
      Promise.reject(new Error("source already gone"))
    )
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ViewerErrorBoundary format="image">
        <ImageFrame source={source} frameIndex={0} scale={1} rotation={0} />
      </ViewerErrorBoundary>
    )

    await waitFor(() => {
      const alert = screen.getByRole("alert")
      expect(alert.getAttribute("data-error-kind")).toBe("decode_failed")
      expect(alert.getAttribute("data-error-message")).toBe(
        "Image decode failed"
      )
    })
    expect(consoleError).toHaveBeenCalledWith(
      "Viewer failed to render.",
      expect.any(Error)
    )
  })

  it("ignores source-disposal decode errors during frame teardown", async () => {
    stubObservableLayout()
    stubCanvasContext()
    const source = createImageSourceForTests("image", frameCount(1), () =>
      Promise.reject(new ImageSourceDisposedError("teardown"))
    )
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ViewerErrorBoundary format="image">
        <ImageFrame source={source} frameIndex={0} scale={1} rotation={0} />
      </ViewerErrorBoundary>
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByText("Couldn't load this image.")).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("restores the canvas context when drawing a frame throws", async () => {
    stubObservableLayout()
    const context = stubCanvasContext()
    context.drawImage.mockImplementation(() => {
      throw new Error("draw failed")
    })
    const source = createImageSourceForTests("image", frameCount(1), () =>
      Promise.resolve(bitmap(20, 20))
    )
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ViewerErrorBoundary format="image">
        <ImageFrame source={source} frameIndex={0} scale={1} rotation={0} />
      </ViewerErrorBoundary>
    )

    await waitFor(() => {
      const alert = screen.getByRole("alert")
      expect(alert.getAttribute("data-error-kind")).toBe("decode_failed")
      expect(alert.getAttribute("data-error-message")).toBe(
        "Image decode failed"
      )
    })
    expect(context.restore).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      "Viewer failed to render.",
      expect.any(Error)
    )
  })
})

describe("ImageViewer scale semantics", () => {
  it("treats scale as controlled when provided", async () => {
    stubImageLoading(bitmap(20, 10))
    stubViewerLayout()

    let view!: RenderResult
    await act(async () => {
      view = render(
        <ImageViewer source={imageUrlSource("/scale.png")} scale={2} />
      )
    })

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "span" &&
          element.textContent === "200%"
      )
    ).toBeTruthy()
    expect(
      (screen.getByLabelText("Zoom out") as HTMLButtonElement).disabled
    ).toBe(true)
    expect(
      (screen.getByLabelText("Zoom in") as HTMLButtonElement).disabled
    ).toBe(true)
    expect(
      (screen.getByLabelText("Fit width") as HTMLButtonElement).disabled
    ).toBe(true)

    await act(async () => {
      view.rerender(
        <ImageViewer source={imageUrlSource("/scale.png")} scale={3} />
      )
    })

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "span" &&
          element.textContent === "300%"
      )
    ).toBeTruthy()
  })

  it("keeps scale uncontrolled when the prop is absent", async () => {
    stubImageLoading(bitmap(20, 10))
    stubViewerLayout()

    await act(async () => {
      render(<ImageViewer source={imageUrlSource("/uncontrolled-scale.png")} />)
    })

    expect(
      ((await screen.findByLabelText("Zoom out")) as HTMLButtonElement).disabled
    ).toBe(false)
    expect(
      (screen.getByLabelText("Zoom in") as HTMLButtonElement).disabled
    ).toBe(false)
    expect(
      (screen.getByLabelText("Fit width") as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it("fits mixed-size TIFF frames by the widest rendered frame", async () => {
    class MetadataWorker extends FakeTiffWorker {
      override postMessage(
        message: TiffWorkerRequest,
        transfer?: readonly Transferable[]
      ): void {
        super.postMessage(message, transfer)
        if (message.type === "init") {
          queueMicrotask(() => {
            this.emit({
              type: "initOk",
              frames: [
                { intrinsicSize: { width: 100, height: 20 } },
                { intrinsicSize: { width: 200, height: 20 } },
              ],
            })
          })
        }
      }
    }

    stubViewerLayout()
    stubElementClientWidth(1032)
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new ArrayBuffer(4), {
            headers: { "content-type": "image/tiff" },
          })
        )
      )
    )
    vi.stubGlobal("Worker", MetadataWorker)

    await act(async () => {
      render(<ImageViewer source={imageUrlSource("/mixed.tiff")} />)
    })

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "span" &&
          element.textContent === "500%"
      )
    ).toBeTruthy()
  })
})

describe("ImageViewer interactions", () => {
  it("releases the retained image source when the viewer unmounts", async () => {
    stubImageLoading(bitmap(20, 20))
    stubObservableLayout({ isIntersecting: false })
    const resource = imageUrlResource("/viewer-lease.png")
    const source = await getImageSource(resource)
    const dispose = vi.spyOn(source, "dispose")

    let view!: RenderResult
    await act(async () => {
      view = render(
        <ImageViewer source={imageUrlSource("/viewer-lease.png")} />
      )
    })
    expect(await screen.findByText("1 image")).toBeTruthy()

    view.unmount()

    await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1))
  })

  it("clamps uncontrolled zoom and restores fit-width scale", async () => {
    stubImageLoading(bitmap(100, 100))
    stubObservableLayout({ frameListWidth: 132, isIntersecting: false })

    await act(async () => {
      render(<ImageViewer source={imageUrlSource("/toolbar-scale.png")} />)
    })

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "span" &&
          element.textContent === "100%"
      )
    ).toBeTruthy()

    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Zoom in"))
      })
    }
    expect(screen.getByText("500%")).toBeTruthy()

    for (let i = 0; i < 50; i += 1) {
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Zoom out"))
      })
    }
    expect(screen.getByText("25%")).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Fit width"))
    })
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("recomputes fit-width scale and overlay geometry after rotation", async () => {
    stubImageLoading(bitmap(100, 200))
    stubObservableLayout({ frameListWidth: 232, isIntersecting: false })

    await act(async () => {
      render(
        <ImageViewer
          source={imageUrlSource("/rotate-overlay.png")}
          renderFrameOverlay={({ width, height, rotation, scale }) => (
            <div
              data-testid="image-overlay"
              data-height={height}
              data-rotation={rotation}
              data-scale={scale}
              data-width={width}
            />
          )}
        />
      )
    })

    const overlay = await screen.findByTestId("image-overlay")
    expect(overlay.getAttribute("data-width")).toBe("200")
    expect(overlay.getAttribute("data-height")).toBe("400")
    expect(overlay.getAttribute("data-scale")).toBe("2")
    expect(overlay.getAttribute("data-rotation")).toBe("0")
    expect(screen.getByText("200%")).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Rotate"))
    })

    expect(overlay.getAttribute("data-width")).toBe("200")
    expect(overlay.getAttribute("data-height")).toBe("100")
    expect(overlay.getAttribute("data-scale")).toBe("1")
    expect(overlay.getAttribute("data-rotation")).toBe("90")
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("reports scroll progress and the frame under the viewport marker", async () => {
    stubObservableLayout({ isIntersecting: false })
    stubTiffMetadataLoading([
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    ])
    const onScrollProgressChange = vi.fn()
    const onVisibleFrameChange = vi.fn()

    let view!: RenderResult
    await act(async () => {
      view = render(
        <ImageViewer
          source={imageUrlSource("/scrollable.tiff")}
          onScrollProgressChange={onScrollProgressChange}
          onVisibleFrameChange={onVisibleFrameChange}
        />
      )
    })
    const { container } = view

    expect(await screen.findByText("Page 1 of 3")).toBeTruthy()
    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement
    const secondFrame = container.querySelector(
      '[data-frame-number="2"]'
    ) as HTMLElement
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 250,
    })
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 1000,
    })
    viewport.scrollTop = 375
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => [secondFrame]),
    })

    await act(async () => {
      fireEvent.scroll(viewport)
    })

    expect(onScrollProgressChange).toHaveBeenCalledWith(0.5)
    expect(onVisibleFrameChange).toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.getByText("Page 2 of 3")).toBeTruthy())
  })

  it("exposes the scroll viewport and scrolls to frame areas through its ref", async () => {
    stubObservableLayout({ isIntersecting: false })
    stubTiffMetadataLoading([
      { width: 100, height: 100 },
      { width: 100, height: 400 },
    ])
    const ref = React.createRef<ImageViewerHandle>()

    let view!: RenderResult
    await act(async () => {
      view = render(
        <ImageViewer ref={ref} source={imageUrlSource("/imperative.tiff")} />
      )
    })
    const { container } = view

    expect(await screen.findByText("Page 1 of 2")).toBeTruthy()
    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement
    const secondFrame = container.querySelector(
      '[data-frame-number="2"]'
    ) as HTMLElement
    const scrollTo = vi.fn()
    viewport.scrollTop = 20
    viewport.scrollTo = scrollTo
    viewport.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 100,
          left: 0,
          width: 300,
          height: 250,
          right: 300,
          bottom: 350,
        }) as DOMRect
    )
    secondFrame.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 300,
          left: 0,
          width: 100,
          height: 400,
          right: 100,
          bottom: 700,
        }) as DOMRect
    )

    expect(ref.current?.getViewportElement()).toBe(viewport)

    act(() => {
      ref.current?.scrollToFrameArea(
        2,
        { left: 0, top: 50, width: 10, height: 10 },
        { behavior: "auto" }
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 372, behavior: "auto" })
  })

  it("resets the image error boundary when the reset key changes", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    function MaybeBroken({ broken }: { broken: boolean }) {
      if (broken) throw new Error("first source failed")
      return <div>Recovered image source</div>
    }

    const view = render(
      <ViewerErrorBoundary format="image" resetKey="broken">
        <MaybeBroken broken />
      </ViewerErrorBoundary>
    )

    expect(screen.getByText("Couldn't load this image.")).toBeTruthy()
    expect(consoleError).toHaveBeenCalledWith(
      "Viewer failed to render.",
      expect.any(Error)
    )

    view.rerender(
      <ViewerErrorBoundary format="image" resetKey="healthy">
        <MaybeBroken broken={false} />
      </ViewerErrorBoundary>
    )

    expect(screen.getByText("Recovered image source")).toBeTruthy()
    expect(screen.queryByText("Couldn't load this image.")).toBeNull()
  })
})

describe("ImageViewer error fallback", () => {
  it("keeps the user-facing fallback terse while exposing diagnostics", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    function BrokenFrame() {
      throw new Error("decode exploded")
      return null
    }

    render(
      <ViewerErrorBoundary format="image">
        <BrokenFrame />
      </ViewerErrorBoundary>
    )

    const fallback = screen.getByRole("alert")
    expect(fallback.textContent).toContain("Couldn't load this image.")
    expect(fallback.getAttribute("data-slot")).toBe("viewer-error")
    expect(fallback.getAttribute("data-error-message")).toBe("decode exploded")
    expect(consoleError).toHaveBeenCalledWith(
      "Viewer failed to render.",
      expect.any(Error)
    )
  })
})

describe("image source overlay geometry", () => {
  it("rotates percentage areas for every right-angle rotation", () => {
    const area = { left: 10, top: 20, width: 30, height: 40 }

    expect(rotateImageArea(area, 0)).toEqual(area)
    expect(rotateImageArea(area, 90)).toEqual({
      left: 40,
      top: 10,
      width: 40,
      height: 30,
    })
    expect(rotateImageArea(area, 180)).toEqual({
      left: 60,
      top: 40,
      width: 30,
      height: 40,
    })
    expect(rotateImageArea(area, 270)).toEqual({
      left: 20,
      top: 60,
      width: 40,
      height: 30,
    })
  })

  it("renders the active source highlight in rotated coordinates", () => {
    const source: Source = {
      content: "field",
      anchor: {
        kind: "image_bbox",
        page: 1,
        left: 0.1,
        top: 0.2,
        width: 0.3,
        height: 0.4,
      },
    }
    const overlay = renderImageSourceOverlay(source)
    const { container } = render(
      <>
        {overlay({
          frameNumber: 1,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 90,
        })}
      </>
    )
    const highlight = container.firstElementChild as HTMLElement

    expect(highlight.style.left).toBe("40%")
    expect(highlight.style.top).toBe("10%")
    expect(highlight.style.width).toBe("40%")
    expect(highlight.style.height).toBe("30%")
  })
})
