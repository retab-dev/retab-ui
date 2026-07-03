export type SidebarMotionBenchmarkMetricId =
  | "overshoot"
  | "back-and-forth"
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
  sampledFrameCount: number;
  scrollTarget: SidebarMotionBenchmarkScrollTargetId;
  side: string;
  status: "failed" | "passed";
};

type BenchmarkSample = {
  activeElementRole: string;
  anchors: string[];
  clientHeight: number;
  clientWidth: number;
  documentHasFocus: boolean;
  fingerprint: string;
  frameWidth: number;
  gapWidth: number;
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
};

const BENCHMARK_SCROLL_DEPTH_VIEWPORTS = 3.6;
const BENCHMARK_SCROLL_DEPTH_RATIO = 0.72;
const BENCHMARK_SAMPLE_FRAME_COUNT = 32;
const BENCHMARK_SETTLE_FRAME_COUNT = 16;
const BENCHMARK_RAPID_INTERRUPT_FRAME_COUNT = 2;
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

  const first = await sampleTransition(runtime, firstAction);
  const second = await sampleTransition(runtime, secondAction);
  const close = first.action === "close" ? first : second;
  const open = first.action === "open" ? first : second;
  const rapidToggle = await sampleRapidToggle(runtime);
  const metrics = [
    collectOvershootMetric(close, open),
    collectBackAndForthMetric(close, open),
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

  return {
    actionOrder,
    durationMs: performance.now() - startedAt,
    format,
    metrics,
    sampledFrameCount:
      close.samples.length + open.samples.length + rapidToggle.samples.length,
    scrollTarget: scrollTarget.id,
    side,
    status: metrics.every((metric) => metric.passed) ? "passed" : "failed",
  };
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

  for (let index = 0; index < 80; index += 1) {
    await nextAnimationFrame();
    const currentFingerprint = readBenchmarkFingerprint(runtime.root);

    if (currentFingerprint === previousFingerprint) {
      stableFrameCount += 1;
    } else {
      previousFingerprint = currentFingerprint;
      stableFrameCount = 0;
    }

    if (stableFrameCount >= 8) return;
  }
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
  const visualRect = resolveBenchmarkVisual(
    runtime.root,
  )?.getBoundingClientRect();
  const rendererAnchors = readRendererAnchors(runtime.root, scroller);
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  return {
    activeElementRole: readActiveElementRole(runtime, activeElement),
    anchors: rendererAnchors.map((anchor) => anchor.id),
    clientHeight: scroller?.clientHeight ?? 0,
    clientWidth: scroller?.clientWidth ?? 0,
    documentHasFocus: document.hasFocus(),
    fingerprint: readBenchmarkFingerprint(runtime.root),
    frameWidth: frameRect.width,
    gapWidth: gapRect.width,
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
    visualLeft: visualRect?.left ?? null,
    visualRight: visualRect?.right ?? null,
    visualTop: visualRect?.top ?? null,
    visualWidth: visualRect?.width ?? null,
    windowScrollY: window.scrollY,
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
  const drift = Math.max(
    scrollDriftPx(close, "scrollTop"),
    scrollDriftPx(close, "scrollLeft"),
    scrollDriftPx(close, "windowScrollY"),
    scrollDriftPx(open, "scrollTop"),
    scrollDriftPx(open, "scrollLeft"),
    scrollDriftPx(open, "windowScrollY"),
  );

  return {
    id: "scroll-drift",
    label: "Scroll drift",
    passed: drift <= 1,
    value: `${drift.toFixed(2)}px`,
    budget: "<= 1.00px",
    detail: "Viewport scroll offsets stay stable from before toggle to settle.",
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
    passed: eventCount === 0,
    value: String(eventCount),
    budget: "0",
    detail:
      "The sidebar toggle does not dispatch viewport or window scroll events.",
  };
}

function collectScrollGeometryMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const drift = Math.max(
    scrollHeightDriftPx(close),
    scrollHeightDriftPx(open),
    scrollWidthDriftPx(close),
    scrollWidthDriftPx(open),
    clientHeightDriftPx(close),
    clientHeightDriftPx(open),
    clientWidthDriftPx(close),
    clientWidthDriftPx(open),
  );

  return {
    id: "scroll-geometry",
    label: "Scroll geometry",
    passed: drift <= 2,
    value: `${drift.toFixed(2)}px`,
    budget: "<= 2.00px",
    detail:
      "Document scroll size and viewport size stay stable while the sidebar toggles.",
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
  const drift = Math.max(anchorTopDriftPx(close), anchorTopDriftPx(open));
  const churn =
    anchorIdentityFailureCount(close) + anchorIdentityFailureCount(open);

  return {
    id: "anchor-stability",
    label: "Anchor stability",
    passed: drift <= 3 && churn === 0,
    value: `${drift.toFixed(2)}px / ${churn}`,
    budget: "<= 3.00px / 0",
    detail:
      "The visible rendered anchor keeps the same identity and vertical position.",
  };
}

function collectCycleInvarianceMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const drift = settledSampleDriftPx(close.before, open.after);
  const fingerprintStable = close.before.fingerprint === open.after.fingerprint;

  return {
    id: "cycle-invariance",
    label: "Cycle invariance",
    passed: drift <= 2 && fingerprintStable,
    value: `${drift.toFixed(2)}px / ${fingerprintStable ? "same" : "changed"}`,
    budget: "<= 2.00px / same",
    detail:
      "After a close/open cycle, the viewer returns to the same settled geometry and renderer fingerprint.",
  };
}

function collectRapidToggleMetric(
  rapidToggle: BenchmarkRapidToggleRun,
): SidebarMotionBenchmarkMetric {
  const drift = settledSampleDriftPx(rapidToggle.before, rapidToggle.after);
  const eventCount =
    rapidToggle.scrollEventCount + rapidToggle.windowScrollEventCount;
  const stateStable =
    rapidToggle.before.sidebarOpen === rapidToggle.after.sidebarOpen &&
    rapidToggle.before.triggerExpanded === rapidToggle.after.triggerExpanded;

  return {
    id: "rapid-toggle",
    label: "Rapid toggle",
    passed: drift <= 2 && eventCount === 0 && stateStable,
    value: `${drift.toFixed(2)}px / ${eventCount} / ${
      stateStable ? "same" : "changed"
    }`,
    budget: "<= 2.00px / 0 / same",
    detail:
      "An interrupted close/open toggle returns to the same anchored settled state.",
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
    passed: mutationCount === 0 && nodeCount === 0,
    value: `${mutationCount} / ${nodeCount}`,
    budget: "0 / 0",
    detail:
      "The rendered document subtree does not add, remove, or replace nodes during sidebar motion.",
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
    passed: shiftScore <= 0.001,
    value: `${shiftScore.toFixed(4)} / ${shiftCount}`,
    budget: "<= 0.0010",
    detail: "The browser reports no meaningful layout shift during the toggle.",
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
    passed: longTaskDuration <= 50,
    value: `${longTaskDuration.toFixed(1)}ms / ${longTaskCount}`,
    budget: "<= 50.0ms",
    detail: "The toggle does not create long main-thread tasks.",
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
