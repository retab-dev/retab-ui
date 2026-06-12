import type * as PptxNS from "pptxviewjs"

import { ResourceError, type ViewerResource } from "@/lib/viewer-resource"

import { DEFAULT_PPTX_SLIDE_SIZE, type PptxSize } from "./pptx-viewer-core"
import { parsePptxSlideSize } from "./pptx-viewer-presentation"

type PptxModule = typeof PptxNS

interface JSZipLike {
  loadAsync(data: ArrayBuffer): Promise<{
    file(path: string): { async(type: "string"): Promise<string> } | null
  }>
}

export type PptxRendererErrorKind =
  | "fetch_failed"
  | "load_failed"
  | "render_failed"
  | "disposed"

export class PptxRendererError extends Error {
  constructor(
    readonly kind: PptxRendererErrorKind,
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = "PptxRendererError"
  }
}

export interface PptxRenderInput {
  slideIndex: number
  canvas: HTMLCanvasElement
  renderScale: number
}

export interface PptxRenderer {
  slideCount: number
  baseSize: PptxSize
  renderSlide(input: PptxRenderInput): Promise<void>
  dispose(): void
}

let pptxModulePromise: Promise<PptxModule> | null = null
let jszipPromise: Promise<JSZipLike> | null = null

function loadPptx(): Promise<PptxModule> {
  if (!pptxModulePromise) pptxModulePromise = import("pptxviewjs")
  return pptxModulePromise
}

function loadJSZip(): Promise<JSZipLike> {
  if (!jszipPromise) {
    jszipPromise = import("jszip").then(
      (mod) =>
        ((mod as { default?: unknown }).default ?? mod) as unknown as JSZipLike
    )
  }
  return jszipPromise
}

async function readSlideSize(buffer: ArrayBuffer): Promise<PptxSize> {
  try {
    const JSZip = await loadJSZip()
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file("ppt/presentation.xml")?.async("string")
    return parsePptxSlideSize(xml)
  } catch {
    return DEFAULT_PPTX_SLIDE_SIZE
  }
}

async function readPptxResource(resource: ViewerResource) {
  try {
    return await resource.readArrayBuffer()
  } catch (error) {
    if (error instanceof ResourceError && error.kind === "http_error") {
      throw new PptxRendererError(
        "fetch_failed",
        `Failed to load presentation: ${error.status}`,
        error
      )
    }
    throw new PptxRendererError(
      "fetch_failed",
      "Failed to fetch presentation.",
      error
    )
  }
}

export async function createPptxRenderer(
  resource: ViewerResource
): Promise<PptxRenderer> {
  const buffer = await readPptxResource(resource)
  const [pptx, baseSize] = await Promise.all([
    loadPptx(),
    readSlideSize(buffer),
  ])
  const { PPTXViewer } = pptx
  const offscreen = document.createElement("canvas")
  const viewer = new PPTXViewer({
    canvas: offscreen,
    slideSizeMode: "actual",
    autoChartRerenderDelayMs: 0,
  })

  try {
    await viewer.loadFile(buffer)
  } catch (error) {
    throw new PptxRendererError(
      "load_failed",
      "Failed to parse presentation.",
      error
    )
  }

  let disposed = false

  return {
    slideCount: viewer.getSlideCount(),
    baseSize,
    async renderSlide({ slideIndex, canvas, renderScale }) {
      if (disposed) {
        throw new PptxRendererError(
          "disposed",
          "Presentation renderer was disposed."
        )
      }
      try {
        await viewer.renderSlide(slideIndex, canvas, {
          scale: renderScale,
          quality: "high",
        })
      } catch (error) {
        throw new PptxRendererError(
          "render_failed",
          `Failed to render slide ${slideIndex + 1}.`,
          error
        )
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      viewer.destroy?.()
    },
  }
}

export function resetPptxRendererModules() {
  pptxModulePromise = null
  jszipPromise = null
}
