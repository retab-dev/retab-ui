"use client"

import * as React from "react"
import type * as PptxNS from "pptxviewjs"

import { cn } from "@/lib/utils"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"
import { ANCHOR_CORNER } from "@/components/document-thumbnail/types"
import {
  shortName,
  timed,
  withDecodeSlot,
} from "@/components/document-thumbnail/cache"

let pptxLib: Promise<typeof PptxNS> | null = null
function loadPptx() {
  if (!pptxLib) pptxLib = import("pptxviewjs")
  return pptxLib
}

interface PptxFirstSlideSource {
  render: (canvas: HTMLCanvasElement, scale: number) => Promise<void>
  baseWidth: number
  baseHeight: number
}

const pptxCache = new Map<string, Promise<PptxFirstSlideSource>>()

function getPptxFirstSlide(
  src: string,
  resourceKey = src
): Promise<PptxFirstSlideSource> {
  let promise = pptxCache.get(resourceKey)
  if (!promise) {
    promise = withDecodeSlot(() =>
      timed(`pptx:total ${shortName(src)}`, async () => {
        const [res, mod] = await Promise.all([fetch(src), loadPptx()])
        if (!res.ok) throw new Error(`Failed to load presentation: ${res.status}`)
        const buf = await res.arrayBuffer()
        const { PPTXViewer } = mod
        const offscreen = document.createElement("canvas")
        const viewer = new PPTXViewer({
          canvas: offscreen,
          slideSizeMode: "actual",
        })
        await viewer.loadFile(buf)
        const size = await readSlideSize(buf.slice(0))
        const render = async (canvas: HTMLCanvasElement, scale: number) => {
          await viewer.renderSlide(0, canvas, { scale, quality: "high" })
        }
        return { render, baseWidth: size.width, baseHeight: size.height }
      })
    )
    pptxCache.set(resourceKey, promise)
  }
  return promise
}

const EMU_PER_PX = 9525

async function readSlideSize(buf: ArrayBuffer) {
  try {
    const mod = (await import("jszip")) as unknown as {
      default?: { loadAsync(b: ArrayBuffer): Promise<JSZipLike> }
      loadAsync?: (b: ArrayBuffer) => Promise<JSZipLike>
    }
    const JSZip = (mod.default ?? mod) as {
      loadAsync(b: ArrayBuffer): Promise<JSZipLike>
    }
    const zip = await JSZip.loadAsync(buf)
    const xml = await zip.file("ppt/presentation.xml")?.async("string")
    const m = xml?.match(/<p:sldSz[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/)
    if (m) {
      return {
        width: Math.round(Number(m[1]) / EMU_PER_PX),
        height: Math.round(Number(m[2]) / EMU_PER_PX),
      }
    }
  } catch {
    /* fall through */
  }
  return { width: 960, height: 720 }
}

interface JSZipLike {
  file(path: string): { async(type: "string"): Promise<string> } | null
}

export function PptxFirstSlide({
  src,
  resourceKey,
  anchor,
}: {
  src: string
  resourceKey: string
  anchor: ThumbnailAnchor
}) {
  const source = React.use(getPptxFirstSlide(src, resourceKey))
  const baseW = source.baseWidth || 960
  const baseH = source.baseHeight || 720
  const FILL_PX = 1024
  const scale = FILL_PX / Math.min(baseW, baseH)

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      let cancelled = false
      source.render(canvas, scale).catch(() => {})
      return () => {
        cancelled = true
        void cancelled
      }
    },
    [source, scale]
  )

  const landscape = baseW >= baseH
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute block",
          ANCHOR_CORNER[anchor],
          landscape ? "h-full w-auto max-w-none" : "h-auto w-full"
        )}
        style={{ aspectRatio: `${baseW} / ${baseH}` }}
      />
    </div>
  )
}
