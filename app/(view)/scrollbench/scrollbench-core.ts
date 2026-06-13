import type { FixedGridBenchmarkViewer } from "@/components/ui/fixed-grid-benchmark"

export type ViewerId =
  | "pdf"
  | "csv"
  | "json"
  | "json-form-sources"
  | "xlsx"
  | "text"
  | "docx"
  | "pptx"
  | "image"

export interface ViewerOption extends Omit<FixedGridBenchmarkViewer, "id"> {
  id: ViewerId
}

export interface ScenarioDefinition {
  id: "small" | "large"
  label: string
  stepRatio: number
}

export interface ScenarioResult {
  id: ScenarioDefinition["id"]
  label: string
  fps: number
  averageFrameMs: number
  p50FrameMs: number
  p95FrameMs: number
  maxFrameMs: number
  over16: number
  over33: number
  frames: number
  stepPx: number
  distancePx: number
}

export interface ImageRenderTiming {
  durationMs: number
  cached?: boolean
  status?: "rendered" | "cancelled" | "failed"
}

export interface DurationTimingResult {
  count: number
  totalMs: number
  averageMs: number
  p50Ms: number
  p95Ms: number
  maxMs: number
}

export interface ImageRenderingResult {
  count: number
  rendered: number
  cached: number
  failed: number
  cancelled: number
  totalMs: number
  averageMs: number
  p50Ms: number
  p95Ms: number
  maxMs: number
  cachedTiming: DurationTimingResult
  uncachedTiming: DurationTimingResult
}

export interface SourceLoadTimingResult {
  byteLength: number
  slideCount: number
  totalMs: number
  readBytesMs: number
  importPptxMs: number
  readSlideSizeMs: number
  loadFileMs: number
  inspectMs: number
}

export interface ScrollBenchResult {
  viewer: ViewerId
  measuredAt: string
  viewport: {
    clientHeight: number
    scrollHeight: number
    maxScrollTop: number
  }
  scenarios: ScenarioResult[]
  imageRendering?: ImageRenderingResult
  sourceLoad?: SourceLoadTimingResult
}

export const VIEWERS: readonly ViewerOption[] = [
  {
    id: "pdf",
    label: "PDF",
    sample: "big-911-report.pdf",
    scrollerSelector:
      '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
  },
  {
    id: "csv",
    label: "CSV",
    sample: "generated 20k row table",
    scrollerSelector: '[data-slot="csv-body"]',
  },
  {
    id: "json",
    label: "JSON table",
    sample: "generated 20k row JSON table",
    scrollerSelector: '[data-slot="json-table-scroll"]',
  },
  {
    id: "json-form-sources",
    label: "JSON form sources",
    sample: "homepage bank statement transactions",
    scrollerSelector: '[data-slot="json-form-table-scroll"]',
  },
  {
    id: "xlsx",
    label: "XLSX",
    sample: "nvidia-financials-fy2024.xlsx",
    scrollerSelector: '[data-slot="xlsx-body"]',
  },
  {
    id: "text",
    label: "Text",
    sample: "generated 30k line log",
    scrollerSelector:
      '[data-slot="text-viewer"] [data-slot="scroll-area-viewport"]',
  },
  {
    id: "docx",
    label: "DOCX",
    sample: "quarterly-business-review.docx",
    scrollerSelector:
      '[data-slot="docx-viewer"] [data-slot="scroll-area-viewport"]',
  },
  {
    id: "pptx",
    label: "PPTX",
    sample: "sample-presentation.pptx",
    scrollerSelector:
      '[data-slot="pptx-viewer"] [data-slot="scroll-area-viewport"]',
  },
  {
    id: "image",
    label: "Image",
    sample: "attention-page-1.png at 2x",
    scrollerSelector:
      '[data-slot="image-viewer"] [data-slot="scroll-area-viewport"]',
  },
]

export const SCENARIOS: readonly ScenarioDefinition[] = [
  { id: "small", label: "Small jump", stepRatio: 0.1 },
  { id: "large", label: "Large jump", stepRatio: 0.9 },
]

export const DEFAULT_VIEWER: ViewerId = "pdf"
export const FRAME_COUNT = 120
export const MIN_STEP_PX = 16
const MAX_FRAME_COUNT = 10_000

export function normalizeViewerId(value: string | null | undefined): ViewerId {
  if (VIEWERS.some((viewer) => viewer.id === value)) return value as ViewerId
  return DEFAULT_VIEWER
}

export function resolveScenario(id: ScenarioDefinition["id"]) {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? null
}

export function resolveViewer(id: ViewerId) {
  return VIEWERS.find((viewer) => viewer.id === id) ?? VIEWERS[0]
}

