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
  /** Derived from average rAF-to-rAF frame duration. This is display-cadence limited when work stays under budget. */
  fps: number
  /** Observed requestAnimationFrame cadence from the scenario frame samples. */
  rafFrameMs: number
  /** Estimated display/rAF ceiling. A measured FPS near this value means the benchmark has headroom, not equal viewer cost. */
  rafFps: number
  /** True when measured frames are close to rAF cadence and no frame-budget misses were observed. */
  isRafLimited: boolean
  minFrameMs: number
  averageFrameMs: number
  totalFrameMs: number
  frameStdDevMs: number
  p50FrameMs: number
  p75FrameMs: number
  p90FrameMs: number
  p95FrameMs: number
  p99FrameMs: number
  maxFrameMs: number
  over16: number
  over33: number
  over50: number
  over100: number
  over16Ratio: number
  over33Ratio: number
  estimatedDroppedFrames: number
  p95RafBudgetRatio: number
  maxRafBudgetRatio: number
  averageScrollMutationMs: number
  p95ScrollMutationMs: number
  maxScrollMutationMs: number
  domMutation: ScrollDomMutationResult
  slowestFrameIndex: number
  frames: number
  stepPx: number
  distancePx: number
  actualDistancePx: number
  averageScrollDeltaPx: number
  maxScrollDeltaPx: number
  minScrollTop: number
  maxScrollTop: number
  targetCount: number
  uniqueTargetCount: number
  directionChanges: number
  warmupFrameMs: number[]
  samples: ScrollFrameSample[]
}

export interface ScrollDomMutationResult {
  addedElements: number
  addedNodes: number
  attributeMutations: number
  characterDataMutations: number
  finalScrollportElementCount: number
  finalViewerElementCount: number
  initialScrollportElementCount: number
  initialViewerElementCount: number
  maxScrollportElementCount: number
  maxViewerElementCount: number
  mutationRecords: number
  removedElements: number
  removedNodes: number
}

export interface ScrollFrameSample {
  index: number
  targetScrollTop: number
  actualScrollTop: number
  scrollDeltaPx: number
  frameMs: number
  scrollMutationMs: number
  scrollportElementCount: number
  viewerElementCount: number
}

