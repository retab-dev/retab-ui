import type { Size } from "@/lib/image-geometry"

export class ImageLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "ImageLoadError"
  }
}

export class ImageDecodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "ImageDecodeError"
  }
}

export class ImageSourceDisposedError extends Error {
  constructor(message = "Image source disposed", options?: ErrorOptions) {
    super(message, options)
    this.name = "ImageSourceDisposedError"
  }
}

export class ImageFrameIndexError extends Error {
  constructor(frameIndex: number, frameCount: number) {
    super(
      `Invalid image frame index ${frameIndex}; expected 0-${Math.max(0, frameCount - 1)}`
    )
    this.name = "ImageFrameIndexError"
  }
}

export interface FrameDescriptor {
  intrinsicSize: Size
}

export interface FrameSource {
  kind: "native-image" | "tiff"
  frames: readonly FrameDescriptor[]
  acquire(frameIndex: number): Promise<ImageBitmap>
  release(frameIndex: number): void
  dispose(reason?: Error): void
}

interface BitmapCacheOptions {
  maxDecodedFrames: number
}

export class BitmapCache {
  private readonly bitmaps = new Map<number, ImageBitmap>()
  private readonly pinnedFrameIndexes = new Set<number>()
  private readonly frameRecency: number[] = []

  constructor(private readonly options: BitmapCacheOptions) {}

  get(frameIndex: number): ImageBitmap | undefined {
    const bitmap = this.bitmaps.get(frameIndex)
    if (bitmap) this.touch(frameIndex)
    return bitmap
  }

  set(frameIndex: number, bitmap: ImageBitmap) {
    this.bitmaps.set(frameIndex, bitmap)
    this.touch(frameIndex)
    this.evict()
  }

  pin(frameIndex: number) {
    this.pinnedFrameIndexes.add(frameIndex)
    this.touch(frameIndex)
  }

  unpin(frameIndex: number) {
    this.pinnedFrameIndexes.delete(frameIndex)
    this.evict()
  }

  dispose() {
    for (const bitmap of this.bitmaps.values()) closeBitmap(bitmap)
    this.bitmaps.clear()
    this.pinnedFrameIndexes.clear()
    this.frameRecency.length = 0
  }

  private touch(frameIndex: number) {
    const position = this.frameRecency.indexOf(frameIndex)
    if (position >= 0) this.frameRecency.splice(position, 1)
    this.frameRecency.push(frameIndex)
  }

  private evict() {
    for (const frameIndex of [...this.frameRecency]) {
      if (this.bitmaps.size <= this.options.maxDecodedFrames) break
      if (this.pinnedFrameIndexes.has(frameIndex)) continue
      closeBitmap(this.bitmaps.get(frameIndex))
      this.bitmaps.delete(frameIndex)
      this.frameRecency.splice(this.frameRecency.indexOf(frameIndex), 1)
    }
  }
}

interface CreateFrameSourceOptions {
  kind: FrameSource["kind"]
  frames: readonly FrameDescriptor[]
  decode(frameIndex: number): Promise<ImageBitmap>
  maxDecodedFrames: number
  onDispose?: (reason: Error) => void
}

interface InflightFrameDecode {
  promise: Promise<ImageBitmap>
  reject(error: Error): void
}

