import {
  findPdfPageByOffset,
  getPdfPageLayout,
  type PdfPageLayoutModel,
} from "./pdf-viewer-layout";
import { clamp } from "./pdf-viewer-scale";
import type { PdfPageRenderTiming } from "./pdf-viewer-types";
import type { ViewerDocumentZoomMotionController } from "./viewer-types";

// A toolbar zoom step re-anchors the viewport CENTER on both axes (Apple
// Preview semantics): the content point under the viewport center before the
// step is back under the viewport center after it, and a short relax scales
// the painted surface about that fixed point. The reading-marker restore
// (20% from the top, block axis only) stays the semantics for every other
// geometry change — re-fits, rotation, container resizes — where the intent
// is "keep my reading position", not "zoom the camera".
const PDF_ZOOM_CENTER_MARKER_RATIO = 0.5;
const PDF_ZOOM_MOTION_DURATION_MS = 200;
const PDF_ZOOM_MOTION_MIN_TRANSLATE_PX = 0.5;
const PDF_ZOOM_MOTION_MIN_SCALE_DELTA = 0.001;
// A rebased (paged) physical scroll detaches the stage box from the content
// scale, so the whole-surface FLIP would warp. The two axes then stop scaling
// by the same ratio, which is exactly the detectable symptom.
const PDF_ZOOM_MOTION_AXIS_MISMATCH_RATIO = 0.02;
// Stall net: a hidden tab freezes rAF, and an abandoned counter-transform
// must never outlive its flight. Generous on purpose — it only fires when
// the clock stopped ticking.
const PDF_ZOOM_MOTION_STALL_TIMEOUT_MS = PDF_ZOOM_MOTION_DURATION_MS * 2 + 200;

// The exact wait-out of the relax before the visual clip re-tightens and
// rasterization resumes; clip release and raster holds are React-rendered
// state, so they outlive the inline writes.
export const PDF_ZOOM_MOTION_TOTAL_MS = PDF_ZOOM_MOTION_DURATION_MS + 100;

const PDF_ZOOM_SCROLL_RANGE_SELECTOR = '[data-slot="pdf-viewer-scroll-range"]';
const PDF_ZOOM_VISUAL_LAYER_SELECTOR = '[data-slot="pdf-viewer-visual-clip"]';

const PDF_ZOOM_FLIGHT_RECORD_LIMIT = 12;
const PDF_ZOOM_FLIGHT_TICK_LIMIT = 120;

export type PdfZoomTransaction = {
  /** Gesture timestamp — the flight's start-latency reference. */
  capturedAt: number;
  pageNumber: number;
  /**
   * Deliberately unclamped, like the reading anchor: the layout is linear in
   * scale, so a center marker resting in a gap or the edge padding restores
   * by the same page-relative fraction.
   */
  yPercent: number;
  /** Viewport-center position as a fraction of the stage's inline size. */
  inlineFraction: number | null;
  /** Painted visual-layer rect at click time — the relax's "first" frame. */
  previousVisualRect: DOMRectReadOnly | null;
};

export type PdfZoomMotionTick = {
  elapsedMs: number;
  frameGapMs: number;
  progress: number;
  scrollDriftPx: number;
};

export type PdfZoomMotionSkipReason =
  | "axis-scale-mismatch"
  | "bypass:resolve-failed"
  | "bypass:shell-transition"
  | "bypass:stale-intent"
  | "no-previous-rect"
  | "no-raf"
  | "no-visible-delta"
  | "no-visual-layer"
  | "reduced-motion"
  | "zero-rect";

export type PdfZoomMotionInterruption = "cancelled" | "none" | "stalled";

