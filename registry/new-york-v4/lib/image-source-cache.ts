import {
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
import { type ViewerResource } from "@/lib/viewer-resource"

const DEFAULT_MAX_DECODED_FRAMES = 16
const DEFAULT_UNCLAIMED_SOURCE_TIMEOUT_MS = 30_000
const DEFAULT_RELEASED_SOURCE_TIMEOUT_MS = 0
const TIFF_SIGNATURE_BYTE_COUNT = 4

export interface FrameSourceLease {
  source: FrameSource
  release(): void
}

type FrameSourceEntryState = "loading" | "ready" | "released" | "disposed"

interface FrameSourceEntry {
  resource: ViewerResource
  abortController: AbortController
  promise: Promise<FrameSource>
  source?: FrameSource
  leaseCount: number
  state: FrameSourceEntryState
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

  load(
    resource: ViewerResource,
    createTiffWorker: TiffWorkerFactory
  ): Promise<FrameSource> {
    const resourceKey = resource.keys.load
    let entry = this.entries.get(resourceKey)
    if (!entry) {
      const abortController = new AbortController()
      const newEntry: FrameSourceEntry = {
        resource,
        abortController,
        promise: Promise.resolve().then(() =>
          this.createSource(resource, createTiffWorker, abortController.signal)
        ),
        leaseCount: 0,
        state: "loading",
      }
      newEntry.promise = newEntry.promise
        .then((source) => {
          newEntry.source = source
          if (newEntry.state === "disposed") {
            source.dispose(
              newEntry.disposeReason ?? new ImageSourceDisposedError()
            )
            this.entries.delete(resourceKey)
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
          if (this.entries.get(resourceKey) === newEntry) {
            this.entries.delete(resourceKey)
          }
          throw error
        })
      entry = newEntry
      this.entries.set(resourceKey, entry)
    }
    return entry.promise
  }

  retain(
    resource: ViewerResource,
    source: FrameSource
  ): FrameSourceLease | null {
    const entry = this.entries.get(resource.keys.load)
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
        const current = this.entries.get(resource.keys.load)
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
    resource: ViewerResource,
    createTiffWorker: TiffWorkerFactory,
    signal: AbortSignal
  ): Promise<FrameSource> {
    const sourceName = imageSourceName(resource)
    const declaredContentType = resource.mimeType ?? null

    if (isDeclaredTiff(sourceName, declaredContentType)) {
      return createTiffFrameSource(
        await resource.readArrayBuffer({ signal }),
        createTiffWorker,
        this.maxDecodedFrames,
        signal
      )
    }

    if (isDeclaredNativeImage(sourceName, declaredContentType)) {
      return createNativeImageFrameSourceFromBlob(
        await resource.readBlob({ signal }),
        this.maxDecodedFrames
      )
    }

    const blob = await resource.readBlob({ signal })
    return this.createSourceFromUnknownBlob(
      sourceName,
      blob,
      createTiffWorker,
      signal
    )
  }

  private disposeEntry(entry: FrameSourceEntry, reason: Error) {
    if (entry.state === "disposed") return
    entry.state = "disposed"
    entry.disposeReason = reason
    this.cancelDispose(entry)
    entry.abortController.abort(reason)
    entry.source?.dispose(reason)
    if (this.entries.get(entry.resource.keys.load) === entry) {
      this.entries.delete(entry.resource.keys.load)
    }
  }

  private scheduleDispose(
    entry: FrameSourceEntry,
    delayMs: number,
    reason: Error
  ) {
    this.cancelDispose(entry)
    entry.disposeReason = reason
    entry.disposeTimer = setTimeout(() => {
      const current = this.entries.get(entry.resource.keys.load)
      if (!current || current !== entry || current.leaseCount > 0) return
      this.disposeEntry(current, reason)
    }, delayMs)
  }

  private cancelDispose(entry: FrameSourceEntry) {
    if (!entry.disposeTimer) return
    clearTimeout(entry.disposeTimer)
    entry.disposeTimer = undefined
  }

  private async createSourceFromUnknownBlob(
    sourceName: string,
    blob: Blob,
    createTiffWorker: TiffWorkerFactory,
    signal: AbortSignal
  ): Promise<FrameSource> {
    const contentType = blob.type || null
    const prefix = await blob.slice(0, TIFF_SIGNATURE_BYTE_COUNT).arrayBuffer()
    if (isTiffBytes(sourceName, contentType, prefix)) {
      return createTiffFrameSource(
        await blob.arrayBuffer(),
        createTiffWorker,
        this.maxDecodedFrames,
        signal
      )
    }

    return createNativeImageFrameSourceFromBlob(blob, this.maxDecodedFrames)
  }
}

export const imageFrameSourceManager = new FrameSourceManager()

function imageSourceName(resource: ViewerResource): string {
  const directLoad = resource.getDirectLoad()
  return directLoad.kind === "url" ? directLoad.url : resource.fileName
}
