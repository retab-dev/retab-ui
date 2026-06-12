"use client"

import * as React from "react"
import type * as PptxNS from "pptxviewjs"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import {
  cachedThumbnailResource,
  shortName,
  timed,
  useThumbnailResource,
  withThumbnailDecodeSlot,
  type ThumbnailCacheEntry,
} from "@/components/document-thumbnail/cache"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"
import { ANCHOR_CORNER } from "@/components/document-thumbnail/types"

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

const pptxCache = new Map<string, ThumbnailCacheEntry<PptxFirstSlideSource>>()

function getPptxFirstSlide(
  resource: ViewerResource,
  cacheKey: string
): Promise<PptxFirstSlideSource> {
  return cachedThumbnailResource(pptxCache, cacheKey, () =>
    withThumbnailDecodeSlot(() =>
      timed(`pptx:total ${shortName(resource)}`, async () => {
        const [buf, mod] = await Promise.all([
          resource.readArrayBuffer(),
          loadPptx(),
        ])
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
  )
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
  resource,
  cacheKey,
  anchor,
}: {
  resource: ViewerResource
  cacheKey: string
  anchor: ThumbnailAnchor
}) {
  const source = useThumbnailResource(getPptxFirstSlide(resource, cacheKey))
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