// Always-on flight recorder, mirroring the shell kernel's: every zoom relax
// (and every refusal to relax) leaves a bounded trace so a jagged report is
// diagnosable after the fact without re-instrumenting.
export type PdfZoomMotionFlightRecord = {
  durationMs: number;
  id: number;
  interruption: PdfZoomMotionInterruption;
  /** Long tasks observed while the flight was live (needs PerformanceObserver). */
  longTaskCount: number;
  longTaskMs: number;
  maxTickGapMs: number;
  /** Page raster work that landed mid-flight — the main jank source; 0 when healthy. */
  pageRenderCount: number;
  pageRenderMainThreadMs: number;
  scale: { x: number; y: number };
  /** Max |scroll − scroll@start| seen during the flight; scroll must be static. */
  scrollDriftMaxPx: number;
  /** Styles verified cleared at finish. */
  settledClean: boolean;
  skipReason: PdfZoomMotionSkipReason | null;
  /** Gesture capture → first painted-frame tick. */
  startLatencyMs: number | null;
  startedAt: number;
  status: "played" | "skipped";
  tickCount: number;
  ticks: PdfZoomMotionTick[];
  translate: { x: number; y: number };
};

const zoomFlightRecords: PdfZoomMotionFlightRecord[] = [];
let zoomFlightSequence = 0;
let liveZoomFlightRecord: PdfZoomMotionFlightRecord | null = null;

export function getPdfZoomMotionFlightRecords(): readonly PdfZoomMotionFlightRecord[] {
  return zoomFlightRecords.slice();
}

export function clearPdfZoomMotionFlightRecords() {
  zoomFlightRecords.length = 0;
  liveZoomFlightRecord = null;
}

/**
 * Attributes page raster work to a live zoom flight. Wired from the runtime's
 * render-timing tap; with the flight-time raster holds in place this counter
 * staying at 0 is the telemetry proof that no pdf.js work contends with the
 * relax.
 */
export function notePdfZoomMotionPageRender(timing: PdfPageRenderTiming) {
  const record = liveZoomFlightRecord;
  if (!record) return;
  record.pageRenderCount += 1;
  record.pageRenderMainThreadMs += Math.max(0, timing.durationMs);
}

function pushZoomFlightRecord(record: PdfZoomMotionFlightRecord) {
  zoomFlightRecords.push(record);
  if (zoomFlightRecords.length > PDF_ZOOM_FLIGHT_RECORD_LIMIT) {
    zoomFlightRecords.splice(
      0,
      zoomFlightRecords.length - PDF_ZOOM_FLIGHT_RECORD_LIMIT,
    );
  }
}

function createZoomFlightRecord({
  scaleX,
  scaleY,
  skipReason,
  translateX,
  translateY,
}: {
  scaleX: number;
  scaleY: number;
  skipReason: PdfZoomMotionSkipReason | null;
  translateX: number;
  translateY: number;
}): PdfZoomMotionFlightRecord {
  zoomFlightSequence += 1;
  return {
    durationMs: PDF_ZOOM_MOTION_DURATION_MS,
    id: zoomFlightSequence,
    interruption: "none",
    longTaskCount: 0,
    longTaskMs: 0,
    maxTickGapMs: 0,
    pageRenderCount: 0,
    pageRenderMainThreadMs: 0,
    scale: { x: scaleX, y: scaleY },
    scrollDriftMaxPx: 0,
    settledClean: skipReason !== null,
    skipReason,
    startLatencyMs: null,
    startedAt: readNow(),
    status: skipReason === null ? "played" : "skipped",
    tickCount: 0,
    ticks: [],
    translate: { x: translateX, y: translateY },
  };
}

function recordZoomFlightSkip(reason: PdfZoomMotionSkipReason) {
  pushZoomFlightRecord(
    createZoomFlightRecord({
      scaleX: 1,
      scaleY: 1,
      skipReason: reason,
      translateX: 0,
      translateY: 0,
    }),
  );
  return null;
}

export function createPdfZoomMotionController(
  layout: PdfPageLayoutModel,
): ViewerDocumentZoomMotionController<PdfZoomTransaction> {
  return {
    capture: ({ scrollTop, viewportElement }) =>
      capturePdfZoomTransaction({ layout, scrollTop, viewportElement }),
    noteBypass: (reason) => {
      recordZoomFlightSkip(`bypass:${reason}`);
    },
    resolveScrollTarget: ({ transaction, viewportElement }) =>
      resolvePdfZoomScrollTarget({ layout, transaction, viewportElement }),
    play: ({ transaction, viewportElement }) =>
      playPdfZoomMotion({ transaction, viewportElement }),
  };
}

