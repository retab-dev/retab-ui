// Web Worker that owns the TIFF decode (UTIF) so it never blocks the UI thread.
// The main thread transfers the file bytes in once; we parse the IFD list, then
// decode frames on demand, hand back GPU-ready ImageBitmaps (transferred, so the
// pixels never cross onto the main heap), and free UTIF's per-frame decode buffer
// as we go — otherwise UTIF retains every decoded frame's pixels on its IFD and
// memory grows with each page visited.
// @ts-expect-error utif ships no type declarations; typed via the local Ifd shape.
import UTIF from "utif"

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

type Req =
  | { type: "init"; buffer: ArrayBuffer }
  | { type: "decode"; id: number; index: number }

// Cast the worker global to `Worker` so onmessage/postMessage type-check under
// the DOM lib without pulling in the conflicting "webworker" lib.
const ctx = self as unknown as Worker

let buf: ArrayBuffer | null = null
let ifds: Ifd[] = []

ctx.onmessage = async (event: MessageEvent<Req>) => {
  const msg = event.data

  if (msg.type === "init") {
    try {
      buf = msg.buffer
      ifds = utif.decode(buf)
      if (ifds.length === 0) throw new Error("TIFF has no frames")
      const frames = ifds.map((ifd) => ({
        width: ifd.t256?.[0] ?? ifd.width ?? 0,
        height: ifd.t257?.[0] ?? ifd.height ?? 0,
      }))
      ctx.postMessage({ type: "init", ok: true, frames })
    } catch (err) {
      ctx.postMessage({ type: "init", ok: false, error: errorMessage(err) })
    }
    return
  }

  // decode
  try {
    if (!buf) throw new Error("worker not initialized")
    const ifd = ifds[msg.index]
    utif.decodeImage(buf, ifd)
    const rgba = utif.toRGBA8(ifd)
    const w = ifd.width ?? ifd.t256?.[0] ?? 0
    const h = ifd.height ?? ifd.t257?.[0] ?? 0
    const image = new ImageData(new Uint8ClampedArray(rgba), w, h)
    const bitmap = await createImageBitmap(image)
    // Free UTIF's retained decode buffer; the frame re-decodes cheaply if revisited.
    delete ifd.data
    ctx.postMessage({ type: "decoded", id: msg.id, bitmap }, [bitmap])
  } catch (err) {
    ctx.postMessage({ type: "error", id: msg.id, message: errorMessage(err) })
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "TIFF decode failed"
}
