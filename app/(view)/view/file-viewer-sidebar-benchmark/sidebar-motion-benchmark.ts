export type SidebarMotionBenchmarkMetricId =
  | "overshoot"
  | "back-and-forth"
  | "blink"
  | "canvas-pixel-continuity"
  | "motion-samples"
  | "scroll-drift"
  | "scroll-events"
  | "scroll-geometry"
  | "state-sync"
  | "focus-stability"
  | "sidebar-sync"
  | "renderer-continuity"
  | "anchor-stability"
  | "cycle-invariance"
  | "rapid-toggle"
  | "renderer-mutations"
  | "resource-quiet"
  | "layout-shift"
  | "main-thread"
  | "visual-smoothness";

export type SidebarMotionBenchmarkMetric = {
  budget: string;
  detail: string;
  id: SidebarMotionBenchmarkMetricId;
  label: string;
  passed: boolean;
  value: string;
};

export type SidebarMotionBenchmarkActionOrder = "close-open" | "open-close";

export type SidebarMotionBenchmarkScrollTargetId =
  | "top"
  | "one-viewport"
  | "page-boundary"
  | "page-4-gap"
  | "deep"
  | "near-bottom";

export type SidebarMotionBenchmarkOptions = {
  actionOrder?: SidebarMotionBenchmarkActionOrder;
  scrollTargetId?: SidebarMotionBenchmarkScrollTargetId;
};

export type SidebarMotionBenchmarkResult = {
  actionOrder: SidebarMotionBenchmarkActionOrder;
  durationMs: number;
  format: string;
  metrics: SidebarMotionBenchmarkMetric[];
  runs?: {
    close: BenchmarkMotionRun;
    open: BenchmarkMotionRun;
    rapidToggle: BenchmarkRapidToggleRun;
  };
  sampledFrameCount: number;
  scrollTarget: SidebarMotionBenchmarkScrollTargetId;
  side: string;
  status: "failed" | "passed";
};

type BenchmarkCanvasPixelSample = {
  primaryId: string | null;
  primaryInkRatio: number | null;
  primarySignature: string | null;
  visibleCanvasCount: number;
  visibleInkedCanvasCount: number;
};

type BenchmarkSample = {
  activeElementRole: string;
  anchors: string[];
  canvasPixels: BenchmarkCanvasPixelSample;
  clientHeight: number;
  clientWidth: number;
  documentHasFocus: boolean;
  fingerprint: string;
  format: string | null;
  frameWidth: number;
  gapWidth: number;
  readingAnchor: BenchmarkReadingAnchor | null;
  rendererAnchors: BenchmarkAnchor[];
  sidebarOpen: string | null;
  sidebarState: string | null;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  triggerExpanded: string | null;
  triggerState: string | null;
  visualBottom: number | null;
  visualLeft: number | null;
  visualRight: number | null;
  visualTop: number | null;
  visualWidth: number | null;
  windowScrollY: number;
};

type BenchmarkAnchor = {
  bottom: number;
  height: number;
  id: string;
  top: number;
};

type BenchmarkReadingAnchor =
  | {
      kind: "top";
    }
  | {
      id: string;
      kind: "boundary";
      topInViewport: number;
      yRatio: number;
    }
  | {
      id: string;
      kind: "page";
      markerTop: number;
      yRatio: number;
    };

type BenchmarkMotionRun = {
  action: "close" | "open";
  after: BenchmarkSample;
  before: BenchmarkSample;
  layoutShiftCount: number;
  layoutShiftScore: number;
  longTaskCount: number;
  longTaskDuration: number;
  rendererAddedNodeCount: number;
  rendererMutationCount: number;
  rendererRemovedNodeCount: number;
  resourceCountDelta: number;
  resourceNames: string[];
  samples: BenchmarkSample[];
  scrollEventCount: number;
  windowScrollEventCount: number;
};

type BenchmarkRapidToggleRun = Omit<BenchmarkMotionRun, "action"> & {
  action: "rapid-toggle";
  interruptFrameCount: number;
};

type BenchmarkScrollTarget = {
  bottomOffsetPx?: number;
  id: SidebarMotionBenchmarkScrollTargetId;
  label: string;
  minTop?: number;
  pdfPage?: number;
  pdfPageOffsetPx?: number;
  ratio?: number;
  top?: number;
  viewportMultiplier?: number;
};

type LayoutMetricKey = "frameWidth" | "gapWidth";
type VisualMetricKey =
  | "visualLeft"
  | "visualRight"
  | "visualTop"
  | "visualWidth";

type BenchmarkRuntime = {
  content: HTMLElement;
  frame: HTMLElement;
  gap: HTMLElement;
  root: HTMLElement;
  trigger: HTMLButtonElement;
};

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput?: boolean;
  value?: number;
  sources?: readonly { node?: Node | null }[];
};

const SIDEBAR_CHROME_SELECTOR =
  '[data-slot="file-viewer-sidebar-gap"],[data-slot="file-viewer-sidebar"],[data-slot="file-viewer-sidebar-rail"],[data-slot="file-viewer-sidebar-trigger"]';

// The inset and document-frame ELEMENTS resize to make room for the sidebar's
// inline push, so their own box reflows every frame — but they span reclaimed
// empty margin, not document content (which is pinned inside the stable content
// box). For a trailing-edge sidebar their top-left is fixed and CLS ignores
// them; for a leading-edge sidebar their left edge sweeps and CLS would flag
// the container even though the document is provably stationary. Their
// descendants (the real content) are NOT matched here, so a genuine content
// shift is still counted.
const SIDEBAR_REFLOW_CONTAINER_SELECTOR =
  '[data-slot="file-viewer-inset"],[data-slot="file-viewer-document-frame"],[data-slot="file-viewer-stable-content"]';

// A layout shift counts against the document only when it moves actual content
// — not the sidebar's own chrome and not the containers that reflow to make
// room for it. The sidebar slide is intended, input-triggered motion (which
// real CLS excludes via hadRecentInput — unavailable here because the benchmark
// toggles synthetically); the budget measures document stability. A genuine
// document shift still has a content source and is counted.
function isDocumentLayoutShift(entry: LayoutShiftEntry): boolean {
  if (entry.hadRecentInput) return false;
  const sources = entry.sources ?? [];
  if (sources.length === 0) return true;
  return sources.some((source) => {
    const element =
      source.node instanceof Element
        ? source.node
        : (source.node?.parentElement ?? null);
    if (element == null) return true;
    if (element.closest(SIDEBAR_CHROME_SELECTOR) != null) return false;
    if (element.matches(SIDEBAR_REFLOW_CONTAINER_SELECTOR)) return false;
    return true;
  });
}

const BENCHMARK_SCROLL_DEPTH_VIEWPORTS = 3.6;
const BENCHMARK_SCROLL_DEPTH_RATIO = 0.72;
const BENCHMARK_SAMPLE_FRAME_COUNT = 32;
const BENCHMARK_SETTLE_FRAME_COUNT = 16;
const BENCHMARK_RAPID_INTERRUPT_FRAME_COUNT = 2;
const READING_ANCHOR_Y_RATIO_BUDGET = 0.01;
const CYCLE_READING_ANCHOR_Y_RATIO_BUDGET = 0.005;
const READING_BOUNDARY_SNAP_PX = 24;
const DEFAULT_BENCHMARK_SCROLL_TARGET_ID = "deep";

export const SIDEBAR_MOTION_BENCHMARK_SCROLL_TARGETS = [
  { id: "top", label: "Top", top: 0 },
  {
    id: "one-viewport",
    label: "One viewport",
    minTop: 160,
    viewportMultiplier: 1,
  },
  {
    id: "page-boundary",
    label: "Page boundary",
    minTop: 160,
    viewportMultiplier: 2.05,
  },
  {
    id: "page-4-gap",
    label: "Page 4 gap",
    minTop: 160,
    pdfPage: 4,
    pdfPageOffsetPx: -96,
    viewportMultiplier: 4.05,
  },
  {
    id: "deep",
    label: "Deep",
    minTop: 160,
    ratio: BENCHMARK_SCROLL_DEPTH_RATIO,
    viewportMultiplier: BENCHMARK_SCROLL_DEPTH_VIEWPORTS,
  },
  { bottomOffsetPx: 64, id: "near-bottom", label: "Near bottom" },
] satisfies readonly BenchmarkScrollTarget[];

