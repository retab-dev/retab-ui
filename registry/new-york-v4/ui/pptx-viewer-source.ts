import { type ViewerResource } from "@/lib/viewer-resource"

import {
  DisposableLruCache,
  PptxBitmapEntry,
  type Disposable,
} from "./pptx-viewer-cache"
import {
  getPptxBitmapCacheKey,
  type PptxBitmapCacheInput,
  type PptxSize,
} from "./pptx-viewer-core"
import {
  createPptxRenderer,
  PptxRendererError,
  type PptxRenderer,
} from "./pptx-viewer-renderer"

const PPTX_SOURCE_CACHE_MAX = 4
const PPTX_BITMAP_CACHE_MAX = 8

export type PptxSourceRelease = () => void

export interface PptxSourceRenderInput extends PptxBitmapCacheInput {
  canvas: HTMLCanvasElement
  isLive?: () => boolean
}

export type PptxRenderResult =
  | { status: "rendered" }
  | { status: "cancelled" }
  | { status: "failed"; error: PptxRendererError }

export interface PptxSource extends Disposable {
  slideCount: number
  baseSize: PptxSize
  renderSlide(input: PptxSourceRenderInput): Promise<PptxRenderResult>
  hasBitmap(input: PptxBitmapCacheInput): boolean
  retain(): PptxSourceRelease
}

class RendererSource implements PptxSource {
  readonly slideCount: number
  readonly baseSize: PptxSize

  private readonly bitmaps = new DisposableLruCache<string, PptxBitmapEntry>(
    PPTX_BITMAP_CACHE_MAX
  )
  private queue: Promise<unknown> = Promise.resolve()
  private retainCount = 0
  private disposeRequested = false
  private disposed = false

  constructor(private readonly renderer: PptxRenderer) {
    this.slideCount = renderer.slideCount
    this.baseSize = renderer.baseSize
  }

  hasBitmap(input: PptxBitmapCacheInput) {
    return this.bitmaps.get(getPptxBitmapCacheKey(input)) !== undefined
  }

  renderSlide(input: PptxSourceRenderInput): Promise<PptxRenderResult> {
    if (this.disposed) {
      return Promise.resolve({
        status: "failed",
        error: new PptxRendererError(
          "disposed",
          "Presentation source was disposed."
        ),
      })
    }

    const cacheKey = getPptxBitmapCacheKey(input)
    const cached = this.bitmaps.get(cacheKey)
    if (cached) {
      if (!isRenderLive(input)) return Promise.resolve({ status: "cancelled" })
      drawBitmap(input.canvas, cached.bitmap)
      return Promise.resolve({ status: "rendered" })
    }

    const run = this.queue
      .catch(() => {})
      .then(async (): Promise<PptxRenderResult> => {
        if (!isRenderLive(input)) return { status: "cancelled" }

        try {
          await this.renderer.renderSlide(input)
        } catch (error) {
          return {
            status: "failed",
            error: normalizeRendererError(error),
          }
        }

        if (!isRenderLive(input)) return { status: "cancelled" }

        try {
          const bitmap = await createImageBitmap(input.canvas)
          if (!isRenderLive(input)) {
            bitmap.close()
            return { status: "cancelled" }
          }
          this.bitmaps.set(cacheKey, new PptxBitmapEntry(bitmap))
        } catch {
          /* Snapshot unsupported: the slide still rendered, just without cache. */
        }

        return { status: "rendered" }
      })

    this.queue = run.catch(() => {})
    return run
  }

  retain(): PptxSourceRelease {
    if (this.disposed) return () => {}
    this.retainCount += 1
    let released = false
    return () => {
      if (released) return
      released = true
      this.retainCount -= 1
      if (this.retainCount === 0 && this.disposeRequested) this.close()
    }
  }

  dispose() {
    this.disposeRequested = true
    if (this.retainCount === 0) this.close()
  }

  private close() {
    if (this.disposed) return
    this.disposed = true
    this.bitmaps.clear()
    this.renderer.dispose()
  }
}

class SourceCacheEntry implements Disposable {
  source?: PptxSource
  disposed = false

  constructor(readonly promise: Promise<PptxSource>) {
    promise.then(
      (source) => {
        this.source = source
        if (this.disposed) source.dispose()
      },
      () => {
        /* rejected entries are removed by getPptxSource */
      }
    )
  }

  dispose() {
    this.disposed = true
    this.source?.dispose()
  }
}

const sourceCache = new DisposableLruCache<string, SourceCacheEntry>(
  PPTX_SOURCE_CACHE_MAX
)

export function getPptxSource(resource: ViewerResource): Promise<PptxSource> {
  const cacheKey = resource.cacheKey
  const cached = sourceCache.get(cacheKey)
  if (cached) return cached.promise

  const pendingEntry: { current?: SourceCacheEntry } = {}
  const promise = createPptxRenderer(resource).then(
    (renderer) => new RendererSource(renderer),
    (error) => {
      if (
        pendingEntry.current &&
        sourceCache.get(cacheKey) === pendingEntry.current
      ) {
        sourceCache.delete(cacheKey)
      }
      throw error
    }
  )
  const entry = new SourceCacheEntry(promise)
  pendingEntry.current = entry
  sourceCache.set(cacheKey, entry)
  return entry.promise
}

export function disposePptxSourceCache() {
  sourceCache.clear()
}

function isRenderLive({ isLive }: Pick<PptxSourceRenderInput, "isLive">) {
  return !isLive || isLive()
}

function drawBitmap(canvas: HTMLCanvasElement, bitmap: ImageBitmap) {
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
}

function normalizeRendererError(error: unknown) {
  if (error instanceof PptxRendererError) return error
  return new PptxRendererError(
    "render_failed",
    "Failed to render slide.",
    error
  )
}