export function capturePdfZoomTransaction({
  layout,
  scrollTop,
  viewportElement,
}: {
  layout: PdfPageLayoutModel;
  scrollTop: number;
  viewportElement: HTMLDivElement;
}): PdfZoomTransaction | null {
  if (layout.pageCount === 0) return null;

  const viewportBlockSize = Math.max(0, viewportElement.clientHeight);
  const centerOffset =
    Math.max(0, scrollTop) + viewportBlockSize * PDF_ZOOM_CENTER_MARKER_RATIO;
  const pageNumber = findPdfPageByOffset(layout, centerOffset);
  const pageLayout = getPdfPageLayout(layout, pageNumber);
  if (!pageLayout || pageLayout.height <= 0) return null;

  return {
    capturedAt: readNow(),
    pageNumber,
    yPercent: (centerOffset - pageLayout.offsetTop) / pageLayout.height,
    inlineFraction: capturePdfZoomInlineFraction(viewportElement),
    previousVisualRect: readElementRect(
      findPdfZoomVisualLayer(viewportElement),
    ),
  };
}

export function resolvePdfZoomScrollTarget({
  layout,
  transaction,
  viewportElement,
}: {
  layout: PdfPageLayoutModel;
  transaction: PdfZoomTransaction;
  viewportElement: HTMLDivElement;
}): { left?: number; top: number } | null {
  const pageLayout = getPdfPageLayout(layout, transaction.pageNumber);
  if (!pageLayout) return null;

  const viewportBlockSize = Math.max(0, viewportElement.clientHeight);
  const maxScrollTop = Math.max(0, layout.totalHeight - viewportBlockSize);
  const top = clamp(
    pageLayout.offsetTop +
      pageLayout.height * transaction.yPercent -
      viewportBlockSize * PDF_ZOOM_CENTER_MARKER_RATIO,
    0,
    maxScrollTop,
  );

  const left = resolvePdfZoomScrollLeft(viewportElement, transaction);
  return { top, ...(left == null ? null : { left }) };
}

// The stage (scroll range) is measured by live rects rather than re-deriving
// its centered offset, so the math is direction-agnostic: RTL scrollLeft
// coordinate spaces and the browser's own clamping both fall out for free.
function capturePdfZoomInlineFraction(viewportElement: HTMLDivElement) {
  const rangeRect = readElementRect(
    viewportElement.querySelector<HTMLElement>(PDF_ZOOM_SCROLL_RANGE_SELECTOR),
  );
  if (!rangeRect || rangeRect.width <= 0) return null;
  return (
    (getViewportCenterX(viewportElement) - rangeRect.left) / rangeRect.width
  );
}

function resolvePdfZoomScrollLeft(
  viewportElement: HTMLDivElement,
  transaction: PdfZoomTransaction,
) {
  if (transaction.inlineFraction == null) return undefined;
  const rangeRect = readElementRect(
    viewportElement.querySelector<HTMLElement>(PDF_ZOOM_SCROLL_RANGE_SELECTOR),
  );
  if (!rangeRect || rangeRect.width <= 0) return undefined;

  // Scroll right by however far the anchored content point currently sits
  // right of the viewport center; the browser clamps to the scrollable range
  // (which also zeroes it out when the stage fits without overflow).
  return (
    viewportElement.scrollLeft +
    (rangeRect.left + rangeRect.width * transaction.inlineFraction) -
    getViewportCenterX(viewportElement)
  );
}