export async function runFileViewerSidebarMotionBenchmark(
  options: SidebarMotionBenchmarkOptions = {},
): Promise<SidebarMotionBenchmarkResult> {
  const startedAt = performance.now();
  const runtime = getBenchmarkRuntime();
  const actionOrder = options.actionOrder ?? "close-open";
  const scrollTarget = resolveScrollTarget(options.scrollTargetId);
  const format = runtime.root.dataset.benchmarkActiveFormat ?? "unknown";
  const side = runtime.root.dataset.benchmarkSide ?? "unknown";
  const firstAction = actionOrder === "close-open" ? "close" : "open";
  const secondAction = actionOrder === "close-open" ? "open" : "close";

  await setSidebarOpenState(runtime, firstAction === "close");
  await scrollBenchmarkViewport(runtime, scrollTarget);
  await waitForStableRenderer(runtime);
  await focusBenchmarkSurface(runtime);

  const first = await sampleTransition(runtime, firstAction);
  const second = await sampleTransition(runtime, secondAction);
  const close = first.action === "close" ? first : second;
  const open = first.action === "open" ? first : second;
  const rapidToggle = await sampleRapidToggle(runtime);
  const metrics = [
    collectOvershootMetric(close, open),
    collectBackAndForthMetric(close, open),
    collectBlinkMetric(close, open),
    collectCanvasPixelContinuityMetric(close, open),
    collectMotionSamplesMetric(close, open),
    collectScrollDriftMetric(close, open),
    collectScrollEventsMetric(close, open),
    collectScrollGeometryMetric(close, open),
    collectStateSyncMetric(close, open, rapidToggle),
    collectFocusStabilityMetric(close, open, rapidToggle),
    collectSidebarSyncMetric(close, open),
    collectRendererContinuityMetric(close, open),
    collectAnchorStabilityMetric(close, open),
    collectCycleInvarianceMetric(close, open),
    collectRapidToggleMetric(rapidToggle),
    collectRendererMutationsMetric(close, open),
    collectResourceQuietMetric(close, open),
    collectLayoutShiftMetric(close, open),
    collectMainThreadMetric(close, open),
    collectVisualSmoothnessMetric(close, open),
  ];
  const result = {
    actionOrder,
    durationMs: performance.now() - startedAt,
    format,
    metrics,
    runs: {
      close,
      open,
      rapidToggle,
    },
    sampledFrameCount:
      close.samples.length + open.samples.length + rapidToggle.samples.length,
    scrollTarget: scrollTarget.id,
    side,
    status: metrics.every((metric) => metric.passed) ? "passed" : "failed",
  } satisfies SidebarMotionBenchmarkResult;

  logSidebarMotionBenchmarkResult(result);
  return result;
}

function logSidebarMotionBenchmarkResult(result: SidebarMotionBenchmarkResult) {
  const metrics = result.metrics.map((metric) => ({
    budget: metric.budget,
    detail: metric.detail,
    id: metric.id,
    label: metric.label,
    passed: metric.passed,
    value: metric.value,
  }));
  const failedMetrics = metrics.filter((metric) => !metric.passed);
  const summary = {
    actionOrder: result.actionOrder,
    durationMs: Number(result.durationMs.toFixed(1)),
    failedMetricIds: failedMetrics.map((metric) => metric.id),
    format: result.format,
    metrics,
    passedMetricCount: metrics.filter((metric) => metric.passed).length,
    sampledFrameCount: result.sampledFrameCount,
    scrollTarget: result.scrollTarget,
    side: result.side,
    status: result.status,
    totalMetricCount: metrics.length,
  };
  const fullResultJson = JSON.stringify(result);

  console.info(
    "[file-viewer:sidebar-benchmark] result",
    JSON.stringify(summary),
  );
  console.info("[file-viewer:sidebar-benchmark] full result", fullResultJson);
  console.table(metrics);
  if (failedMetrics.length > 0) {
    console.warn(
      "[file-viewer:sidebar-benchmark] failures",
      JSON.stringify(failedMetrics),
    );
  }
}

function getBenchmarkRuntime(): BenchmarkRuntime {
  const root = document.querySelector<HTMLElement>(
    '[data-slot="file-viewer-root"][data-benchmark-active-format]',
  );
  const trigger = root?.querySelector<HTMLButtonElement>(
    '[data-slot="file-viewer-sidebar-trigger"]',
  );
  const gap = root?.querySelector<HTMLElement>(
    '[data-slot="file-viewer-sidebar-gap"]',
  );
  const frame = root?.querySelector<HTMLElement>(
    '[data-slot="file-viewer-document-frame"]',
  );
  const content = root?.querySelector<HTMLElement>(
    '[data-slot="file-viewer-content"]',
  );

  if (!root || !trigger || !gap || !frame || !content) {
    throw new Error("FileViewer benchmark fixture is not mounted.");
  }

  return { content, frame, gap, root, trigger };
}

async function setSidebarOpenState(runtime: BenchmarkRuntime, open: boolean) {
  if ((runtime.root.dataset.fileViewerSidebarOpen === "true") === open) return;
  runtime.trigger.click();
  await sampleAnimationFrames(24);
}

async function scrollBenchmarkViewport(
  runtime: BenchmarkRuntime,
  target: BenchmarkScrollTarget,
) {
  const scroller = resolveBenchmarkScroller(runtime.root);
  if (!scroller) return;

  const availableScroll = Math.max(
    0,
    scroller.scrollHeight - scroller.clientHeight,
  );
  const clampScrollTop = (scrollTop: number) =>
    Math.min(availableScroll, Math.max(0, scrollTop));

  if (target.top != null) {
    scroller.scrollTop = clampScrollTop(target.top);
  } else if (target.pdfPage != null) {
    const pdfPage = runtime.root.querySelector<HTMLElement>(
      `[data-slot="pdf-page"][data-page="${target.pdfPage}"]`,
    );

    if (pdfPage) {
      const pageRect = pdfPage.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();

      scroller.scrollTop = clampScrollTop(
        scroller.scrollTop +
          pageRect.top -
          scrollerRect.top +
          (target.pdfPageOffsetPx ?? 0),
      );
    } else {
      scroller.scrollTop = resolveFallbackScrollTop(target, scroller);
    }
  } else {
    scroller.scrollTop = resolveFallbackScrollTop(target, scroller);
  }

  scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
  await sampleAnimationFrames(4);
}

function resolveScrollTarget(
  scrollTargetId = DEFAULT_BENCHMARK_SCROLL_TARGET_ID,
) {
  return (
    SIDEBAR_MOTION_BENCHMARK_SCROLL_TARGETS.find(
      (target) => target.id === scrollTargetId,
    ) ??
    SIDEBAR_MOTION_BENCHMARK_SCROLL_TARGETS.find(
      (target) => target.id === DEFAULT_BENCHMARK_SCROLL_TARGET_ID,
    ) ??
    SIDEBAR_MOTION_BENCHMARK_SCROLL_TARGETS[0]
  );
}

function resolveFallbackScrollTop(
  target: BenchmarkScrollTarget,
  scroller: HTMLElement,
) {
  const availableScroll = Math.max(
    0,
    scroller.scrollHeight - scroller.clientHeight,
  );
  const candidates = [target.minTop ?? 0];

  if (target.viewportMultiplier != null) {
    candidates.push(scroller.clientHeight * target.viewportMultiplier);
  }
  if (target.ratio != null) {
    candidates.push(availableScroll * target.ratio);
  }
  if (target.bottomOffsetPx != null) {
    candidates.push(availableScroll - target.bottomOffsetPx);
  }

  return Math.min(availableScroll, Math.max(0, Math.max(...candidates)));
}

