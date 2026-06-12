import type * as PptxNS from "pptxviewjs"

import {
  isViewerFormatError,
  ViewerFormatError,
  type ViewerFormatErrorKind,
  type ViewerFormatErrorMapperOptions,
} from "@/lib/viewer-errors"
import { type ViewerContentBytes } from "@/lib/viewer-resource"

import {
  DEFAULT_PPTX_SLIDE_SIZE,
  type PptxSize,
  type PptxSourceLoadTiming,
} from "./pptx-viewer-core"
import { parsePptxSlideSize } from "./pptx-viewer-presentation"

type PptxModule = typeof PptxNS

interface JSZipLike {
  loadAsync(data: ArrayBuffer): Promise<{
    file(path: string): { async(type: "string"): Promise<string> } | null
  }>
}

export type PptxRendererErrorKind = ViewerFormatErrorKind

export class PptxRendererError extends ViewerFormatError {
  override readonly kind: PptxRendererErrorKind

  constructor(kind: PptxRendererErrorKind, message: string, cause?: unknown) {
    super({ format: "pptx", kind, message, cause })
    this.name = "PptxRendererError"
    this.kind = kind
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

export async function createPptxRenderer(
  content: ViewerContentBytes,
  onLoadTiming?: (timing: PptxSourceLoadTiming) => void
): Promise<PptxRenderer> {
  const totalStartedAt = now()
  const readBytesStartedAt = now()
  const buffer = await readPptxBytes(content)
  const readBytesMs = now() - readBytesStartedAt

  const importPptxStartedAt = now()
  const pptxPromise = loadPptx().then((pptx) => ({
    pptx,
    durationMs: now() - importPptxStartedAt,
  }))
  const readSlideSizeStartedAt = now()
  const slideSizePromise = readSlideSize(buffer).then((baseSize) => ({
    baseSize,
    durationMs: now() - readSlideSizeStartedAt,
  }))
  const [pptx, baseSize] = await Promise.all([pptxPromise, slideSizePromise])
  const { PPTXViewer } = pptx.pptx
  const offscreen = document.createElement("canvas")
  const viewer = new PPTXViewer({
    canvas: offscreen,
    slideSizeMode: "actual",
    autoChartRerenderDelayMs: 0,
  })

  const loadFileStartedAt = now()
  try {
    await viewer.loadFile(buffer)
  } catch (error) {
    viewer.destroy?.()
    throw toPptxFormatError(error, {
      kind: "load_failed",
      message: "Failed to parse presentation.",
    })
  }
  const loadFileMs = now() - loadFileStartedAt

  let slideCount: number
  const inspectStartedAt = now()
  try {
    slideCount = viewer.getSlideCount()
  } catch (error) {
    viewer.destroy?.()
    throw toPptxFormatError(error, {
      kind: "load_failed",
      message: "Failed to inspect presentation slides.",
    })
  }
  const inspectMs = now() - inspectStartedAt
  if (!Number.isInteger(slideCount) || slideCount <= 0) {
    viewer.destroy?.()
    throw new PptxRendererError(
      "load_failed",
      "Presentation does not contain any slides."
    )
  }

  onLoadTiming?.({
    byteLength: buffer.byteLength,
    importPptxMs: pptx.durationMs,
    inspectMs,
    loadFileMs,
    readBytesMs,
    readSlideSizeMs: baseSize.durationMs,
    slideCount,
    totalMs: now() - totalStartedAt,
  })

  let disposed = false

  return {
    slideCount,
    baseSize: baseSize.baseSize,
    async renderSlide({ slideIndex, canvas, renderScale }) {
      if (disposed) {
        throw new PptxRendererError(
          "disposed",
          "Presentation renderer was disposed."
        )
      }
      if (!isValidSlideIndex(slideIndex, slideCount)) {
        throw new PptxRendererError(
          "index_out_of_range",
          `Slide ${slideIndex + 1} is outside the presentation.`
        )
      }
      if (!isValidRenderScale(renderScale)) {
        throw new PptxRendererError(
          "bounds",
          "Render scale must be a positive finite number."
        )
      }
      try {
        await viewer.renderSlide(slideIndex, canvas, {
          scale: renderScale,
          quality: "high",
        })
      } catch (error) {
        throw toPptxFormatError(error, {
          kind: "render_failed",
          message: `Failed to render slide ${slideIndex + 1}.`,
        })
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      viewer.destroy?.()
    },
  }
}

function toPptxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): PptxRendererError {
  if (error instanceof PptxRendererError) return error
  if (isViewerFormatError(error)) {
    return new PptxRendererError(error.kind, error.message, error.cause)
  }
  return new PptxRendererError(options.kind, options.message, error)
}

function readPptxBytes(content: ViewerContentBytes): Promise<ArrayBuffer> {
  return content.readBytes()
}

function isValidSlideIndex(slideIndex: number, slideCount: number) {
  return (
    Number.isInteger(slideIndex) && slideIndex >= 0 && slideIndex < slideCount
  )
}

function isValidRenderScale(renderScale: number) {
  return Number.isFinite(renderScale) && renderScale > 0
}

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now()
}

export function resetPptxRendererModules() {
  pptxModulePromise = null
  jszipPromise = null
}