export function getScenarioStepPx({
  clientHeight,
  scenario,
}: {
  clientHeight: number
  scenario: ScenarioDefinition
}) {
  if (!Number.isFinite(clientHeight) || clientHeight <= 0) return MIN_STEP_PX
  if (!Number.isFinite(scenario.stepRatio) || scenario.stepRatio <= 0) {
    return MIN_STEP_PX
  }
  const stepPx = Math.round(clientHeight * scenario.stepRatio)
  return Number.isFinite(stepPx) && stepPx > 0
    ? Math.max(MIN_STEP_PX, stepPx)
    : MIN_STEP_PX
}

export function buildScrollTargets({
  maxScrollTop,
  stepPx,
  frameCount = FRAME_COUNT,
}: {
  maxScrollTop: number
  stepPx: number
  frameCount?: number
}) {
  if (
    !Number.isFinite(maxScrollTop) ||
    !Number.isFinite(stepPx) ||
    !Number.isFinite(frameCount) ||
    maxScrollTop <= 0 ||
    stepPx <= 0 ||
    frameCount <= 0
  ) {
    return []
  }
  const safeFrameCount = Math.min(Math.floor(frameCount), MAX_FRAME_COUNT)

  return Array.from({ length: safeFrameCount }, (_, frameIndex) =>
    Math.round(bouncePosition((frameIndex + 1) * stepPx, maxScrollTop))
  )
}

export function summarizeFrameDurations({
  scenario,
  frameDurations,
  stepPx,
  distancePx,
}: {
  scenario: ScenarioDefinition
  frameDurations: readonly number[]
  stepPx: number
  distancePx: number
}): ScenarioResult {
  const validFrameDurations = frameDurations.filter(
    (duration) => Number.isFinite(duration) && duration >= 0
  )
  const sortedDurations = [...validFrameDurations].sort((a, b) => a - b)
  const averageFrameMs =
    validFrameDurations.length === 0
      ? 0
      : validFrameDurations.reduce((sum, duration) => sum + duration, 0) /
        validFrameDurations.length

  return {
    id: scenario.id,
    label: scenario.label,
    fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
    averageFrameMs,
    p50FrameMs: percentile(sortedDurations, 0.5),
    p95FrameMs: percentile(sortedDurations, 0.95),
    maxFrameMs: sortedDurations[sortedDurations.length - 1] ?? 0,
    over16: validFrameDurations.filter((duration) => duration > 16.7).length,
    over33: validFrameDurations.filter((duration) => duration > 33.3).length,
    frames: validFrameDurations.length,
    stepPx: Number.isFinite(stepPx) && stepPx > 0 ? stepPx : 0,
    distancePx: Number.isFinite(distancePx) && distancePx > 0 ? distancePx : 0,
  }
}

export function summarizeImageRenderTimings(
  timings: readonly ImageRenderTiming[]
): ImageRenderingResult {
  const validTimings = timings.filter(
    (timing) => Number.isFinite(timing.durationMs) && timing.durationMs >= 0
  )
  const durations = validTimings
    .map((timing) => timing.durationMs)
    .sort((a, b) => a - b)
  const totalMs = durations.reduce((sum, duration) => sum + duration, 0)
  const count = validTimings.length

  return {
    count,
    rendered: validTimings.filter(
      (timing) => timing.status === undefined || timing.status === "rendered"
    ).length,
    cached: validTimings.filter((timing) => timing.cached === true).length,
    failed: validTimings.filter((timing) => timing.status === "failed").length,
    cancelled: validTimings.filter((timing) => timing.status === "cancelled")
      .length,
    totalMs,
    averageMs: count === 0 ? 0 : totalMs / count,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: durations[durations.length - 1] ?? 0,
    cachedTiming: summarizeDurationTimings(
      validTimings.filter((timing) => timing.cached === true)
    ),
    uncachedTiming: summarizeDurationTimings(
      validTimings.filter((timing) => timing.cached !== true)
    ),
  }
}

function summarizeDurationTimings(
  timings: readonly Pick<ImageRenderTiming, "durationMs">[]
): DurationTimingResult {
  const durations = timings
    .map((timing) => timing.durationMs)
    .filter((duration) => Number.isFinite(duration) && duration >= 0)
    .sort((a, b) => a - b)
  const totalMs = durations.reduce((sum, duration) => sum + duration, 0)
  const count = durations.length

  return {
    count,
    totalMs,
    averageMs: count === 0 ? 0 : totalMs / count,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: durations[durations.length - 1] ?? 0,
  }
}

export function measuredScrollDistance(targets: readonly number[]) {
  let previous = 0
  let distance = 0

  for (const target of targets) {
    if (!Number.isFinite(target) || target < 0) continue
    distance += Math.abs(target - previous)
    previous = target
  }

  return distance
}

export function percentile(
  sortedValues: readonly number[],
  percentileValue: number
) {
  if (sortedValues.length === 0) return 0
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * percentileValue))
  )
  return sortedValues[index] ?? 0
}

function bouncePosition(distance: number, maxScrollTop: number) {
  if (maxScrollTop <= 0) return 0

  const period = maxScrollTop * 2
  const offset = distance % period
  return offset <= maxScrollTop ? offset : period - offset
}
