import type {
  ViewerContentBytes,
  ViewerContentIdentity,
} from "@/lib/viewer-resource"

import {
  DisposableLruCache,
  PptxBitmapEntry,
  type Disposable,
} from "./pptx-viewer-cache"
import {
  getPptxBitmapCacheKey,
  type PptxBitmapCacheInput,
  type PptxSize,
  type PptxSourceLoadTiming,
} from "./pptx-viewer-core"
import {
  createPptxRenderer,
  PptxRendererError,
  type PptxRenderer,
} from "./pptx-viewer-renderer"

const PPTX_SOURCE_CACHE_MAX = 4
const PPTX_SOURCE_TIMING_CACHE_MAX = 32
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
    if (this.disposed) return false
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
    if (!isValidSlideIndex(input.slideIndex, this.slideCount)) {
      return Promise.resolve({
        status: "failed",
        error: new PptxRendererError(
          "index_out_of_range",
          `Slide ${input.slideIndex + 1} is outside the presentation.`
        ),
      })
    }
    if (!isValidRenderScale(input.renderScale)) {
      return Promise.resolve({
        status: "failed",
        error: new PptxRendererError(
          "bounds",
          "Render scale must be a positive finite number."
        ),
      })
    }

    const bitmapKey = getPptxBitmapCacheKey(input)
    const cached = this.bitmaps.get(bitmapKey)
    if (cached) {
      if (!isRenderLive(input)) return Promise.resolve({ status: "cancelled" })
      return Promise.resolve(drawCachedBitmap(input.canvas, cached.bitmap))
    }

    const run = this.queue
      .catch(() => {})
      .then(async (): Promise<PptxRenderResult> => {
        if (this.disposed) return { status: "cancelled" }
        if (!isRenderLive(input)) return { status: "cancelled" }

        const queuedCached = this.bitmaps.get(bitmapKey)
        if (queuedCached) {
          return drawCachedBitmap(input.canvas, queuedCached.bitmap)
        }

        try {
          await this.renderer.renderSlide(input)
        } catch (error) {
          if (this.disposed) return { status: "cancelled" }
          if (!isRenderLive(input)) return { status: "cancelled" }
          return {
            status: "failed",
            error: normalizeRendererError(error),
          }
        }

        if (this.disposed) return { status: "cancelled" }
        if (!isRenderLive(input)) return { status: "cancelled" }

        try {
          const bitmap = await createImageBitmap(input.canvas)
          if (this.disposed || !isRenderLive(input)) {
            bitmap.close()
            return { status: "cancelled" }
          }
          this.bitmaps.set(bitmapKey, new PptxBitmapEntry(bitmap))
        } catch {
          if (this.disposed) return { status: "cancelled" }
          if (!isRenderLive(input)) return { status: "cancelled" }
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
    let hasReleased = false
    return () => {
      if (hasReleased) return
      hasReleased = true
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
  loadTiming?: PptxSourceLoadTiming
  disposed = false
  private readonly loadTimingSubscribers = new Set<
    (timing: PptxSourceLoadTiming) => void
  >()

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
    this.loadTimingSubscribers.clear()
    if (!this.source) return
    this.source?.dispose()
    this.disposed = true
  }

  disposeWhenResolved() {
    this.disposed = true
    this.loadTimingSubscribers.clear()
    this.source?.dispose()
  }

  setLoadTiming(timing: PptxSourceLoadTiming) {
    this.loadTiming = timing
    for (const subscriber of this.loadTimingSubscribers) {
      notifyLoadTimingSubscriber(subscriber, timing)
    }
  }

  subscribeLoadTiming(callback: (timing: PptxSourceLoadTiming) => void) {
    this.loadTimingSubscribers.add(callback)
    if (this.loadTiming) {
      const loadTiming = this.loadTiming
      setTimeout(() => {
        if (this.loadTimingSubscribers.has(callback)) {
          notifyLoadTimingSubscriber(callback, loadTiming)
        }
      }, 0)
    }
    return () => {
      this.loadTimingSubscribers.delete(callback)
    }
  }
}

function notifyLoadTimingSubscriber(
  subscriber: (timing: PptxSourceLoadTiming) => void,
  timing: PptxSourceLoadTiming
) {
  try {
    subscriber(timing)
  } catch {
    /* Instrumentation callbacks must not affect viewer loading. */
  }
}

const sourceCache = new DisposableLruCache<string, SourceCacheEntry>(
  PPTX_SOURCE_CACHE_MAX
)
const sourceLoadTimingCache = new Map<string, PptxSourceLoadTiming>()

export function getPptxSource(
  content: ViewerContentBytes
): Promise<PptxSource> {
  const loadKey = content.key
  const cached = sourceCache.get(loadKey)
  if (cached) return cached.promise

  sourceLoadTimingCache.delete(loadKey)

  const pendingEntry: { current?: SourceCacheEntry } = {}
  let pendingLoadTiming: PptxSourceLoadTiming | null = null
  const handleLoadTiming = (timing: PptxSourceLoadTiming) => {
    rememberSourceLoadTiming(loadKey, timing)
    if (pendingEntry.current) {
      pendingEntry.current.setLoadTiming(timing)
    } else {
      pendingLoadTiming = timing
    }
  }
  const promise = createPptxRenderer(content, handleLoadTiming).then(
    (renderer) => new RendererSource(renderer),
    (error) => {
      scheduleFailedSourceEviction(loadKey, pendingEntry.current)
      throw error
    }
  )
  const entry = new SourceCacheEntry(promise)
  pendingEntry.current = entry
  if (pendingLoadTiming) entry.setLoadTiming(pendingLoadTiming)
  sourceCache.set(loadKey, entry)
  return entry.promise
}

export function subscribePptxSourceLoadTiming(
  content: ViewerContentIdentity,
  callback: (timing: PptxSourceLoadTiming) => void
) {
  const loadKey = content.key
  const entry = sourceCache.get(loadKey)
  if (!entry) return subscribeCachedSourceLoadTiming(loadKey, callback)
  return entry.subscribeLoadTiming(callback)
}

export function evictPptxSource(content: ViewerContentIdentity) {
  sourceLoadTimingCache.delete(content.key)
  sourceCache.delete(content.key)
}

function subscribeCachedSourceLoadTiming(
  loadKey: string,
  callback: (timing: PptxSourceLoadTiming) => void
) {
  const loadTiming = sourceLoadTimingCache.get(loadKey)
  if (!loadTiming) return () => {}
  let isSubscribed = true
  setTimeout(() => {
    if (isSubscribed) notifyLoadTimingSubscriber(callback, loadTiming)
  }, 0)
  return () => {
    isSubscribed = false
  }
}

function rememberSourceLoadTiming(
  loadKey: string,
  timing: PptxSourceLoadTiming
) {
  sourceLoadTimingCache.delete(loadKey)
  sourceLoadTimingCache.set(loadKey, timing)
  while (sourceLoadTimingCache.size > PPTX_SOURCE_TIMING_CACHE_MAX) {
    const oldestLoadKey = sourceLoadTimingCache.keys().next().value
    if (!oldestLoadKey) return
    sourceLoadTimingCache.delete(oldestLoadKey)
  }
}

function scheduleFailedSourceEviction(
  loadKey: string,
  entry: SourceCacheEntry | undefined
) {
  if (!entry) return
  setTimeout(() => {
    if (sourceCache.get(loadKey) === entry) sourceCache.delete(loadKey)
  }, 0)
}

export function disposePptxSourceCache() {
  for (const entry of sourceCache.snapshotValues()) {
    entry.disposeWhenResolved()
  }
  sourceCache.clear()
  sourceLoadTimingCache.clear()
}

function isRenderLive({ isLive }: Pick<PptxSourceRenderInput, "isLive">) {
  try {
    return !isLive || isLive()
  } catch {
    return false
  }
}

function isValidSlideIndex(slideIndex: number, slideCount: number) {
  return (
    Number.isInteger(slideIndex) && slideIndex >= 0 && slideIndex < slideCount
  )
}

function isValidRenderScale(renderScale: number) {
  return Number.isFinite(renderScale) && renderScale > 0
}

function drawCachedBitmap(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap
): PptxRenderResult {
  try {
    drawBitmap(canvas, bitmap)
    return { status: "rendered" }
  } catch (error) {
    return {
      status: "failed",
      error: new PptxRendererError(
        "render_failed",
        "Failed to draw cached slide bitmap.",
        error
      ),
    }
  }
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