export interface ImageRenderTiming {
  durationMs: number
  pixelRatio?: number
  renderScale?: number
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
  firstUncachedMs: number
  p50Ms: number
  p95Ms: number
  maxMs: number
  maxPixelRatio: number
  maxRenderScale: number
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
    clientWidth: number
    scrollHeight: number
    scrollWidth: number
    maxScrollTop: number
    maxScrollLeft: number
    scrollportElementCount: number
    renderedElementCount: number
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
    label: "Code",
    sample: "generated 30k line log",
    scrollerSelector:
      '[data-slot="code-viewer"] [data-slot="scroll-area-viewport"]',
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
    sample: "entropy.tiff",
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
  samples,
  stepPx,
  distancePx,
  warmupFrameMs = [],
  domMutation,
}: {
  scenario: ScenarioDefinition
  frameDurations: readonly number[]
  samples?: readonly ScrollFrameSample[]
  stepPx: number
  distancePx: number
  warmupFrameMs?: readonly number[]
  domMutation?: Partial<ScrollDomMutationResult>
}): ScenarioResult {
  const candidateSamples =
    samples ??
    frameDurations.map((frameMs, index) => ({
      actualScrollTop: 0,
      frameMs,
      index,
      scrollDeltaPx: 0,
      scrollMutationMs: 0,
      scrollportElementCount: 0,
      targetScrollTop: 0,
      viewerElementCount: 0,
    }))
  const validSamples = candidateSamples.filter((sample) =>
    isFiniteNonNegative(sample.frameMs)
  )
  const validFrameDurations = validSamples.map((sample) => sample.frameMs)
  const sortedDurations = [...validFrameDurations].sort((a, b) => a - b)
  const totalFrameMs = validFrameDurations.reduce(
    (sum, duration) => sum + duration,
    0
  )
  const averageFrameMs =
    validFrameDurations.length === 0
      ? 0
      : totalFrameMs / validFrameDurations.length
  const scrollDeltas = validSamples
    .map((sample) => Math.abs(safeMetric(sample.scrollDeltaPx)))
    .filter((delta) => delta > 0)
  const actualScrollPositions = validSamples
    .map((sample) => safeMetric(sample.actualScrollTop))
    .filter((scrollTop) => scrollTop >= 0)
  const targetScrollPositions = validSamples
    .map((sample) => safeMetric(sample.targetScrollTop))
    .filter((scrollTop) => scrollTop >= 0)
  const scrollMutationDurations = validSamples
    .map((sample) => safeMetric(sample.scrollMutationMs))
    .filter(isFiniteNonNegative)
    .sort((a, b) => a - b)
  const totalScrollMutationMs = scrollMutationDurations.reduce(
    (sum, duration) => sum + duration,
    0
  )
  const directionChanges = countDirectionChanges(validSamples)
  const scrollportElementCounts = validSamples
    .map((sample) => safeMetric(sample.scrollportElementCount))
    .filter((count) => count >= 0)
  const viewerElementCounts = validSamples
    .map((sample) => safeMetric(sample.viewerElementCount))
    .filter((count) => count >= 0)
  const resolvedDomMutation = normalizeDomMutation({
    ...domMutation,
    maxScrollportElementCount: Math.max(
      domMutation?.maxScrollportElementCount ?? 0,
      ...scrollportElementCounts
    ),
    maxViewerElementCount: Math.max(
      domMutation?.maxViewerElementCount ?? 0,
      ...viewerElementCounts
    ),
  })
  const rafFrameMs = percentile(sortedDurations, 0.5)
  const rafFps = rafFrameMs > 0 ? 1000 / rafFrameMs : 0
  const p95FrameMs = percentile(sortedDurations, 0.95)
  const maxFrameMs = sortedDurations[sortedDurations.length - 1] ?? 0
  const over16 = validFrameDurations.filter(
    (duration) => duration > 16.7
  ).length
  const over33 = validFrameDurations.filter(
    (duration) => duration > 33.3
  ).length
  const p95RafBudgetRatio = rafFrameMs > 0 ? p95FrameMs / rafFrameMs : 0
  const maxRafBudgetRatio = rafFrameMs > 0 ? maxFrameMs / rafFrameMs : 0
  const isRafLimited =
    rafFrameMs > 0 &&
    validFrameDurations.length > 0 &&
    over16 === 0 &&
    averageFrameMs <= rafFrameMs * 1.2 &&
    p95FrameMs <= rafFrameMs * 1.35 &&
    maxFrameMs <= rafFrameMs * 1.5

  return {
    id: scenario.id,
    label: scenario.label,
    fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
    rafFrameMs,
    rafFps,
    isRafLimited,
    minFrameMs: sortedDurations[0] ?? 0,
    averageFrameMs,
    totalFrameMs,
    frameStdDevMs: standardDeviation(validFrameDurations, averageFrameMs),
    p50FrameMs: percentile(sortedDurations, 0.5),
    p75FrameMs: percentile(sortedDurations, 0.75),
    p90FrameMs: percentile(sortedDurations, 0.9),
    p95FrameMs,
    p99FrameMs: percentile(sortedDurations, 0.99),
    maxFrameMs,
    over16,
    over33,
    over50: validFrameDurations.filter((duration) => duration > 50).length,
    over100: validFrameDurations.filter((duration) => duration > 100).length,
    over16Ratio: ratio(over16, validFrameDurations.length),
    over33Ratio: ratio(over33, validFrameDurations.length),
    estimatedDroppedFrames: estimateDroppedFrames(validFrameDurations),
    p95RafBudgetRatio,
    maxRafBudgetRatio,
    averageScrollMutationMs:
      scrollMutationDurations.length === 0
        ? 0
        : totalScrollMutationMs / scrollMutationDurations.length,
    p95ScrollMutationMs: percentile(scrollMutationDurations, 0.95),
    maxScrollMutationMs:
      scrollMutationDurations[scrollMutationDurations.length - 1] ?? 0,
    domMutation: resolvedDomMutation,
    slowestFrameIndex: slowestFrameIndex(validSamples),
    frames: validFrameDurations.length,
    stepPx: Number.isFinite(stepPx) && stepPx > 0 ? stepPx : 0,
    distancePx: Number.isFinite(distancePx) && distancePx > 0 ? distancePx : 0,
    actualDistancePx: scrollDeltas.reduce((sum, delta) => sum + delta, 0),
    averageScrollDeltaPx:
      scrollDeltas.length === 0
        ? 0
        : scrollDeltas.reduce((sum, delta) => sum + delta, 0) /
          scrollDeltas.length,
    maxScrollDeltaPx: Math.max(0, ...scrollDeltas),
    minScrollTop: Math.min(0, ...actualScrollPositions),
    maxScrollTop: Math.max(0, ...actualScrollPositions),
    targetCount: targetScrollPositions.length,
    uniqueTargetCount: new Set(targetScrollPositions).size,
    directionChanges,
    warmupFrameMs: warmupFrameMs.filter(isFiniteNonNegative),
    samples: validSamples.map((sample, index) => ({
      actualScrollTop: safeMetric(sample.actualScrollTop),
      frameMs: safeMetric(sample.frameMs),
      index,
      scrollDeltaPx: safeMetric(sample.scrollDeltaPx),
      scrollMutationMs: safeMetric(sample.scrollMutationMs),
      scrollportElementCount: Math.floor(
        safeMetric(sample.scrollportElementCount)
      ),
      targetScrollTop: safeMetric(sample.targetScrollTop),
      viewerElementCount: Math.floor(safeMetric(sample.viewerElementCount)),
    })),
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
  const uncachedTimings = validTimings.filter(
    (timing) => timing.cached !== true
  )

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
    firstUncachedMs: uncachedTimings[0]?.durationMs ?? 0,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: durations[durations.length - 1] ?? 0,
    maxPixelRatio: maxFiniteMetric(validTimings, "pixelRatio"),
    maxRenderScale: maxFiniteMetric(validTimings, "renderScale"),
    cachedTiming: summarizeDurationTimings(
      validTimings.filter((timing) => timing.cached === true)
    ),
    uncachedTiming: summarizeDurationTimings(uncachedTimings),
  }
}

