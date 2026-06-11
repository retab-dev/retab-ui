import {
  createNativeImageFrameSource,
  ImageLoadError,
  ImageSourceDisposedError,
  isTiffBytes,
  type FrameSource,
} from "@/lib/image-frame-source"
import {
  createTiffFrameSource,
  type TiffWorkerFactory,
} from "@/lib/image-tiff-source"

const DEFAULT_MAX_DECODED_FRAMES = 16
const DEFAULT_UNCLAIMED_SOURCE_TIMEOUT_MS = 30_000

export interface FrameSourceLease {
  source: FrameSource
  release(): void
}

interface FrameSourceEntry {
  promise: Promise<FrameSource>
  source?: FrameSource
  leaseCount: number
  disposeWhenResolved: boolean
  unclaimedDisposeTimer?: ReturnType<typeof setTimeout>
}

interface FrameSourceManagerOptions {
  maxDecodedFrames?: number
  unclaimedSourceTimeoutMs?: number
}

export class FrameSourceManager {
  private readonly entries = new Map<string, FrameSourceEntry>()
  private readonly maxDecodedFrames: number
  private readonly unclaimedSourceTimeoutMs: number

  constructor(options: FrameSourceManagerOptions = {}) {
    this.maxDecodedFrames =
      options.maxDecodedFrames ?? DEFAULT_MAX_DECODED_FRAMES
    this.unclaimedSourceTimeoutMs =
      options.unclaimedSourceTimeoutMs ?? DEFAULT_UNCLAIMED_SOURCE_TIMEOUT_MS
  }

  load(src: string, createTiffWorker: TiffWorkerFactory): Promise<FrameSource> {
    let entry = this.entries.get(src)
    if (!entry) {
      const newEntry: FrameSourceEntry = {
        promise: Promise.resolve().then(() =>
          this.createSource(src, createTiffWorker)
        ),
        leaseCount: 0,
        disposeWhenResolved: false,
      }
      newEntry.promise = newEntry.promise
        .then((source) => {
          newEntry.source = source
          if (newEntry.disposeWhenResolved) {
            source.dispose()
            this.entries.delete(src)
            throw new ImageLoadError("Image source was disposed before use")
          }
          if (newEntry.leaseCount === 0) {
            this.scheduleUnclaimedDispose(src, newEntry)
          }
          return source
        })
        .catch((error) => {
          this.entries.delete(src)
          throw error
        })
      entry = newEntry
      this.entries.set(src, entry)
    }
    return entry.promise
  }

  retain(src: string, source: FrameSource): FrameSourceLease | null {
    const entry = this.entries.get(src)
    if (!entry || entry.source !== source) return null
    this.cancelUnclaimedDispose(entry)
    entry.leaseCount += 1
    let released = false
    return {
      source,
      release: () => {
        if (released) return
        released = true
        const current = this.entries.get(src)
        if (!current || current.source !== source) return
        current.leaseCount = Math.max(0, current.leaseCount - 1)
        if (current.leaseCount === 0) {
          this.disposeEntry(src, current)
          return
        }
      },
    }
  }

  clear() {
    for (const entry of this.entries.values()) {
      entry.disposeWhenResolved = true
      this.cancelUnclaimedDispose(entry)
      entry.source?.dispose()
    }
    this.entries.clear()
  }

  private async createSource(
    src: string,
    createTiffWorker: TiffWorkerFactory
  ): Promise<FrameSource> {
    const response = await fetch(src)
    if (!response.ok) {
      throw new ImageLoadError(`Failed to load image: ${response.status}`)
    }
    const bytes = await response.arrayBuffer()
    const contentType = response.headers.get("content-type")
    if (isTiffBytes(src, contentType, bytes)) {
      return createTiffFrameSource(
        bytes,
        createTiffWorker,
        this.maxDecodedFrames
      )
    }
    return createNativeImageFrameSource(
      bytes,
      contentType,
      this.maxDecodedFrames
    )
  }

  private disposeEntry(src: string, entry: FrameSourceEntry) {
    entry.disposeWhenResolved = true
    this.cancelUnclaimedDispose(entry)
    entry.source?.dispose(new ImageSourceDisposedError())
    this.entries.delete(src)
  }

  private scheduleUnclaimedDispose(src: string, entry: FrameSourceEntry) {
    this.cancelUnclaimedDispose(entry)
    entry.unclaimedDisposeTimer = setTimeout(() => {
      const current = this.entries.get(src)
      if (!current || current !== entry || current.leaseCount > 0) return
      this.disposeEntry(src, current)
    }, this.unclaimedSourceTimeoutMs)
  }

  private cancelUnclaimedDispose(entry: FrameSourceEntry) {
    if (!entry.unclaimedDisposeTimer) return
    clearTimeout(entry.unclaimedDisposeTimer)
    entry.unclaimedDisposeTimer = undefined
  }
}

export const imageFrameSourceManager = new FrameSourceManager()
