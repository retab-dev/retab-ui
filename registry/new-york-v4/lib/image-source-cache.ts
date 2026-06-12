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
const TIFF_SIGNATURE_BYTE_COUNT = 4

export interface FrameSourceLease {
  source: FrameSource
  release(): void
}

type FrameSourceEntryState = "loading" | "ready" | "released" | "disposed"

interface FrameSourceEntry {
  src: string
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

  load(src: string, createTiffWorker: TiffWorkerFactory): Promise<FrameSource> {
    let entry = this.entries.get(src)
    if (!entry) {
      const abortController = new AbortController()
      const newEntry: FrameSourceEntry = {
        src,
        abortController,
        promise: Promise.resolve().then(() =>
          this.createSource(src, createTiffWorker, abortController.signal)
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
    createTiffWorker: TiffWorkerFactory,
    signal: AbortSignal
  ): Promise<FrameSource> {
    const response = await fetch(src, { signal })
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

    return this.createSourceFromUnknownResponse(
      src,
      response,
      contentType,
      createTiffWorker
    )
  }

  private disposeEntry(entry: FrameSourceEntry, reason: Error) {
    if (entry.state === "disposed") return
    entry.state = "disposed"
    entry.disposeReason = reason
    this.cancelDispose(entry)
    entry.abortController.abort(reason)
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

  private async createSourceFromUnknownResponse(
    src: string,
    response: Response,
    contentType: string | null,
    createTiffWorker: TiffWorkerFactory
  ): Promise<FrameSource> {
    const nativeResponse = canCloneResponse(response) ? response.clone() : null
    if (!response.body) {
      const bytes = await response.arrayBuffer()
      return this.createSourceFromBytes(
        src,
        contentType,
        bytes,
        createTiffWorker
      )
    }

    const { reader, chunks, prefix } = await readResponsePrefix(
      response.body,
      TIFF_SIGNATURE_BYTE_COUNT
    )
    if (isTiffBytes(src, contentType, prefix)) {
      return createTiffFrameSource(
        await readRemainingAsArrayBuffer(reader, chunks),
        createTiffWorker,
        this.maxDecodedFrames
      )
    }

    if (nativeResponse) {
      await reader.cancel()
    }
    return createNativeImageFrameSourceFromBlob(
      nativeResponse
        ? await nativeResponse.blob()
        : await readRemainingAsBlob(reader, chunks, contentType),
      this.maxDecodedFrames
    )
  }

  private createSourceFromBytes(
    src: string,
    contentType: string | null,
    bytes: ArrayBuffer,
    createTiffWorker: TiffWorkerFactory
  ): Promise<FrameSource> {
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
}

export const imageFrameSourceManager = new FrameSourceManager()

async function readResponsePrefix(
  body: ReadableStream<Uint8Array>,
  byteCount: number
) {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  while (byteLength < byteCount) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    byteLength += value.byteLength
  }

  return {
    reader,
    chunks,
    prefix: concatChunks(chunks, Math.min(byteLength, byteCount)),
  }
}

async function readRemainingAsArrayBuffer(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: Uint8Array[]
): Promise<ArrayBuffer> {
  let byteLength = totalByteLength(chunks)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    byteLength += value.byteLength
  }
  return concatChunks(chunks, byteLength)
}

async function readRemainingAsBlob(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: Uint8Array[],
  contentType: string | null
): Promise<Blob> {
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return new Blob(chunks.map(chunkToArrayBuffer), { type: contentType ?? "" })
}

function concatChunks(chunks: readonly Uint8Array[], byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    const available = Math.min(chunk.byteLength, byteLength - offset)
    if (available <= 0) break
    bytes.set(chunk.subarray(0, available), offset)
    offset += available
  }
  return bytes.buffer
}

function totalByteLength(chunks: readonly Uint8Array[]) {
  return chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
}

function chunkToArrayBuffer(chunk: Uint8Array): ArrayBuffer {
  const bytes = new Uint8Array(chunk.byteLength)
  bytes.set(chunk)
  return bytes.buffer
}

function canCloneResponse(response: Response): boolean {
  return typeof response.clone === "function"
}