// The relax is a kernel-style rAF clock, not a CSS transition: the clock
// anchors its ease at the first tick's FRAME time (the commit can burn ms
// before anything paints, and an ease anchored at the click lands its first
// painted frame that deep into the curve), every write is recorded as a
// flight tick, and translate/scale share one eased progress so the anchor
// point stays exactly fixed for the whole flight.
export function playPdfZoomMotion({
  transaction,
  viewportElement,
}: {
  transaction: PdfZoomTransaction;
  viewportElement: HTMLDivElement;
}): (() => void) | null {
  if (typeof requestAnimationFrame !== "function") {
    return recordZoomFlightSkip("no-raf");
  }
  if (prefersReducedMotion()) return recordZoomFlightSkip("reduced-motion");

  const previousRect = transaction.previousVisualRect;
  if (!previousRect) return recordZoomFlightSkip("no-previous-rect");
  const visualLayer = findPdfZoomVisualLayer(viewportElement);
  if (!visualLayer) return recordZoomFlightSkip("no-visual-layer");

  const currentRect = readElementRect(visualLayer);
  if (
    !currentRect ||
    previousRect.width <= 0 ||
    previousRect.height <= 0 ||
    currentRect.width <= 0 ||
    currentRect.height <= 0
  ) {
    return recordZoomFlightSkip("zero-rect");
  }

  const scaleX = previousRect.width / currentRect.width;
  const scaleY = previousRect.height / currentRect.height;
  if (
    Math.abs(scaleX - scaleY) >
    PDF_ZOOM_MOTION_AXIS_MISMATCH_RATIO * Math.max(scaleX, scaleY)
  ) {
    return recordZoomFlightSkip("axis-scale-mismatch");
  }

  const translateX = previousRect.left - currentRect.left;
  const translateY = previousRect.top - currentRect.top;
  const hasVisibleDelta =
    Math.abs(translateX) > PDF_ZOOM_MOTION_MIN_TRANSLATE_PX ||
    Math.abs(translateY) > PDF_ZOOM_MOTION_MIN_TRANSLATE_PX ||
    Math.abs(1 - scaleX) > PDF_ZOOM_MOTION_MIN_SCALE_DELTA ||
    Math.abs(1 - scaleY) > PDF_ZOOM_MOTION_MIN_SCALE_DELTA;
  if (!hasVisibleDelta) return recordZoomFlightSkip("no-visible-delta");

  // Re-express the relax about the viewport center instead of the stage's
  // top-left: the stage is the full document (hundreds of thousands of px
  // tall), and a scale that far from its origin runs into GPU float
  // precision. Anchoring at the viewport keeps the rasterized region's
  // coordinates small; the mapping is identical.
  const originX = getViewportCenterX(viewportElement) - currentRect.left;
  const originY =
    viewportElement.getBoundingClientRect().top +
    Math.max(0, viewportElement.clientHeight) / 2 -
    currentRect.top;
  const anchoredTranslateX = translateX + (scaleX - 1) * originX;
  const anchoredTranslateY = translateY + (scaleY - 1) * originY;

  const record = createZoomFlightRecord({
    scaleX,
    scaleY,
    skipReason: null,
    translateX: anchoredTranslateX,
    translateY: anchoredTranslateY,
  });
  pushZoomFlightRecord(record);
  liveZoomFlightRecord = record;

  const scrollLeftAtStart = viewportElement.scrollLeft;
  const scrollTopAtStart = viewportElement.scrollTop;
  const stopLongTaskObserver = observeZoomFlightLongTasks(record);

  let clockStartedAt: number | null = null;
  let lastTickAt: number | null = null;
  let rafHandle = 0;
  let stallTimeout: ReturnType<typeof setTimeout> | null = null;
  let finished = false;

  const writeFrame = (progress: number) => {
    const remaining = 1 - progress;
    const frameTranslateX = anchoredTranslateX * remaining;
    const frameTranslateY = anchoredTranslateY * remaining;
    const frameScaleX = scaleX + (1 - scaleX) * progress;
    const frameScaleY = scaleY + (1 - scaleY) * progress;
    visualLayer.style.transform = `translate3d(${frameTranslateX}px, ${frameTranslateY}px, 0px) scale(${frameScaleX}, ${frameScaleY})`;
  };

  const finish = (interruption: PdfZoomMotionInterruption) => {
    if (finished) return;
    finished = true;
    if (rafHandle !== 0) cancelAnimationFrame(rafHandle);
    if (stallTimeout !== null) clearTimeout(stallTimeout);
    stopLongTaskObserver();
    visualLayer.style.transform = "";
    visualLayer.style.transformOrigin = "";
    visualLayer.style.willChange = "";
    record.interruption = interruption;
    record.settledClean =
      visualLayer.style.transform === "" &&
      visualLayer.style.willChange === "";
    if (liveZoomFlightRecord === record) liveZoomFlightRecord = null;
  };

  const tick = (frameTime: number) => {
    rafHandle = 0;
    if (finished) return;
    const now = Number.isFinite(frameTime) ? frameTime : readNow();
    if (clockStartedAt === null) {
      clockStartedAt = now;
      record.startLatencyMs = Math.max(0, now - transaction.capturedAt);
    }
    const timeProgress = clamp(
      PDF_ZOOM_MOTION_DURATION_MS <= 0
        ? 1
        : (now - clockStartedAt) / PDF_ZOOM_MOTION_DURATION_MS,
      0,
      1,
    );
    const progress = easePdfZoomMotion(timeProgress);
    writeFrame(progress);

    const scrollDriftPx = Math.max(
      Math.abs(viewportElement.scrollTop - scrollTopAtStart),
      Math.abs(viewportElement.scrollLeft - scrollLeftAtStart),
    );
    record.scrollDriftMaxPx = Math.max(record.scrollDriftMaxPx, scrollDriftPx);
    const frameGapMs = lastTickAt === null ? 0 : now - lastTickAt;
    lastTickAt = now;
    record.maxTickGapMs = Math.max(record.maxTickGapMs, frameGapMs);
    record.tickCount += 1;
    if (record.ticks.length < PDF_ZOOM_FLIGHT_TICK_LIMIT) {
      record.ticks.push({
        elapsedMs: Math.max(0, now - clockStartedAt),
        frameGapMs,
        progress,
        scrollDriftPx,
      });
    }

    if (timeProgress >= 1) {
      finish("none");
      return;
    }
    rafHandle = requestAnimationFrame(tick);
  };

  // First frame is written synchronously inside the geometry commit, so the
  // discontinuity is hidden behind the counter-transform before first paint
  // (commit-then-relax); the clock itself starts at the next painted frame.
  visualLayer.style.transformOrigin = `${originX}px ${originY}px`;
  visualLayer.style.willChange = "transform";
  writeFrame(0);

  rafHandle = requestAnimationFrame(tick);
  stallTimeout = setTimeout(
    () => finish("stalled"),
    PDF_ZOOM_MOTION_STALL_TIMEOUT_MS,
  );

  return () => finish("cancelled");
}

