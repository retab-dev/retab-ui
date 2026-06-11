import {
  closeBitmap,
  createFrameSource,
  ImageDecodeError,
  type FrameDescriptor,
  type FrameSource,
} from "@/lib/image-frame-source"

export class TiffWorkerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "TiffWorkerError"
  }
}

export type TiffWorkerRequest =
  | { type: "init"; buffer: ArrayBuffer }
  | { type: "decodeFrame"; requestId: number; frameIndex: number }

export type TiffWorkerResponse =
  | { type: "initOk"; frames: FrameDescriptor[] }
  | { type: "initError"; message: string }
  | { type: "decodeFrameOk"; requestId: number; bitmap: ImageBitmap }
  | { type: "decodeFrameError"; requestId: number; message: string }

export type TiffWorkerFactory = () => Worker

interface PendingDecode {
  resolve(bitmap: ImageBitmap): void
  reject(error: Error): void
}

export class TiffWorkerClient {
  private readonly worker: Worker
  private readonly pendingDecodes = new Map<number, PendingDecode>()
  private initResolve: ((frames: readonly FrameDescriptor[]) => void) | null =
    null
  private initReject: ((error: Error) => void) | null = null
  private nextRequestId = 0
  private disposed = false

  constructor(createWorker: TiffWorkerFactory) {
    this.worker = createWorker()
    this.worker.onmessage = (event: MessageEvent<TiffWorkerResponse>) => {
      this.handleMessage(event.data)
    }
    this.worker.onerror = (event) => {
      this.fail(new TiffWorkerError(event.message || "TIFF worker failed"))
    }
    this.worker.onmessageerror = () => {
      this.fail(new TiffWorkerError("TIFF worker sent an unreadable message"))
    }
  }

  init(buffer: ArrayBuffer): Promise<readonly FrameDescriptor[]> {
    if (this.disposed) {
      return Promise.reject(new TiffWorkerError("TIFF worker disposed"))
    }
    return new Promise((resolve, reject) => {
      this.initResolve = resolve
      this.initReject = reject
      try {
        this.worker.postMessage({ type: "init", buffer }, [buffer])
      } catch (error) {
        this.initResolve = null
        this.initReject = null
        reject(
          new TiffWorkerError("Failed to initialize TIFF worker", {
            cause: error,
          })
        )
      }
    })
  }

  decode(frameIndex: number): Promise<ImageBitmap> {
    if (this.disposed) {
      return Promise.reject(new TiffWorkerError("TIFF worker disposed"))
    }
    return new Promise((resolve, reject) => {
      const requestId = this.nextRequestId++
      this.pendingDecodes.set(requestId, { resolve, reject })
      try {
        this.worker.postMessage({ type: "decodeFrame", requestId, frameIndex })
      } catch (error) {
        this.pendingDecodes.delete(requestId)
        reject(
          new TiffWorkerError("Failed to request TIFF frame decode", {
            cause: error,
          })
        )
      }
    })
  }

  dispose(reason = new TiffWorkerError("TIFF worker disposed")) {
    if (this.disposed) return
    this.disposed = true
    this.rejectInit(reason)
    this.rejectPending(reason)
    this.worker.terminate()
  }

  private handleMessage(message: TiffWorkerResponse) {
    if (message.type === "initOk") {
      this.initResolve?.(message.frames)
      this.initResolve = null
      this.initReject = null
      return
    }
    if (message.type === "initError") {
      this.disposed = true
      this.rejectInit(new TiffWorkerError(message.message))
      this.worker.terminate()
      return
    }
    if (message.type === "decodeFrameOk") {
      const pending = this.pendingDecodes.get(message.requestId)
      this.pendingDecodes.delete(message.requestId)
      if (pending) pending.resolve(message.bitmap)
      else closeBitmap(message.bitmap)
      return
    }
    const pending = this.pendingDecodes.get(message.requestId)
    this.pendingDecodes.delete(message.requestId)
    pending?.reject(new ImageDecodeError(message.message))
  }

  private fail(error: Error) {
    this.disposed = true
    this.rejectInit(error)
    this.rejectPending(error)
    this.worker.terminate()
  }

  private rejectInit(error: Error) {
    this.initReject?.(error)
    this.initResolve = null
    this.initReject = null
  }

  private rejectPending(error: Error) {
    for (const pending of this.pendingDecodes.values()) pending.reject(error)
    this.pendingDecodes.clear()
  }
}

export async function createTiffFrameSource(
  buffer: ArrayBuffer,
  createWorker: TiffWorkerFactory,
  maxDecodedFrames: number
): Promise<FrameSource> {
  const client = new TiffWorkerClient(createWorker)
  const frames = await client.init(buffer)
  return createFrameSource({
    kind: "tiff",
    frames,
    maxDecodedFrames,
    decode: (frameIndex) => client.decode(frameIndex),
    onDispose: (reason) => client.dispose(reason),
  })
}
