"use client"

import * as React from "react"
import type * as PptxNS from "pptxviewjs"

import { cn } from "@/lib/utils"
import type { ViewerResource } from "@/lib/viewer-resource"
import {
  cachedThumbnailResource,
  createThumbnailArtifactCache,
} from "@/components/document-thumbnail/thumbnail-cache"
import { withThumbnailDecodeSlot } from "@/components/document-thumbnail/thumbnail-decode-queue"
import { withThumbnailFormatError } from "@/components/document-thumbnail/thumbnail-errors"
import {
  shortName,
  timedThumbnail,
} from "@/components/document-thumbnail/thumbnail-profile"
import { useThumbnailResource } from "@/components/document-thumbnail/thumbnail-resource"
import {
  thumbnailFileMeta,
  type ThumbnailBytesContent,
  type ThumbnailFileMeta,
} from "@/components/document-thumbnail/thumbnail-text"
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
  dispose?: () => void
}

const pptxCache = createThumbnailArtifactCache<PptxFirstSlideSource>({
  maxEntries: 16,
  dispose: (source) => source.dispose?.(),
})

function getPptxFirstSlide(
  meta: ThumbnailFileMeta,
  content: ThumbnailBytesContent,
  thumbnailKey: string
): Promise<PptxFirstSlideSource> {
  return cachedThumbnailResource(pptxCache, thumbnailKey, () =>
    withThumbnailDecodeSlot(() =>
      withThumbnailFormatError(
        "pptx",
        "parse_failed",
        meta.fileName,
        "Failed to parse presentation thumbnail",
        () =>
          timedThumbnail(`pptx:total ${shortName(meta)}`, async () => {
            const [buf, mod] = await Promise.all([
              content.readBytes(),
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
            const disposableViewer = viewer as { dispose?: () => void }
            const render = async (canvas: HTMLCanvasElement, scale: number) => {
              await withThumbnailFormatError(
                "pptx",
                "render_failed",
                meta.fileName,
                "Failed to render presentation thumbnail",
                () => viewer.renderSlide(0, canvas, { scale, quality: "high" })
              )
            }
            return {
              render,
              baseWidth: size.width,
              baseHeight: size.height,
              dispose: () => disposableViewer.dispose?.(),
            }
          })
      )
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
  thumbnailKey,
  anchor,
}: {
  resource: ViewerResource
  thumbnailKey: string
  anchor: ThumbnailAnchor
}) {
  const source = useThumbnailResource(
    getPptxFirstSlide(
      thumbnailFileMeta(resource),
      resource.content,
      thumbnailKey
    )
  )
  const [renderError, setRenderError] = React.useState<unknown>(null)
  const baseW = source.baseWidth || 960
  const baseH = source.baseHeight || 720
  const FILL_PX = 1024
  const scale = FILL_PX / Math.min(baseW, baseH)

  if (renderError) throw renderError

  const canvasRef = React.useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      let active = true
      source.render(canvas, scale).catch((error: unknown) => {
        if (active) setRenderError(error)
      })
      return () => {
        active = false
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