function maxFiniteMetric(
  timings: readonly ImageRenderTiming[],
  key: "pixelRatio" | "renderScale"
) {
  let max = 0
  for (const timing of timings) {
    const value = key === "pixelRatio" ? timing.pixelRatio : timing.renderScale
    if (typeof value === "number" && Number.isFinite(value) && value > max) {
      max = value
    }
  }
  return max
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

function countDirectionChanges(samples: readonly ScrollFrameSample[]) {
  let previousDirection = 0
  let changes = 0

  for (const sample of samples) {
    const delta = safeMetric(sample.scrollDeltaPx)
    const direction = delta === 0 ? 0 : delta > 0 ? 1 : -1
    if (direction === 0) continue
    if (previousDirection !== 0 && direction !== previousDirection) changes += 1
    previousDirection = direction
  }

  return changes
}

function estimateDroppedFrames(frameDurations: readonly number[]) {
  return frameDurations.reduce((total, duration) => {
    if (!Number.isFinite(duration) || duration <= 16.7) return total
    return total + Math.max(0, Math.floor(duration / 16.7) - 1)
  }, 0)
}

function isFiniteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0
}

function ratio(count: number, total: number) {
  return total === 0 ? 0 : count / total
}

function safeMetric(value: number) {
  return Number.isFinite(value) ? value : 0
}

function slowestFrameIndex(samples: readonly ScrollFrameSample[]) {
  let index = -1
  let maxFrameMs = -1

  for (const sample of samples) {
    if (!Number.isFinite(sample.frameMs) || sample.frameMs < maxFrameMs)
      continue
    maxFrameMs = sample.frameMs
    index = sample.index
  }

  return index
}

function standardDeviation(values: readonly number[], average: number) {
  if (values.length === 0) return 0
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length
  return Math.sqrt(variance)
}

function normalizeDomMutation(
  value: Partial<ScrollDomMutationResult> = {}
): ScrollDomMutationResult {
  return {
    addedElements: nonNegativeInteger(value.addedElements),
    addedNodes: nonNegativeInteger(value.addedNodes),
    attributeMutations: nonNegativeInteger(value.attributeMutations),
    characterDataMutations: nonNegativeInteger(value.characterDataMutations),
    finalScrollportElementCount: nonNegativeInteger(
      value.finalScrollportElementCount
    ),
    finalViewerElementCount: nonNegativeInteger(value.finalViewerElementCount),
    initialScrollportElementCount: nonNegativeInteger(
      value.initialScrollportElementCount
    ),
    initialViewerElementCount: nonNegativeInteger(
      value.initialViewerElementCount
    ),
    maxScrollportElementCount: nonNegativeInteger(
      value.maxScrollportElementCount
    ),
    maxViewerElementCount: nonNegativeInteger(value.maxViewerElementCount),
    mutationRecords: nonNegativeInteger(value.mutationRecords),
    removedElements: nonNegativeInteger(value.removedElements),
    removedNodes: nonNegativeInteger(value.removedNodes),
  }
}

function nonNegativeInteger(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0
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