async function waitForStableRenderer(runtime: BenchmarkRuntime) {
  let previousFingerprint = readBenchmarkFingerprint(runtime.root);
  let stableFrameCount = 0;
  const isRendererReady = () => {
    if (runtime.root.dataset.benchmarkActiveFormat !== "pdf") return true;

    const visibleSlots = Array.from(
      runtime.root.querySelectorAll<HTMLElement>(
        '[data-slot="pdf-page-slot"][data-visible]',
      ),
    );
    if (visibleSlots.length === 0) return false;

    return visibleSlots.every((slot) =>
      Boolean(
        slot.querySelector(
          '[data-slot="pdf-page"] canvas[data-pdf-render-status="rendered"]',
        ),
      ),
    );
  };

  // The renderer must be fully settled — including any async page raster
  // backlog queued by the scroll — before the toggle is sampled, otherwise a
  // late render (and the layout adjustment its measured size triggers) leaks
  // into the measured window and reads as toggle-induced churn. A single
  // async page raster leaves the canvas count unchanged for many frames while
  // it runs, so a short stable run can end during a mid-render lull; require a
  // long continuous stable run plus a minimum elapsed time to drain the
  // backlog on heavy documents.
  for (let index = 0; index < 420; index += 1) {
    await nextAnimationFrame();
    const currentFingerprint = readBenchmarkFingerprint(runtime.root);

    if (currentFingerprint === previousFingerprint && isRendererReady()) {
      stableFrameCount += 1;
    } else {
      previousFingerprint = currentFingerprint;
      stableFrameCount = 0;
    }

    if (stableFrameCount >= 48 && index >= 180) return;
  }
}

async function focusBenchmarkSurface(runtime: BenchmarkRuntime) {
  if (runtime.root.contains(document.activeElement)) return;

  if (!runtime.content.hasAttribute("tabindex")) {
    runtime.content.tabIndex = -1;
  }
  runtime.content.focus({ preventScroll: true });
  await nextAnimationFrame();
}

async function sampleTransition(
  runtime: BenchmarkRuntime,
  action: BenchmarkMotionRun["action"],
): Promise<BenchmarkMotionRun> {
  const before = readSample(runtime);
  const samples: BenchmarkSample[] = [];
  const scroller = resolveBenchmarkScroller(runtime.root);
  const rendererRoot = resolveBenchmarkVisual(runtime.root) ?? runtime.frame;
  let scrollEventCount = 0;
  let windowScrollEventCount = 0;
  let rendererAddedNodeCount = 0;
  let rendererMutationCount = 0;
  let rendererRemovedNodeCount = 0;
  let layoutShiftCount = 0;
  let layoutShiftScore = 0;
  let longTaskCount = 0;
  let longTaskDuration = 0;
  const resourceCountBefore = performance.getEntriesByType("resource").length;
  const handleScroll = () => {
    scrollEventCount += 1;
  };
  const handleWindowScroll = () => {
    windowScrollEventCount += 1;
  };
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      rendererMutationCount += 1;
      rendererAddedNodeCount += record.addedNodes.length;
      rendererRemovedNodeCount += record.removedNodes.length;
    }
  });
  const layoutShiftObserver = createPerformanceObserver(
    "layout-shift",
    (entries) => {
      for (const entry of entries as LayoutShiftEntry[]) {
        if (!isDocumentLayoutShift(entry)) continue;
        layoutShiftCount += 1;
        layoutShiftScore += entry.value ?? 0;
      }
    },
  );
  const longTaskObserver = createPerformanceObserver("longtask", (entries) => {
    for (const entry of entries) {
      longTaskCount += 1;
      longTaskDuration += entry.duration;
    }
  });

  scroller?.addEventListener("scroll", handleScroll);
  window.addEventListener("scroll", handleWindowScroll);
  mutationObserver.observe(rendererRoot, { childList: true, subtree: true });

  try {
    runtime.trigger.click();

    for (let index = 0; index < BENCHMARK_SAMPLE_FRAME_COUNT; index += 1) {
      await nextAnimationFrame();
      samples.push(readSample(runtime));
    }

    await sampleAnimationFrames(BENCHMARK_SETTLE_FRAME_COUNT);

    return {
      action,
      before,
      layoutShiftCount,
      layoutShiftScore,
      longTaskCount,
      longTaskDuration,
      rendererAddedNodeCount,
      rendererMutationCount,
      rendererRemovedNodeCount,
      resourceCountDelta: Math.max(
        0,
        performance.getEntriesByType("resource").length - resourceCountBefore,
      ),
      resourceNames: performance
        .getEntriesByType("resource")
        .slice(resourceCountBefore)
        .map((entry) => entry.name),
      samples,
      after: readSample(runtime),
      scrollEventCount,
      windowScrollEventCount,
    };
  } finally {
    layoutShiftObserver?.disconnect();
    longTaskObserver?.disconnect();
    mutationObserver.disconnect();
    scroller?.removeEventListener("scroll", handleScroll);
    window.removeEventListener("scroll", handleWindowScroll);
  }
}

async function sampleRapidToggle(
  runtime: BenchmarkRuntime,
): Promise<BenchmarkRapidToggleRun> {
  const before = readSample(runtime);
  const samples: BenchmarkSample[] = [];
  const scroller = resolveBenchmarkScroller(runtime.root);
  const rendererRoot = resolveBenchmarkVisual(runtime.root) ?? runtime.frame;
  let scrollEventCount = 0;
  let windowScrollEventCount = 0;
  let rendererAddedNodeCount = 0;
  let rendererMutationCount = 0;
  let rendererRemovedNodeCount = 0;
  let layoutShiftCount = 0;
  let layoutShiftScore = 0;
  let longTaskCount = 0;
  let longTaskDuration = 0;
  const resourceCountBefore = performance.getEntriesByType("resource").length;
  const handleScroll = () => {
    scrollEventCount += 1;
  };
  const handleWindowScroll = () => {
    windowScrollEventCount += 1;
  };
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      rendererMutationCount += 1;
      rendererAddedNodeCount += record.addedNodes.length;
      rendererRemovedNodeCount += record.removedNodes.length;
    }
  });
  const layoutShiftObserver = createPerformanceObserver(
    "layout-shift",
    (entries) => {
      for (const entry of entries as LayoutShiftEntry[]) {
        if (!isDocumentLayoutShift(entry)) continue;
        layoutShiftCount += 1;
        layoutShiftScore += entry.value ?? 0;
      }
    },
  );
  const longTaskObserver = createPerformanceObserver("longtask", (entries) => {
    for (const entry of entries) {
      longTaskCount += 1;
      longTaskDuration += entry.duration;
    }
  });

  scroller?.addEventListener("scroll", handleScroll);
  window.addEventListener("scroll", handleWindowScroll);
  mutationObserver.observe(rendererRoot, { childList: true, subtree: true });

  try {
    runtime.trigger.click();
    await sampleAnimationFrames(BENCHMARK_RAPID_INTERRUPT_FRAME_COUNT);
    runtime.trigger.click();

    for (let index = 0; index < BENCHMARK_SAMPLE_FRAME_COUNT; index += 1) {
      await nextAnimationFrame();
      samples.push(readSample(runtime));
    }

    await sampleAnimationFrames(BENCHMARK_SETTLE_FRAME_COUNT);

    return {
      action: "rapid-toggle",
      before,
      interruptFrameCount: BENCHMARK_RAPID_INTERRUPT_FRAME_COUNT,
      layoutShiftCount,
      layoutShiftScore,
      longTaskCount,
      longTaskDuration,
      rendererAddedNodeCount,
      rendererMutationCount,
      rendererRemovedNodeCount,
      resourceCountDelta: Math.max(
        0,
        performance.getEntriesByType("resource").length - resourceCountBefore,
      ),
      resourceNames: performance
        .getEntriesByType("resource")
        .slice(resourceCountBefore)
        .map((entry) => entry.name),
      samples,
      after: readSample(runtime),
      scrollEventCount,
      windowScrollEventCount,
    };
  } finally {
    layoutShiftObserver?.disconnect();
    longTaskObserver?.disconnect();
    mutationObserver.disconnect();
    scroller?.removeEventListener("scroll", handleScroll);
    window.removeEventListener("scroll", handleWindowScroll);
  }
}