function observeZoomFlightLongTasks(record: PdfZoomMotionFlightRecord) {
  if (typeof PerformanceObserver !== "function") return () => {};
  try {
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        record.longTaskCount += 1;
        record.longTaskMs += entry.duration;
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  } catch {
    // Long-task attribution is diagnostic, not correctness-critical; some
    // engines do not expose the entry type.
    return () => {};
  }
}

function easePdfZoomMotion(timeProgress: number) {
  // easeOutCubic: fast attack, gentle landing — a linear relax reads as a
  // hard stop at settle.
  const inverse = 1 - clamp(timeProgress, 0, 1);
  return 1 - inverse * inverse * inverse;
}

function findPdfZoomVisualLayer(viewportElement: HTMLDivElement) {
  if (typeof viewportElement.querySelector !== "function") return null;
  return viewportElement.querySelector<HTMLElement>(
    PDF_ZOOM_VISUAL_LAYER_SELECTOR,
  );
}

function getViewportCenterX(viewportElement: HTMLDivElement) {
  return (
    viewportElement.getBoundingClientRect().left +
    Math.max(0, viewportElement.clientWidth) / 2
  );
}

function readElementRect(element: HTMLElement | null) {
  if (!element || typeof element.getBoundingClientRect !== "function") {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function prefersReducedMotion() {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readNow() {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
