// @vitest-environment jsdom
import fs from "node:fs"
import * as React from "react"
import {
  act,
  cleanup,
  render,
  screen,
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
} from "@/registry/new-york-v4/lib/image-frame-source"
import { FrameSourceManager } from "@/registry/new-york-v4/lib/image-source-cache"
import {
  createTiffFrameSource,
  TiffWorkerClient,
  TiffWorkerError,
  type TiffWorkerRequest,
  type TiffWorkerResponse,
} from "@/registry/new-york-v4/lib/image-tiff-source"
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
} from "@/registry/new-york-v4/ui/image-viewer"
import { ImageViewerErrorBoundary } from "@/registry/new-york-v4/ui/image-viewer-chrome"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  clearImageSourceCacheForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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

    await expect(getImageSource("/retry.png")).rejects.toThrow(
      "Failed to load image: 500"
    )
    await expect(getImageSource("/retry.png")).resolves.toMatchObject({
      kind: "native-image",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe("FrameSourceManager lifecycle", () => {
  it("shares in-flight loads for the same src", async () => {
    const manager = new FrameSourceManager()
    stubImageLoading()

    const first = manager.load("/shared.png", () => new Worker(""))
    const second = manager.load("/shared.png", () => new Worker(""))

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
      manager.load("/retry.png", () => new Worker(""))
    ).rejects.toThrow("Failed to load image: 500")
    await expect(
      manager.load("/retry.png", () => new Worker(""))
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
            reject(signal?.reason ?? new Error("aborted"))
          })
        })
      })
    )

    const load = manager.load("/abort.png", () => new Worker(""))
    await Promise.resolve()
    manager.clear()

    expect(signal?.aborted).toBe(true)
    await expect(load).rejects.toThrow("Image source disposed")
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
      manager.load("/declared-native.png", () => new Worker(""))
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
      "/declared.tiff",
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
      blob: vi.fn(() => Promise.resolve(new Blob())),
      arrayBuffer: vi.fn(() =>
        Promise.resolve(Uint8Array.of(0x49, 0x49, 0x2a, 0).buffer)
      ),
    } as unknown as Response
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response))
    )

    const load = manager.load("/unknown", () => worker as unknown as Worker)
    await waitForWorkerPost(worker)

    expect(response.arrayBuffer).toHaveBeenCalledTimes(1)
    expect(response.blob).not.toHaveBeenCalled()
    worker.emit({
      type: "initOk",
      frames: [{ intrinsicSize: { width: 10, height: 10 } }],
    })
    await expect(load).resolves.toMatchObject({ kind: "tiff" })
  })

  it("streams unknown native responses into a blob without full ArrayBuffer buffering", async () => {
    const manager = new FrameSourceManager()
    const clonedBlob = new Blob([Uint8Array.of(1, 2, 3, 4)], {
      type: "image/png",
    })
    const clone = {
      blob: vi.fn(() => Promise.resolve(clonedBlob)),
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
      blob: vi.fn(() => Promise.resolve(new Blob())),
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
      manager.load("/unknown-native", () => new Worker(""))
    ).resolves.toMatchObject({ kind: "native-image" })

    expect(response.arrayBuffer).not.toHaveBeenCalled()
    expect(response.blob).not.toHaveBeenCalled()
    expect(response.clone).toHaveBeenCalledTimes(1)
    expect(clone.blob).toHaveBeenCalledTimes(1)
  })

  it("disposes the source after the last lease release settles", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager()
    stubImageLoading()
    const source = await manager.load("/lease.png", () => new Worker(""))
    const dispose = vi.spyOn(source, "dispose")

    const firstLease = manager.retain("/lease.png", source)
    const secondLease = manager.retain("/lease.png", source)

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
    const source = await manager.load("/lease-again.png", () => new Worker(""))
    const dispose = vi.spyOn(source, "dispose")

    const firstLease = manager.retain("/lease-again.png", source)
    firstLease?.release()
    const secondLease = manager.retain("/lease-again.png", source)

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
      "/duplicate-release.png",
      () => new Worker("")
    )
    const dispose = vi.spyOn(source, "dispose")
    const lease = manager.retain("/duplicate-release.png", source)

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

    const load = manager.load("/pending.png", () => new Worker(""))
    await Promise.resolve()
    manager.clear()
    pendingBitmap.resolve(bitmap())

    await expect(load).rejects.toThrow("Image source was disposed before use")
  })

  it("disposes resolved unclaimed sources after the unclaimed timeout", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager({ unclaimedSourceTimeoutMs: 50 })
    stubImageLoading()
    const source = await manager.load("/unclaimed.png", () => new Worker(""))
    const dispose = vi.spyOn(source, "dispose")

    await vi.advanceTimersByTimeAsync(49)
    expect(dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(dispose).toHaveBeenCalledTimes(1)
    const retry = manager.load("/unclaimed.png", () => new Worker(""))
    await expect(retry).resolves.toMatchObject({ kind: "native-image" })
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("cancels unclaimed disposal when a source is retained", async () => {
    vi.useFakeTimers()
    const manager = new FrameSourceManager({ unclaimedSourceTimeoutMs: 50 })
    stubImageLoading()
    const source = await manager.load("/claimed.png", () => new Worker(""))
    const dispose = vi.spyOn(source, "dispose")
    const lease = manager.retain("/claimed.png", source)

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
      "/clear-unclaimed.png",
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

describe("ImageViewer scale semantics", () => {
  it("treats scale as controlled when provided", async () => {
    stubImageLoading(bitmap(20, 10))
    stubViewerLayout()

    let view!: RenderResult
    await act(async () => {
      view = render(<ImageViewer src="/scale.png" scale={2} />)
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
      view.rerender(<ImageViewer src="/scale.png" scale={3} />)
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
      render(<ImageViewer src="/uncontrolled-scale.png" />)
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
      render(<ImageViewer src="/mixed.tiff" />)
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

describe("ImageViewer error fallback", () => {
  it("keeps the user-facing fallback terse while exposing diagnostics", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    function BrokenFrame() {
      throw new Error("decode exploded")
      return null
    }

    render(
      <ImageViewerErrorBoundary>
        <BrokenFrame />
      </ImageViewerErrorBoundary>
    )

    const fallback = screen.getByText("Couldn't load this image.")
    expect(fallback.getAttribute("data-slot")).toBe("image-viewer-error")
    expect(fallback.getAttribute("data-error-message")).toBe("decode exploded")
    expect(consoleError).toHaveBeenCalledWith(
      "ImageViewer failed to render.",
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