function readSample(runtime: BenchmarkRuntime): BenchmarkSample {
  const gapRect = runtime.gap.getBoundingClientRect();
  const frameRect = runtime.frame.getBoundingClientRect();
  const scroller = resolveBenchmarkScroller(runtime.root);
  const scrollerRect = scroller?.getBoundingClientRect() ?? null;
  const visualRect = resolveBenchmarkVisual(
    runtime.root,
  )?.getBoundingClientRect();
  // Measure the VISIBLE horizontal extent of the surface. The scroll viewport
  // clips horizontal overflow (overflow-x), so a surface that momentarily
  // overhangs the viewport — e.g. a document still at its pre-resize width while
  // the leading-edge inset sweeps toward it — is not something the reader sees;
  // its off-screen edge must not count as a visual hop. The true vertical extent
  // is kept, so a genuine vertical jump is still caught.
  const visualLeftClamped =
    visualRect && scrollerRect
      ? Math.max(visualRect.left, scrollerRect.left)
      : (visualRect?.left ?? null);
  const visualRightClamped =
    visualRect && scrollerRect
      ? Math.min(visualRect.right, scrollerRect.right)
      : (visualRect?.right ?? null);
  const visualWidthClamped =
    visualLeftClamped != null && visualRightClamped != null
      ? Math.max(0, visualRightClamped - visualLeftClamped)
      : null;
  const rendererAnchors = readRendererAnchors(runtime.root, scroller);
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  return {
    activeElementRole: readActiveElementRole(runtime, activeElement),
    anchors: rendererAnchors.map((anchor) => anchor.id),
    canvasPixels: readCanvasPixelSample(runtime, scrollerRect),
    clientHeight: scroller?.clientHeight ?? 0,
    clientWidth: scroller?.clientWidth ?? 0,
    documentHasFocus: document.hasFocus(),
    fingerprint: readBenchmarkFingerprint(runtime.root),
    format: runtime.root.dataset.benchmarkActiveFormat ?? null,
    frameWidth: frameRect.width,
    gapWidth: gapRect.width,
    readingAnchor: readReadingAnchor(scroller, rendererAnchors),
    rendererAnchors,
    sidebarOpen: runtime.root.dataset.fileViewerSidebarOpen ?? null,
    sidebarState: runtime.root.dataset.fileViewerSidebarState ?? null,
    scrollHeight: scroller?.scrollHeight ?? 0,
    scrollLeft: scroller?.scrollLeft ?? 0,
    scrollTop: scroller?.scrollTop ?? 0,
    scrollWidth: scroller?.scrollWidth ?? 0,
    triggerExpanded: runtime.trigger.getAttribute("aria-expanded"),
    triggerState: runtime.trigger.dataset.fileViewerSidebarState ?? null,
    visualBottom: visualRect?.bottom ?? null,
    visualLeft: visualLeftClamped,
    visualRight: visualRightClamped,
    visualTop: visualRect?.top ?? null,
    visualWidth: visualWidthClamped,
    windowScrollY: window.scrollY,
  };
}

// Mirror of the simple-pdf-file-viewer's pixel instrumentation: presence and
// data-attribute checks cannot see a canvas that is mounted and "ready" but
// momentarily cleared (a resize reassigns width/height, wiping the buffer
// before the redraw lands) — the whiteout the reader perceives as a blink.
// Reading the backing buffer is the only signal that catches it; CSS
// transforms do not affect it, so mid-slide scaling never false-positives.
// Sampling cost matters: per-point getImageData on the renderer's canvas
// forces a full GPU→CPU readback per call and inflates the very main-thread
// metric this benchmark scores. Instead, downsample the canvas to 8x8 with a
// GPU-side drawImage into a shared probe canvas, then do ONE 64-pixel
// readback per canvas. Downsampled cells average their region, so a text
// region reads as gray (< 245 luminance) and a wiped buffer reads blank.
const BENCHMARK_CANVAS_PROBE_SIZE = 8;
let benchmarkCanvasProbe: {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} | null = null;

function getBenchmarkCanvasProbe() {
  if (benchmarkCanvasProbe) return benchmarkCanvasProbe;
  const canvas = document.createElement("canvas");
  canvas.width = BENCHMARK_CANVAS_PROBE_SIZE;
  canvas.height = BENCHMARK_CANVAS_PROBE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  benchmarkCanvasProbe = { canvas, context };
  return benchmarkCanvasProbe;
}

function readBenchmarkCanvasInk(canvas: HTMLCanvasElement) {
  if (canvas.width <= 0 || canvas.height <= 0) return null;
  const probe = getBenchmarkCanvasProbe();
  if (!probe) return null;

  let hash = 2166136261;
  let inkCount = 0;
  const size = BENCHMARK_CANVAS_PROBE_SIZE;
  try {
    probe.context.clearRect(0, 0, size, size);
    probe.context.drawImage(canvas, 0, 0, size, size);
    const { data } = probe.context.getImageData(0, 0, size, size);
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (alpha > 0 && luminance < 245) inkCount += 1;
      hash ^= red;
      hash = Math.imul(hash, 16777619);
      hash ^= green;
      hash = Math.imul(hash, 16777619);
      hash ^= blue;
      hash = Math.imul(hash, 16777619);
      hash ^= alpha;
      hash = Math.imul(hash, 16777619);
    }
  } catch {
    return null;
  }

  return {
    inkRatio: inkCount / (size * size),
    signature: hash.toString(16),
  };
}

function readBenchmarkCanvasIdentity(canvas: HTMLCanvasElement) {
  const keyed = canvas.closest<HTMLElement>(
    "[data-page], [data-page-number], [data-slide-number], [data-frame-number]",
  );
  if (!keyed) return null;
  return (
    keyed.dataset.page ??
    keyed.dataset.pageNumber ??
    keyed.dataset.slideNumber ??
    keyed.dataset.frameNumber ??
    null
  );
}

function readCanvasPixelSample(
  runtime: BenchmarkRuntime,
  scrollerRect: DOMRect | null,
): BenchmarkCanvasPixelSample {
  const canvases = [
    ...runtime.frame.querySelectorAll<HTMLCanvasElement>("canvas"),
  ].filter((canvas) => {
    if (!scrollerRect) return true;
    const rect = canvas.getBoundingClientRect();
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      rect.bottom > scrollerRect.top + 1 &&
      rect.top < scrollerRect.bottom - 1
    );
  });

  let visibleInkedCanvasCount = 0;
  let primaryCanvas: HTMLCanvasElement | null = null;
  let primaryInk: ReturnType<typeof readBenchmarkCanvasInk> = null;
  const markerY = scrollerRect
    ? scrollerRect.top + scrollerRect.height * 0.2
    : null;

  for (const canvas of canvases) {
    const ink = readBenchmarkCanvasInk(canvas);
    if (ink && ink.inkRatio > 0) visibleInkedCanvasCount += 1;
    if (markerY != null && !primaryCanvas) {
      const rect = canvas.getBoundingClientRect();
      if (rect.top <= markerY && rect.bottom >= markerY) {
        primaryCanvas = canvas;
        primaryInk = ink;
      }
    }
  }
  if (!primaryCanvas && canvases.length > 0) {
    primaryCanvas = canvases[0];
    primaryInk = readBenchmarkCanvasInk(primaryCanvas);
  }

  return {
    primaryId: primaryCanvas ? readBenchmarkCanvasIdentity(primaryCanvas) : null,
    primaryInkRatio: primaryInk?.inkRatio ?? null,
    primarySignature: primaryInk?.signature ?? null,
    visibleCanvasCount: canvases.length,
    visibleInkedCanvasCount,
  };
}

function readActiveElementRole(
  runtime: BenchmarkRuntime,
  activeElement: HTMLElement | null,
) {
  if (!activeElement || activeElement === document.body) return "body";
  if (activeElement === runtime.trigger) return "trigger";
  if (runtime.root.contains(activeElement)) {
    return activeElement.dataset.slot ?? activeElement.tagName.toLowerCase();
  }
  return "outside";
}

function collectOvershootMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const overshoot = Math.max(
    overshootPx(close, "gapWidth"),
    overshootPx(close, "frameWidth"),
    overshootPx(open, "gapWidth"),
    overshootPx(open, "frameWidth"),
  );

  return {
    id: "overshoot",
    label: "Overshoot",
    passed: overshoot <= 1.5,
    value: `${overshoot.toFixed(2)}px`,
    budget: "<= 1.50px",
    detail:
      "Sidebar gap and document frame stay inside their start/end bounds.",
  };
}

function blinkFrameCount(run: BenchmarkMotionRun) {
  return [...run.samples, run.after].filter(
    (sample) =>
      sample.canvasPixels.visibleCanvasCount > 0 &&
      sample.canvasPixels.visibleInkedCanvasCount === 0 &&
      run.before.canvasPixels.visibleInkedCanvasCount > 0,
  ).length;
}

function collectBlinkMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const blinkFrames = blinkFrameCount(close) + blinkFrameCount(open);

  return {
    id: "blink",
    label: "Blink",
    passed: blinkFrames === 0,
    value: `${blinkFrames} frames`,
    budget: "0 blink frames",
    detail:
      "A blink frame has visible canvases but not one holds a single inked pixel — the buffer-cleared whiteout presence checks cannot see. Scoped to canvas-backed formats.",
  };
}

function primaryWhiteoutCount(run: BenchmarkMotionRun) {
  const samples = [run.before, ...run.samples, run.after];
  let whiteouts = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1].canvasPixels;
    const current = samples[index].canvasPixels;
    if (
      previous.primaryId != null &&
      previous.primaryId === current.primaryId &&
      previous.primaryInkRatio != null &&
      previous.primaryInkRatio > 0 &&
      current.primaryInkRatio === 0
    ) {
      whiteouts += 1;
    }
  }

  return whiteouts;
}

function collectCanvasPixelContinuityMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const whiteouts = primaryWhiteoutCount(close) + primaryWhiteoutCount(open);

  return {
    id: "canvas-pixel-continuity",
    label: "Canvas pixels",
    passed: whiteouts === 0,
    value: `${whiteouts} whiteouts`,
    budget: "0 whiteouts",
    detail:
      "The reading-marker canvas never goes from inked to fully blank while it stays the same page — a re-raster must land pixels before the old ones are wiped.",
  };
}

function collectBackAndForthMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const reversals =
    reversalCount(close, "gapWidth") +
    reversalCount(close, "frameWidth") +
    reversalCount(open, "gapWidth") +
    reversalCount(open, "frameWidth");

  return {
    id: "back-and-forth",
    label: "Back-and-forth",
    passed: reversals === 0,
    value: String(reversals),
    budget: "0",
    detail: "Sidebar gap and document frame move monotonically.",
  };
}

function collectMotionSamplesMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const movingSampleCount = Math.min(
    movingSamples(close).length,
    movingSamples(open).length,
  );
  const instantSnapProgress = Math.max(
    instantSnapProgressRatio(close, "gapWidth"),
    instantSnapProgressRatio(close, "frameWidth"),
    instantSnapProgressRatio(open, "gapWidth"),
    instantSnapProgressRatio(open, "frameWidth"),
  );

  return {
    id: "motion-samples",
    label: "Motion samples",
    passed: movingSampleCount >= 3 && instantSnapProgress <= 0.85,
    value: `${movingSampleCount} / ${instantSnapProgress.toFixed(3)}`,
    budget: ">= 3 / <= 0.850",
    detail:
      "The toggle produces intermediate frames instead of teleporting to the target layout.",
  };
}

function collectScrollDriftMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  // The vertical position legitimately rebases with a resize (that is the
  // reading-anchor rebase, covered by "Scroll identity"), but the HORIZONTAL
  // offset and the WINDOW scroll must not move — a sidebar toggle should never
  // scroll the page sideways or shift the whole document in the outer window.
  const drift = Math.max(
    scrollDriftPx(close, "scrollLeft"),
    scrollDriftPx(close, "windowScrollY"),
    scrollDriftPx(open, "scrollLeft"),
    scrollDriftPx(open, "windowScrollY"),
  );

  return {
    id: "scroll-drift",
    label: "Scroll drift",
    passed: drift <= 1,
    value: `${drift.toFixed(2)}px`,
    budget: "<= 1.00px",
    detail:
      "Horizontal and outer-window scroll stay put; only the vertical position rebases with the refit.",
  };
}

function collectScrollEventsMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const eventCount =
    close.scrollEventCount +
    close.windowScrollEventCount +
    open.scrollEventCount +
    open.windowScrollEventCount;

  return {
    id: "scroll-events",
    label: "Scroll events",
    // A fit-width resize rebases the vertical scroll once per direction to keep
    // the reading anchor in place; that programmatic scrollTop write dispatches
    // a scroll event. Bound it (one settle rebase per toggle direction) rather
    // than forbid it — a runaway scroll loop still trips the budget.
    passed: eventCount <= 4,
    value: String(eventCount),
    budget: "<= 4",
    detail:
      "The toggle dispatches at most one settle-rebase scroll per direction, never a scroll loop.",
  };
}

function collectScrollGeometryMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  // A shell-owned fit-width resize freezes renderer layout during the slide and
  // moves the surface with a transform; the DOM scroll range is materialized at
  // settle. The invariant is therefore the settled rendered reading anchor,
  // while in-flight smoothness is covered by renderer continuity, anchor
  // stability, and visual smoothness.
  const drift = Math.max(
    settledReadingIdentityDrift(close.before, close.after),
    settledReadingIdentityDrift(open.before, open.after),
  );

  return {
    id: "scroll-geometry",
    label: "Scroll identity",
    passed: drift <= READING_ANCHOR_Y_RATIO_BUDGET,
    value: formatReadingIdentityDrift(drift),
    budget: "<= 1.00%",
    detail:
      "The same rendered reading anchor lands at the same position after each refit.",
  };
}

function collectStateSyncMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
  rapidToggle: BenchmarkRapidToggleRun,
): SidebarMotionBenchmarkMetric {
  const stateFailures =
    stateSyncFailureCount(close) +
    stateSyncFailureCount(open) +
    stateSyncFailureCount(rapidToggle);
  const endpointFailures = [
    close.after.sidebarOpen === "false",
    close.after.triggerExpanded === "false",
    open.after.sidebarOpen === "true",
    open.after.triggerExpanded === "true",
    rapidToggle.after.sidebarOpen === rapidToggle.before.sidebarOpen,
    rapidToggle.after.triggerExpanded === rapidToggle.before.triggerExpanded,
  ].filter((passed) => !passed).length;

  return {
    id: "state-sync",
    label: "State sync",
    passed: stateFailures === 0 && endpointFailures === 0,
    value: `${stateFailures} / ${endpointFailures}`,
    budget: "0 / 0",
    detail:
      "Root state, trigger state, requested open state, and expanded state stay synchronized.",
  };
}

function collectFocusStabilityMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
  rapidToggle: BenchmarkRapidToggleRun,
): SidebarMotionBenchmarkMetric {
  const failures =
    focusFailureCount(close) +
    focusFailureCount(open) +
    focusFailureCount(rapidToggle);

  return {
    id: "focus-stability",
    label: "Focus stability",
    passed: failures === 0,
    value: String(failures),
    budget: "0",
    detail:
      "The document keeps focus and activeElement never escapes the benchmark root.",
  };
}

function collectSidebarSyncMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const syncDrift = Math.max(syncDriftPx(close), syncDriftPx(open));
  const progressDrift = Math.max(
    progressDriftRatio(close),
    progressDriftRatio(open),
  );

  return {
    id: "sidebar-sync",
    label: "Sidebar sync",
    passed: syncDrift <= 2.5 && progressDrift <= 0.18,
    value: `${syncDrift.toFixed(2)}px / ${progressDrift.toFixed(3)}`,
    budget: "<= 2.50px / <= 0.180",
    detail:
      "Sidebar gap and document frame conserve width and progress together.",
  };
}

function collectRendererContinuityMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const continuityFailures =
    rendererContinuityFailures(close) + rendererContinuityFailures(open);

  return {
    id: "renderer-continuity",
    label: "Renderer continuity",
    passed: continuityFailures === 0,
    value: String(continuityFailures),
    budget: "0",
    detail: "The visible rendered anchor remains present and nonblank.",
  };
}

function collectAnchorStabilityMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  // Under a zoom, a page's ABSOLUTE top must move (content far from the reading
  // line scales away from it) — so the old max-over-all-anchors pixel drift is
  // meaningless for a resize. What still matters: the visible reading content
  // keeps its identity (never blanks / is replaced mid-motion), and once the
  // refit resettles the reader is at the same document position.
  const churn =
    anchorIdentityFailureCount(close) + anchorIdentityFailureCount(open);
  const settleDrift = Math.max(
    settledReadingIdentityDrift(close.before, close.after),
    settledReadingIdentityDrift(open.before, open.after),
  );

  return {
    id: "anchor-stability",
    label: "Anchor stability",
    passed: churn === 0 && settleDrift <= 0.005,
    value: `${(settleDrift * 100).toFixed(2)}% / ${churn}`,
    budget: "<= 0.50% / 0",
    detail:
      "The reading content keeps its identity through the motion and resettles at the same document position.",
  };
}

function collectCycleInvarianceMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  // A close/open cycle returns to the same (open) state, so the reader must land
  // back at the same document position. Measured as rendered reading anchor
  // rather than scroll fraction, since short documents can change scroll range
  // substantially while keeping the same page content under the reading line.
  const drift = settledReadingIdentityDrift(close.before, open.after);

  return {
    id: "cycle-invariance",
    label: "Cycle invariance",
    passed: drift <= CYCLE_READING_ANCHOR_Y_RATIO_BUDGET,
    value: formatReadingIdentityDrift(drift),
    budget: "<= 0.50%",
    detail:
      "After a close/open cycle, the viewer returns to the same reading position.",
  };
}

function collectRapidToggleMetric(
  rapidToggle: BenchmarkRapidToggleRun,
): SidebarMotionBenchmarkMetric {
  // An interrupted toggle returns to the starting (open) state, so no net resize
  // occurs and the reader must land back where they were. Measured as reading
  // position; a bounded number of settle scroll events is allowed for the
  // reading-anchor rebase.
  const drift = settledReadingIdentityDrift(
    rapidToggle.before,
    rapidToggle.after,
  );
  const eventCount =
    rapidToggle.scrollEventCount + rapidToggle.windowScrollEventCount;
  const stateStable =
    rapidToggle.before.sidebarOpen === rapidToggle.after.sidebarOpen &&
    rapidToggle.before.triggerExpanded === rapidToggle.after.triggerExpanded;

  return {
    id: "rapid-toggle",
    label: "Rapid toggle",
    passed:
      drift <= CYCLE_READING_ANCHOR_Y_RATIO_BUDGET &&
      eventCount <= 2 &&
      stateStable,
    value: `${formatReadingIdentityDrift(drift)} / ${eventCount} / ${
      stateStable ? "same" : "changed"
    }`,
    budget: "<= 0.50% / <= 2 / same",
    detail:
      "An interrupted close/open toggle returns to the same reading position and state.",
  };
}

function collectRendererMutationsMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const mutationCount =
    close.rendererMutationCount + open.rendererMutationCount;
  const nodeCount =
    close.rendererAddedNodeCount +
    close.rendererRemovedNodeCount +
    open.rendererAddedNodeCount +
    open.rendererRemovedNodeCount;

  return {
    id: "renderer-mutations",
    label: "Renderer mutations",
    // A fit-width resize legitimately re-rasters the visible pages at the new
    // scale and re-virtualizes (a taller document fits fewer pages in view), so
    // some mutation and node churn is expected — this is no longer a zero.
    // The budget bounds that churn to catch a re-raster loop or unbounded node
    // growth, not to forbid the resize's re-render.
    passed: mutationCount <= 200 && nodeCount <= 200,
    value: `${mutationCount} / ${nodeCount}`,
    budget: "<= 200 / <= 200",
    detail:
      "The resize re-renders the visible subtree within a bounded budget, without a re-raster loop.",
  };
}

function collectResourceQuietMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const resourceCount = close.resourceCountDelta + open.resourceCountDelta;

  return {
    id: "resource-quiet",
    label: "Resource quiet",
    passed: resourceCount === 0,
    value: String(resourceCount),
    budget: "0",
    detail: "The toggle does not trigger resource, worker, or asset loads.",
  };
}

function collectLayoutShiftMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const shiftScore = close.layoutShiftScore + open.layoutShiftScore;
  const shiftCount = close.layoutShiftCount + open.layoutShiftCount;

  return {
    id: "layout-shift",
    label: "Layout shift",
    // A fit-width resize IS an intentional, input-triggered layout change (real
    // CLS excludes input-triggered shifts via hadRecentInput, which synthetic
    // clicks cannot set), so the document reflow it produces is expected, not a
    // defect. The budget bounds it to catch runaway/oscillating reflow while
    // accepting the one-shot resize.
    passed: shiftScore <= 8,
    value: `${shiftScore.toFixed(4)} / ${shiftCount}`,
    budget: "<= 8.0000",
    detail:
      "The document reflow stays a bounded one-shot resize, not runaway or oscillating shift.",
  };
}

function collectMainThreadMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const longTaskDuration = close.longTaskDuration + open.longTaskDuration;
  const longTaskCount = close.longTaskCount + open.longTaskCount;

  return {
    id: "main-thread",
    label: "Main thread",
    // The resize re-rasters the visible pages at the new scale on settle, which
    // is real main-thread work (raster is deferred off the slide so it never
    // starves the animation, then runs once at the end). Bound it to catch a
    // pathological blocking task while accepting the settle re-raster.
    passed: longTaskDuration <= 120,
    value: `${longTaskDuration.toFixed(1)}ms / ${longTaskCount}`,
    budget: "<= 120.0ms",
    detail:
      "Raster is deferred off the slide; the settle re-raster stays within a bounded main-thread budget.",
  };
}

function collectVisualSmoothnessMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const overshoot = Math.max(
    visualOvershootPx(close, "visualLeft"),
    visualOvershootPx(close, "visualRight"),
    visualOvershootPx(close, "visualTop"),
    visualOvershootPx(close, "visualWidth"),
    visualOvershootPx(open, "visualLeft"),
    visualOvershootPx(open, "visualRight"),
    visualOvershootPx(open, "visualTop"),
    visualOvershootPx(open, "visualWidth"),
  );
  const reversals =
    visualReversalCount(close, "visualLeft") +
    visualReversalCount(close, "visualRight") +
    visualReversalCount(close, "visualTop") +
    visualReversalCount(close, "visualWidth") +
    visualReversalCount(open, "visualLeft") +
    visualReversalCount(open, "visualRight") +
    visualReversalCount(open, "visualTop") +
    visualReversalCount(open, "visualWidth");
  const snap = Math.max(
    visualSettleSnapPx(close, "visualLeft"),
    visualSettleSnapPx(close, "visualRight"),
    visualSettleSnapPx(close, "visualTop"),
    visualSettleSnapPx(close, "visualWidth"),
    visualSettleSnapPx(open, "visualLeft"),
    visualSettleSnapPx(open, "visualRight"),
    visualSettleSnapPx(open, "visualTop"),
    visualSettleSnapPx(open, "visualWidth"),
  );

  return {
    id: "visual-smoothness",
    label: "Visual smoothness",
    passed: overshoot <= 2 && reversals === 0 && snap <= 3,
    value: `${overshoot.toFixed(2)}px / ${reversals} / ${snap.toFixed(2)}px`,
    budget: "<= 2.00px / 0 / <= 3.00px",
    detail: "The rendered surface position, size, and settle frame do not hop.",
  };
}

function overshootPx(run: BenchmarkMotionRun, key: "frameWidth" | "gapWidth") {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample[key],
  );
  const min = Math.min(run.before[key], run.after[key]);
  const max = Math.max(run.before[key], run.after[key]);

  return Math.max(
    0,
    ...values.map((value) => Math.max(min - value, value - max)),
  );
}

function reversalCount(run: BenchmarkMotionRun, key: LayoutMetricKey) {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample[key],
  );
  const direction =
    run.after[key] > run.before[key] ? "increasing" : "decreasing";
  let count = 0;

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (direction === "increasing" && current < previous - 1.25) count += 1;
    if (direction === "decreasing" && current > previous + 1.25) count += 1;
  }

  return count;
}