export function createFrameSource({
  kind,
  frames,
  decode,
  maxDecodedFrames,
  onDispose,
}: CreateFrameSourceOptions): FrameSource {
  const bitmapCache = new BitmapCache({ maxDecodedFrames })
  const inflightDecodes = new Map<number, InflightFrameDecode>()
  let disposed = false

  return {
    kind,
    frames,
    acquire(frameIndex) {
      if (disposed) return Promise.reject(new ImageSourceDisposedError())
      if (!isValidFrameIndex(frameIndex, frames.length)) {
        return Promise.reject(
          new ImageFrameIndexError(frameIndex, frames.length)
        )
      }
      bitmapCache.pin(frameIndex)
      const bitmap = bitmapCache.get(frameIndex)
      if (bitmap) return Promise.resolve(bitmap)

      let inflight = inflightDecodes.get(frameIndex)
      if (!inflight) {
        let rejectInflight: (error: Error) => void = () => {}
        const promise = new Promise<ImageBitmap>((resolve, reject) => {
          rejectInflight = reject
          decode(frameIndex)
            .then((decodedBitmap) => {
              inflightDecodes.delete(frameIndex)
              if (disposed) {
                closeBitmap(decodedBitmap)
                reject(new ImageSourceDisposedError())
                return
              }
              bitmapCache.set(frameIndex, decodedBitmap)
              resolve(decodedBitmap)
            })
            .catch((error) => {
              inflightDecodes.delete(frameIndex)
              bitmapCache.unpin(frameIndex)
              reject(toImageDecodeError(error))
            })
        })
        inflight = { promise, reject: rejectInflight }
        inflightDecodes.set(frameIndex, inflight)
      }

      return inflight.promise
    },
    release(frameIndex) {
      if (!isValidFrameIndex(frameIndex, frames.length)) return
      if (!disposed) bitmapCache.unpin(frameIndex)
    },
    dispose(reason = new ImageSourceDisposedError()) {
      if (disposed) return
      disposed = true
      bitmapCache.dispose()
      for (const inflight of inflightDecodes.values()) inflight.reject(reason)
      inflightDecodes.clear()
      onDispose?.(reason)
    },
  }
}

export async function createNativeImageFrameSource(
  bytes: ArrayBuffer,
  contentType: string | null,
  maxDecodedFrames: number
): Promise<FrameSource> {
  const blob = new Blob([bytes], { type: contentType ?? "" })
  return createNativeImageFrameSourceFromBlob(blob, maxDecodedFrames)
}

export async function createNativeImageFrameSourceFromBlob(
  blob: Blob,
  maxDecodedFrames: number
): Promise<FrameSource> {
  let probe: ImageBitmap
  try {
    probe = await createImageBitmap(blob)
  } catch (error) {
    throw new ImageDecodeError("Failed to decode image", { cause: error })
  }
  const frames: FrameDescriptor[] = [
    { intrinsicSize: { width: probe.width, height: probe.height } },
  ]
  probe.close()
  return createFrameSource({
    kind: "native-image",
    frames,
    maxDecodedFrames,
    decode: () => createImageBitmap(blob),
  })
}

export function isDeclaredTiff(
  src: string,
  contentType: string | null
): boolean {
  return /\.tiff?($|\?)/i.test(src) || isTiffContentType(contentType)
}

export function isDeclaredNativeImage(
  src: string,
  contentType: string | null
): boolean {
  if (isDeclaredTiff(src, contentType)) return false
  if (!contentType)
    return /\.(png|jpe?g|webp|gif|avif|bmp|ico)($|\?)/i.test(src)
  return /^image\/(png|jpe?g|webp|gif|avif|bmp|x-icon|vnd\.microsoft\.icon)(;|$)/i.test(
    contentType
  )
}

export function isTiffBytes(
  src: string,
  contentType: string | null,
  bytes: ArrayBuffer
): boolean {
  if (isDeclaredTiff(src, contentType)) return true
  const b = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  return (
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)
  )
}

export function closeBitmap(bitmap: ImageBitmap | undefined) {
  try {
    bitmap?.close()
  } catch {
    // Disposal must stay idempotent across browser edges and test doubles.
  }
}

function toImageDecodeError(error: unknown): ImageDecodeError {
  return error instanceof ImageDecodeError
    ? error
    : new ImageDecodeError("Image decode failed", { cause: error })
}

function isValidFrameIndex(frameIndex: number, frameCount: number) {
  return (
    Number.isInteger(frameIndex) && frameIndex >= 0 && frameIndex < frameCount
  )
}

function isTiffContentType(contentType: string | null): boolean {
  return contentType ? /^image\/(tiff|tif)(;|$)/i.test(contentType) : false
}
