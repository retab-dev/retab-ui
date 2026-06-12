import {
  createNativeImageFrameSource,
  createNativeImageFrameSourceFromBlob,
  ImageLoadError,
  ImageSourceDisposedError,
  isDeclaredNativeImage,
  isDeclaredTiff,
  isTiffBytes,
  type FrameSource,
} from "@/lib/image-frame-source"
import {
  createTiffFrameSource,
  type TiffWorkerFactory,
} from "@/lib/image-tiff-source"

const DEFAULT_MAX_DECODED_FRAMES = 16
const DEFAULT_UNCLAIMED_SOURCE_TIMEOUT_MS = 30_000
const DEFAULT_RELEASED_SOURCE_TIMEOUT_MS = 0

export interface FrameSourceLease {
  source: FrameSource
  release(): void
}

type FrameSourceEntryState = "loading" | "ready" | "released" | "disposed"

interface FrameSourceEntry {
  src: string
  promise: Promise<FrameSource>
  source?: FrameSource
  leaseCount: number
  state: FrameSourceEntryState
  disposeWhenResolved: boolean
  disposeReason?: Error
  disposeTimer?: ReturnType<typeof setTimeout>
}

interface FrameSourceManagerOptions {
  maxDecodedFrames?: number
  releasedSourceTimeoutMs?: number
  unclaimedSourceTimeoutMs?: number
}

export class FrameSourceManager {
  private readonly entries = new Map<string, FrameSourceEntry>()
  private readonly maxDecodedFrames: number
  private readonly releasedSourceTimeoutMs: number
  private readonly unclaimedSourceTimeoutMs: number

  constructor(options: FrameSourceManagerOptions = {}) {
    this.maxDecodedFrames =
      options.maxDecodedFrames ?? DEFAULT_MAX_DECODED_FRAMES
    this.releasedSourceTimeoutMs =
      options.releasedSourceTimeoutMs ?? DEFAULT_RELEASED_SOURCE_TIMEOUT_MS
    this.unclaimedSourceTimeoutMs =
      options.unclaimedSourceTimeoutMs ?? DEFAULT_UNCLAIMED_SOURCE_TIMEOUT_MS
  }

  load(src: string, createTiffWorker: TiffWorkerFactory): Promise<FrameSource> {
    let entry = this.entries.get(src)
    if (!entry) {
      const newEntry: FrameSourceEntry = {
        src,
        promise: Promise.resolve().then(() =>
          this.createSource(src, createTiffWorker)
        ),
        leaseCount: 0,
        state: "loading",
        disposeWhenResolved: false,
      }
      newEntry.promise = newEntry.promise
        .then((source) => {
          newEntry.source = source
          if (newEntry.disposeWhenResolved) {
            source.dispose(
              newEntry.disposeReason ?? new ImageSourceDisposedError()
            )
            this.entries.delete(src)
            newEntry.state = "disposed"
            throw new ImageLoadError("Image source was disposed before use")
          }
          if (newEntry.leaseCount === 0) {
            newEntry.state = "released"
            this.scheduleDispose(
              newEntry,
              this.unclaimedSourceTimeoutMs,
              new ImageSourceDisposedError()
            )
          } else {
            newEntry.state = "ready"
          }
          return source
        })
        .catch((error) => {
          if (this.entries.get(src) === newEntry) this.entries.delete(src)
          throw error
        })
      entry = newEntry
      this.entries.set(src, entry)
    }
    return entry.promise
  }

  retain(src: string, source: FrameSource): FrameSourceLease | null {
    const entry = this.entries.get(src)
    if (!entry || entry.source !== source || entry.state === "disposed") {
      return null
    }
    this.cancelDispose(entry)
    entry.state = "ready"
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
          current.state = "released"
          this.scheduleDispose(
            current,
            this.releasedSourceTimeoutMs,
            new ImageSourceDisposedError()
          )
        }
      },
    }
  }

  clear() {
    for (const entry of [...this.entries.values()]) {
      this.disposeEntry(entry, new ImageSourceDisposedError())
    }
  }

  private async createSource(
    src: string,
    createTiffWorker: TiffWorkerFactory
  ): Promise<FrameSource> {
    const response = await fetch(src)
    if (!response.ok) {
      throw new ImageLoadError(`Failed to load image: ${response.status}`)
    }
    const contentType = response.headers.get("content-type")

    if (isDeclaredTiff(src, contentType)) {
      return createTiffFrameSource(
        await response.arrayBuffer(),
        createTiffWorker,
        this.maxDecodedFrames
      )
    }

    if (isDeclaredNativeImage(src, contentType)) {
      return createNativeImageFrameSourceFromBlob(
        await response.blob(),
        this.maxDecodedFrames
      )
    }

    const bytes = await response.arrayBuffer()
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

  private disposeEntry(entry: FrameSourceEntry, reason: Error) {
    if (entry.state === "disposed") return
    entry.state = "disposed"
    entry.disposeWhenResolved = true
    entry.disposeReason = reason
    this.cancelDispose(entry)
    entry.source?.dispose(reason)
    if (this.entries.get(entry.src) === entry) this.entries.delete(entry.src)
  }

  private scheduleDispose(
    entry: FrameSourceEntry,
    delayMs: number,
    reason: Error
  ) {
    this.cancelDispose(entry)
    entry.disposeReason = reason
    entry.disposeTimer = setTimeout(() => {
      const current = this.entries.get(entry.src)
      if (!current || current !== entry || current.leaseCount > 0) return
      this.disposeEntry(current, reason)
    }, delayMs)
  }

  private cancelDispose(entry: FrameSourceEntry) {
    if (!entry.disposeTimer) return
    clearTimeout(entry.disposeTimer)
    entry.disposeTimer = undefined
  }
}

export const imageFrameSourceManager = new FrameSourceManager()