function instantSnapProgressRatio(
  run: BenchmarkMotionRun,
  key: LayoutMetricKey,
) {
  const first = run.samples[0]?.[key] ?? run.after[key];
  const travel = run.after[key] - run.before[key];
  if (Math.abs(travel) <= 8) return 0;
  return Math.abs((first - run.before[key]) / travel);
}

function scrollDriftPx(
  run: BenchmarkMotionRun,
  key: "scrollLeft" | "scrollTop" | "windowScrollY",
) {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample[key],
  );
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

// The reading position as a fraction of the document (0 = top, 1 = bottom). A
// fit-width resize changes the document's absolute scroll size, so absolute
// scrollTop/scrollHeight are NOT invariant — but the reader is still at the same
// place in the document, so this fraction is. It is the resize-era replacement
// for the old absolute scroll-geometry/scroll-drift invariants.
function readingFraction(sample: BenchmarkSample) {
  const range = Math.max(1, sample.scrollHeight - sample.clientHeight);
  return Math.min(1, Math.max(0, sample.scrollTop / range));
}

function readingFractionDrift(run: BenchmarkMotionRun) {
  const values = [run.before, ...run.samples, run.after].map(readingFraction);
  return Math.max(...values) - Math.min(...values);
}

function settledReadingFractionDrift(
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  return Math.abs(readingFraction(after) - readingFraction(before));
}

function settledReadingIdentityDrift(
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  const anchorDrift = readingAnchorYRatioDrift(before, after);
  return anchorDrift ?? settledReadingFractionDrift(before, after);
}

function readingAnchorYRatioDrift(
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  if (before.format !== "pdf" || after.format !== "pdf") return null;
  if (!before.readingAnchor || !after.readingAnchor) return null;
  if (before.readingAnchor.kind === "top") return 0;
  if (after.readingAnchor.kind === "top") return Infinity;
  if (before.readingAnchor.id !== after.readingAnchor.id) return Infinity;

  if (
    before.readingAnchor.kind === "boundary" &&
    after.readingAnchor.kind === "boundary"
  ) {
    return (
      Math.abs(
        before.readingAnchor.topInViewport - after.readingAnchor.topInViewport,
      ) / 1000
    );
  }

  return Math.abs(before.readingAnchor.yRatio - after.readingAnchor.yRatio);
}

function formatReadingIdentityDrift(drift: number) {
  return Number.isFinite(drift) ? `${(drift * 100).toFixed(2)}%` : "changed";
}

function scrollHeightDriftPx(run: BenchmarkMotionRun) {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample.scrollHeight,
  );
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function scrollWidthDriftPx(run: BenchmarkMotionRun) {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample.scrollWidth,
  );
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function clientHeightDriftPx(run: BenchmarkMotionRun) {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample.clientHeight,
  );
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function clientWidthDriftPx(run: BenchmarkMotionRun) {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample.clientWidth,
  );
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

function stateSyncFailureCount(
  run: BenchmarkMotionRun | BenchmarkRapidToggleRun,
) {
  return [run.before, ...run.samples, run.after].filter(
    (sample) =>
      sample.sidebarState == null ||
      sample.triggerState == null ||
      sample.sidebarState !== sample.triggerState,
  ).length;
}

function focusFailureCount(run: BenchmarkMotionRun | BenchmarkRapidToggleRun) {
  return [run.before, ...run.samples, run.after].filter(
    (sample) =>
      !sample.documentHasFocus || sample.activeElementRole === "outside",
  ).length;
}

function settledSampleDriftPx(before: BenchmarkSample, after: BenchmarkSample) {
  return Math.max(
    Math.abs(after.scrollTop - before.scrollTop),
    Math.abs(after.scrollLeft - before.scrollLeft),
    Math.abs(after.windowScrollY - before.windowScrollY),
    Math.abs(after.scrollHeight - before.scrollHeight),
    Math.abs(after.scrollWidth - before.scrollWidth),
    Math.abs(after.clientHeight - before.clientHeight),
    Math.abs(after.clientWidth - before.clientWidth),
    nullableDelta(before.visualTop, after.visualTop),
    nullableDelta(before.visualLeft, after.visualLeft),
    nullableDelta(before.visualRight, after.visualRight),
    nullableDelta(before.visualWidth, after.visualWidth),
    settledAnchorTopDriftPx(before, after),
  );
}

function settledAnchorTopDriftPx(
  before: BenchmarkSample,
  after: BenchmarkSample,
) {
  if (before.rendererAnchors.length === 0) return 0;

  return Math.max(
    0,
    ...before.rendererAnchors.map((beforeAnchor) => {
      const afterAnchor = after.rendererAnchors.find(
        (anchor) => anchor.id === beforeAnchor.id,
      );
      return afterAnchor ? Math.abs(afterAnchor.top - beforeAnchor.top) : 0;
    }),
  );
}

function nullableDelta(before: number | null, after: number | null) {
  return before == null || after == null ? 0 : Math.abs(after - before);
}

function syncDriftPx(run: BenchmarkMotionRun) {
  const values = [run.before, ...run.samples, run.after].map(
    (sample) => sample.gapWidth + sample.frameWidth,
  );
  return Math.max(...values) - Math.min(...values);
}

function progressDriftRatio(run: BenchmarkMotionRun) {
  const gapTravel = run.after.gapWidth - run.before.gapWidth;
  const frameTravel = run.after.frameWidth - run.before.frameWidth;
  if (Math.abs(gapTravel) <= 8 || Math.abs(frameTravel) <= 8) return 0;

  return Math.max(
    0,
    ...movingSamples(run).map((sample) =>
      Math.abs(
        progress(run.before.gapWidth, run.after.gapWidth, sample.gapWidth) -
          progress(
            run.before.frameWidth,
            run.after.frameWidth,
            sample.frameWidth,
          ),
      ),
    ),
  );
}

function rendererContinuityFailures(run: BenchmarkMotionRun) {
  const beforeAnchors = run.before.anchors;
  let failures = 0;

  for (const sample of [...run.samples, run.after]) {
    if (sample.anchors.length === 0) {
      failures += 1;
      continue;
    }
    if (
      beforeAnchors.length > 0 &&
      !beforeAnchors.some((anchor) => sample.anchors.includes(anchor))
    ) {
      failures += 1;
    }
  }

  return failures;
}

function anchorTopDriftPx(run: BenchmarkMotionRun) {
  const beforeAnchors = run.before.rendererAnchors;
  if (beforeAnchors.length === 0) return 0;

  return Math.max(
    0,
    ...[...run.samples, run.after].flatMap((sample) =>
      beforeAnchors.map((beforeAnchor) => {
        const currentAnchor = sample.rendererAnchors.find(
          (anchor) => anchor.id === beforeAnchor.id,
        );
        return currentAnchor
          ? Math.abs(currentAnchor.top - beforeAnchor.top)
          : 0;
      }),
    ),
  );
}

function anchorIdentityFailureCount(run: BenchmarkMotionRun) {
  const beforeAnchors = run.before.anchors;
  if (beforeAnchors.length === 0) return 0;

  return [...run.samples, run.after].filter(
    (sample) =>
      sample.anchors.length === 0 ||
      !beforeAnchors.some((anchor) => sample.anchors.includes(anchor)),
  ).length;
}

function visualOvershootPx(run: BenchmarkMotionRun, key: VisualMetricKey) {
  const values = nullableValues([run.before, ...run.samples, run.after], key);
  if (values.length === 0) return 0;
  const start = run.before[key];
  const end = run.after[key];
  if (start == null || end == null) return 0;
  const min = Math.min(start, end);
  const max = Math.max(start, end);

  return Math.max(
    0,
    ...values.map((value) => Math.max(min - value, value - max)),
  );
}

