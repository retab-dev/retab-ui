// Web Worker that owns TIFF decode (UTIF) so it never blocks the UI thread.
// The main thread transfers file bytes in once; the worker parses frame metadata
// up front, decodes requested frames on demand, and transfers ImageBitmaps back.
// @ts-expect-error utif ships no type declarations; typed via the local shape.
import UTIF from "utif"

import type {
  TiffWorkerRequest,
  TiffWorkerResponse,
} from "@/lib/image-tiff-source"

interface Ifd {
  t256?: number[]
  t257?: number[]
  width?: number
  height?: number
  data?: unknown
}

interface Utif {
  decode(buf: ArrayBuffer): Ifd[]
  decodeImage(buf: ArrayBuffer, ifd: Ifd): void
  toRGBA8(ifd: Ifd): Uint8Array
}

const utif = UTIF as Utif
const ctx = self as unknown as Worker

let buffer: ArrayBuffer | null = null
let ifds: Ifd[] = []

ctx.onmessage = async (event: MessageEvent<TiffWorkerRequest>) => {
  const message = event.data

  if (message.type === "init") {
    initialize(message.buffer)
    return
  }

  await decodeFrame(message.requestId, message.frameIndex)
}

function initialize(nextBuffer: ArrayBuffer) {
  try {
    buffer = nextBuffer
    ifds = utif.decode(buffer)
    if (ifds.length === 0) throw new Error("TIFF has no frames")
    post({
      type: "initOk",
      frames: ifds.map((ifd, frameIndex) => {
        const width = frameWidth(ifd)
        const height = frameHeight(ifd)
        if (!width || !height) {
          throw new Error(`TIFF frame ${frameIndex + 1} has no dimensions`)
        }
        return { intrinsicSize: { width, height } }
      }),
    })
  } catch (error) {
    post({ type: "initError", message: errorMessage(error) })
  }
}

async function decodeFrame(requestId: number, frameIndex: number) {
  let didDecode = false
  let ifd: Ifd | undefined
  try {
    if (!buffer) throw new Error("worker not initialized")
    if (frameIndex < 0 || frameIndex >= ifds.length) {
      throw new Error(`TIFF frame ${frameIndex + 1} is out of range`)
    }
    ifd = ifds[frameIndex]
    const width = frameWidth(ifd)
    const height = frameHeight(ifd)
    if (!width || !height) {
      throw new Error(`TIFF frame ${frameIndex + 1} has no dimensions`)
    }

    utif.decodeImage(buffer, ifd)
    didDecode = true
    const rgba = utif.toRGBA8(ifd)
    const image = new ImageData(new Uint8ClampedArray(rgba), width, height)
    const bitmap = await createImageBitmap(image)
    post({ type: "decodeFrameOk", requestId, bitmap }, [bitmap])
  } catch (error) {
    post({
      type: "decodeFrameError",
      requestId,
      message: `TIFF frame ${frameIndex + 1}: ${errorMessage(error)}`,
    })
  } finally {
    if (didDecode && ifd) delete ifd.data
  }
}

function post(message: TiffWorkerResponse, transfer?: Transferable[]): void {
  ctx.postMessage(message, transfer ?? [])
}

function frameWidth(ifd: Ifd): number {
  return ifd.width ?? ifd.t256?.[0] ?? 0
}

function frameHeight(ifd: Ifd): number {
  return ifd.height ?? ifd.t257?.[0] ?? 0
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "TIFF decode failed"
}