function visualReversalCount(run: BenchmarkMotionRun, key: VisualMetricKey) {
  const values = nullableValues([run.before, ...run.samples, run.after], key);
  if (values.length < 2) return 0;
  const start = run.before[key];
  const end = run.after[key];
  if (start == null || end == null || Math.abs(end - start) <= 8) return 0;
  const direction = end > start ? "increasing" : "decreasing";
  let count = 0;

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (direction === "increasing" && current < previous - 0.75) count += 1;
    if (direction === "decreasing" && current > previous + 0.75) count += 1;
  }

  return count;
}

function visualSettleSnapPx(run: BenchmarkMotionRun, key: VisualMetricKey) {
  const after = run.after[key];
  const lastSample = [...run.samples]
    .reverse()
    .find((sample) => sample[key] != null);
  const last = lastSample?.[key];
  if (after == null || last == null) return 0;
  return Math.abs(after - last);
}

function nullableValues(samples: BenchmarkSample[], key: VisualMetricKey) {
  return samples
    .map((sample) => sample[key])
    .filter((value): value is number => value != null);
}

function movingSamples(run: BenchmarkMotionRun) {
  const min = Math.min(run.before.gapWidth, run.after.gapWidth) + 1;
  const max = Math.max(run.before.gapWidth, run.after.gapWidth) - 1;
  return run.samples.filter(
    (sample) => sample.gapWidth > min && sample.gapWidth < max,
  );
}

function progress(start: number, end: number, value: number) {
  const travel = end - start;
  if (Math.abs(travel) < 0.001) return 1;
  return (value - start) / travel;
}

function createPerformanceObserver(
  entryType: string,
  handleEntries: (entries: PerformanceEntry[]) => void,
) {
  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes?.includes(entryType)
  ) {
    return null;
  }

  const observer = new PerformanceObserver((list) => {
    handleEntries(list.getEntries());
  });
  observer.observe({ type: entryType, buffered: false });
  return observer;
}

function readBenchmarkFingerprint(root: HTMLElement) {
  return JSON.stringify({
    canvases: root.querySelectorAll("canvas").length,
    csvRows: root.querySelectorAll('[data-slot="csv-row"]').length,
    docxPages: root.querySelectorAll(
      '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
    ).length,
    imageFrames: root.querySelectorAll('[data-slot="image-frame"]').length,
    markdownChunks: root.querySelectorAll("[data-markdown-chunk]").length,
    pdfPages: root.querySelectorAll('[data-slot="pdf-page"]').length,
    pptxSlides: root.querySelectorAll('[data-slot="pptx-slide"]').length,
    xlsxRows: root.querySelectorAll('[data-slot="xlsx-row"]').length,
  });
}

function readRendererAnchors(root: HTMLElement, scroller: HTMLElement | null) {
  const visual = resolveBenchmarkVisual(root);
  const viewportRect = (scroller ?? root).getBoundingClientRect();
  const isVisibleInViewport = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 1 &&
      rect.height > 1 &&
      rect.bottom > viewportRect.top + 1 &&
      rect.top < viewportRect.bottom - 1 &&
      rect.right > viewportRect.left + 1 &&
      rect.left < viewportRect.right - 1
    );
  };
  const format = root.dataset.benchmarkActiveFormat;
  const items =
    format === "pdf"
      ? keyedElements(root, '[data-slot="pdf-page"]', (element) => ({
          id: `pdf:${element.dataset.page ?? ""}`,
          rendered: Boolean(element.querySelector("canvas")),
        }))
      : format === "image" || format === "tiff"
        ? keyedElements(root, '[data-slot="image-frame"]', (element) => ({
            id: `image:${element.dataset.frameNumber ?? ""}`,
            rendered: Boolean(element.querySelector("canvas")),
          }))
        : format === "pptx"
          ? keyedElements(root, '[data-slot="pptx-slide"]', (element) => ({
              id: `pptx:${element.dataset.slideNumber ?? ""}`,
              rendered: true,
            }))
          : format === "docx"
            ? keyedElements(
                root,
                '[data-slot="docx-viewer"] .docx-wrapper > section.docx',
                (_element, index) => ({
                  id: `docx:${index + 1}`,
                  rendered: true,
                }),
              )
            : visual
              ? [
                  {
                    element: visual,
                    id: `${format ?? "renderer"}:surface`,
                    rendered: true,
                  },
                ]
              : [];
  const renderedItems = items.filter((item) => item.rendered);
  const visibleItems = renderedItems.filter((item) =>
    isVisibleInViewport(item.element),
  );
  const anchors = visibleItems.length > 0 ? visibleItems : renderedItems;

  return anchors.map((item) => {
    const rect = item.element.getBoundingClientRect();

    return {
      bottom: rect.bottom,
      height: rect.height,
      id: item.id,
      top: rect.top,
    };
  });
}

function readReadingAnchor(
  scroller: HTMLElement | null,
  anchors: BenchmarkAnchor[],
): BenchmarkReadingAnchor | null {
  if (!scroller || anchors.length === 0) return null;
  if (scroller.scrollTop <= 1) return { kind: "top" };

  const viewportRect = scroller.getBoundingClientRect();
  const markerOffset = viewportRect.height * 0.2;
  const markerTop = viewportRect.top + markerOffset;
  const containingAnchor = anchors.find(
    (anchor) => anchor.top <= markerTop && anchor.bottom >= markerTop,
  );
  let previousAnchor: BenchmarkAnchor | undefined;
  for (const anchor of anchors) {
    if (anchor.top <= markerTop) previousAnchor = anchor;
  }
  const nextAnchor = anchors.find((anchor) => anchor.top > markerTop);
  const anchor = containingAnchor ?? previousAnchor ?? nextAnchor;
  if (!anchor || anchor.height <= 0) return null;

  const topInViewport = anchor.top - viewportRect.top;
  const yRatio = Math.min(
    1,
    Math.max(0, (markerTop - anchor.top) / anchor.height),
  );
  if (
    Math.abs(topInViewport) <= Math.min(markerOffset, READING_BOUNDARY_SNAP_PX)
  ) {
    return {
      id: anchor.id,
      kind: "boundary",
      topInViewport: Math.round(topInViewport),
      yRatio,
    };
  }

  return {
    id: anchor.id,
    kind: "page",
    markerTop,
    yRatio,
  };
}

function keyedElements(
  root: HTMLElement,
  selector: string,
  read: (
    element: HTMLElement,
    index: number,
  ) => { id: string; rendered: boolean },
) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).map(
    (element, index) => ({
      element,
      ...read(element, index),
    }),
  );
}

function resolveBenchmarkScroller(root: HTMLElement) {
  return queryFirst(root, [
    '[data-slot="pdf-viewer"] [data-slot="scroll-area-viewport"]',
    '[data-slot="image-viewer"] [data-slot="scroll-area-viewport"]',
    '[data-slot="docx-viewer"] [data-slot="scroll-area-viewport"]',
    '[data-slot="pptx-viewer"] [data-slot="scroll-area-viewport"]',
    '[data-slot="markdown-greenfield-content"] [data-slot="scroll-area-viewport"]',
    '[data-slot="text-viewer"] [data-slot="scroll-area-viewport"]',
    '[data-slot="code-viewer"] [data-slot="scroll-area-viewport"]',
    '[data-slot="csv-body"]',
    '[data-slot="xlsx-body"]',
    '[data-slot="html-file-viewer-content"] > div:last-child',
    "[data-benchmark-viewport]",
  ]);
}

function resolveBenchmarkVisual(root: HTMLElement) {
  return queryFirst(root, [
    '[data-slot="pdf-viewer-visual-stage"]',
    '[data-slot="image-viewer-document"]',
    '[data-slot="pptx-viewer-document-surface"]',
    '[data-slot="docx-viewer"] .docx-wrapper',
    '[data-slot="markdown-virtual-canvas"]',
    '[data-slot="text-virtual-canvas"]',
    "[data-code-render-window]",
    '[data-slot="csv-grid"]',
    '[data-slot="xlsx-grid"]',
    '[data-slot="html-file-viewer-content"] iframe',
    '[data-slot="file-viewer-document-frame"]',
  ]);
}

function queryFirst(root: ParentNode, selectors: readonly string[]) {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) return element;
  }
  return null;
}

async function sampleAnimationFrames(count: number) {
  for (let index = 0; index < count; index += 1) {
    await nextAnimationFrame();
  }
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
