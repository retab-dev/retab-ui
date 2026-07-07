export type SourceSwitchBenchmarkMetricId =
  | "switch-render"
  | "switch-warm-render"
  | "switch-continuity"
  | "switch-settled-state"
  | "switch-mutations";

export type SourceSwitchBenchmarkMetric = {
  budget: string;
  detail: string;
  id: SourceSwitchBenchmarkMetricId;
  label: string;
  passed: boolean;
  value: string;
};

export type SourceSwitchBenchmarkPhase = "cold" | "warm";

export type SourceSwitchBenchmarkRun = {
  addedNodeCount: number;
  beforeHadContent: boolean;
  durationMs: number;
  emptyFrameCount: number;
  from: string;
  layoutShiftScore: number;
  mutationCount: number;
  oldContentDroppedAtMs: number | null;
  phase: SourceSwitchBenchmarkPhase;
  removedNodeCount: number;
  sampledFrameCount: number;
  settledHasContent: boolean;
  skeletonFrameCount: number;
  timeToContentMs: number | null;
  to: string;
};

export type SourceSwitchBenchmarkResult = {
  durationMs: number;
  formats: string[];
  metrics: SourceSwitchBenchmarkMetric[];
  runs: SourceSwitchBenchmarkRun[];
  sampledFrameCount: number;
  status: "failed" | "passed";
};

export type SourceSwitchBenchmarkOptions = {
  formats?: readonly string[];
  switchTimeoutMs?: number;
};

const SOURCE_SWITCH_RENDER_BUDGET_MS = 5_000;
const SOURCE_SWITCH_WARM_RENDER_BUDGET_MS = 1_000;
const SOURCE_SWITCH_MUTATION_BUDGET = 2_000;
const SOURCE_SWITCH_MIN_TEXT_CONTENT_LENGTH = 80;
const SOURCE_SWITCH_SETTLE_FRAME_COUNT = 12;

type SourceSwitchRuntime = {
  formatButtons: Map<string, HTMLButtonElement>;
  surface: HTMLElement;
};

type SourceSwitchSample = {
  hasContent: boolean;
  skeletonCount: number;
};

export async function runFileViewerSourceSwitchBenchmark(
  options: SourceSwitchBenchmarkOptions = {},
): Promise<SourceSwitchBenchmarkResult> {
  const startedAt = performance.now();
  const runtime = getSourceSwitchRuntime();
  const formats =
    options.formats && options.formats.length > 1
      ? [...options.formats]
      : [...runtime.formatButtons.keys()];
  const switchTimeoutMs =
    options.switchTimeoutMs ?? SOURCE_SWITCH_RENDER_BUDGET_MS;
  const runs: SourceSwitchBenchmarkRun[] = [];

  await activateSourceSwitchFormat(runtime, formats[0], switchTimeoutMs);

  // Cold pass: first visit of each format this page load. Warm pass: walk
  // back through formats already rendered once, where caches should make the
  // switch near-instant.
  for (let index = 1; index < formats.length; index += 1) {
    runs.push(
      await sampleSourceSwitch(runtime, {
        from: formats[index - 1],
        phase: "cold",
        switchTimeoutMs,
        to: formats[index],
      }),
    );
  }
  for (let index = formats.length - 2; index >= 0; index -= 1) {
    runs.push(
      await sampleSourceSwitch(runtime, {
        from: formats[index + 1],
        phase: "warm",
        switchTimeoutMs,
        to: formats[index],
      }),
    );
  }

  const metrics = collectSourceSwitchMetrics(runs);
  const result: SourceSwitchBenchmarkResult = {
    durationMs: Math.max(0, performance.now() - startedAt),
    formats,
    metrics,
    runs,
    sampledFrameCount: runs.reduce(
      (count, run) => count + run.sampledFrameCount,
      0,
    ),
    status: metrics.every((metric) => metric.passed) ? "passed" : "failed",
  };

  logSourceSwitchBenchmarkResult(result);
  return result;
}

function getSourceSwitchRuntime(): SourceSwitchRuntime {
  const surface = document.querySelector<HTMLElement>(
    "[data-benchmark-surface]",
  );
  if (!surface) {
    throw new Error("Source-switch benchmark surface is not mounted.");
  }

  const formatButtons = new Map<string, HTMLButtonElement>();
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-benchmark-format-option]",
  )) {
    const id = button.getAttribute("data-benchmark-format-option");
    if (id) formatButtons.set(id, button);
  }
  if (formatButtons.size < 2) {
    throw new Error("Source-switch benchmark needs at least two formats.");
  }

  return { formatButtons, surface };
}

async function activateSourceSwitchFormat(
  runtime: SourceSwitchRuntime,
  format: string,
  timeoutMs: number,
) {
  const button = runtime.formatButtons.get(format);
  if (!button) throw new Error(`Unknown benchmark format "${format}".`);

  button.click();
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    await nextSourceSwitchFrame();
    if (readSourceSwitchSample(runtime.surface).hasContent) break;
  }
  await waitForSourceSwitchFrames(SOURCE_SWITCH_SETTLE_FRAME_COUNT);
}

async function sampleSourceSwitch(
  runtime: SourceSwitchRuntime,
  {
    from,
    phase,
    switchTimeoutMs,
    to,
  }: {
    from: string;
    phase: SourceSwitchBenchmarkPhase;
    switchTimeoutMs: number;
    to: string;
  },
): Promise<SourceSwitchBenchmarkRun> {
  const button = runtime.formatButtons.get(to);
  if (!button) throw new Error(`Unknown benchmark format "${to}".`);

  let mutationCount = 0;
  let addedNodeCount = 0;
  let removedNodeCount = 0;
  let layoutShiftScore = 0;
  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      mutationCount += 1;
      addedNodeCount += record.addedNodes.length;
      removedNodeCount += record.removedNodes.length;
    }
  });
  mutationObserver.observe(runtime.surface, { childList: true, subtree: true });
  let layoutShiftObserver: PerformanceObserver | null = null;
  if (
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes?.includes("layout-shift")
  ) {
    layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        layoutShiftScore += (entry as { value?: number }).value ?? 0;
      }
    });
    layoutShiftObserver.observe({ type: "layout-shift", buffered: false });
  }

  const before = readSourceSwitchSample(runtime.surface);
  const startedAt = performance.now();
  let sampledFrameCount = 0;
  let emptyFrameCount = 0;
  let skeletonFrameCount = 0;
  let oldContentDroppedAtMs: number | null = null;
  let timeToContentMs: number | null = null;
  let hadContentSinceSwitch = false;

  button.click();

  while (performance.now() - startedAt < switchTimeoutMs) {
    await nextSourceSwitchFrame();
    sampledFrameCount += 1;
    const elapsedMs = Math.round(performance.now() - startedAt);
    const sample = readSourceSwitchSample(runtime.surface);

    if (sample.hasContent) {
      hadContentSinceSwitch = true;
      if (timeToContentMs == null) timeToContentMs = elapsedMs;
    } else {
      emptyFrameCount += 1;
      if (
        oldContentDroppedAtMs == null &&
        before.hasContent &&
        !hadContentSinceSwitch
      ) {
        oldContentDroppedAtMs = elapsedMs;
      }
    }
    if (sample.skeletonCount > 0) skeletonFrameCount += 1;

    // Settle once content has been visible for a stable stretch.
    if (
      timeToContentMs != null &&
      elapsedMs - timeToContentMs >
        SOURCE_SWITCH_SETTLE_FRAME_COUNT * (1000 / 60)
    ) {
      break;
    }
  }

  mutationObserver.disconnect();
  layoutShiftObserver?.disconnect();
  const settled = readSourceSwitchSample(runtime.surface);

  return {
    addedNodeCount,
    beforeHadContent: before.hasContent,
    durationMs: Math.max(0, performance.now() - startedAt),
    emptyFrameCount,
    from,
    layoutShiftScore: Number(layoutShiftScore.toFixed(4)),
    mutationCount,
    oldContentDroppedAtMs,
    phase,
    removedNodeCount,
    sampledFrameCount,
    settledHasContent: settled.hasContent,
    skeletonFrameCount,
    timeToContentMs,
    to,
  };
}

// Rendered content is renderer-agnostic on purpose: raster formats paint
// canvases, document formats paint text (csv/xlsx into an isolated shadow
// root), html paints inside a sandboxed srcdoc iframe whose document is
// unreadable from outside — a visible iframe is the only external signal.
function readSourceSwitchSample(surface: HTMLElement): SourceSwitchSample {
  const viewport = surface.querySelector<HTMLElement>(
    '[data-slot="file-viewer-viewport"]',
  );
  if (!viewport) return { hasContent: false, skeletonCount: 0 };

  const viewportRect = viewport.getBoundingClientRect();
  let visibleCanvasCount = 0;
  let visibleIframeCount = 0;
  let shadowTextLength = 0;
  if (viewportRect.width > 0 && viewportRect.height > 0) {
    for (const canvas of viewport.querySelectorAll("canvas")) {
      const rect = canvas.getBoundingClientRect();
      if (
        canvas.width > 0 &&
        rect.width > 4 &&
        rect.height > 4 &&
        rect.bottom > viewportRect.top &&
        rect.top < viewportRect.bottom
      ) {
        visibleCanvasCount += 1;
      }
    }
    for (const iframe of viewport.querySelectorAll("iframe")) {
      const rect = iframe.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) visibleIframeCount += 1;
    }
    for (const element of viewport.querySelectorAll("*")) {
      const shadowRoot = (element as HTMLElement).shadowRoot;
      if (!shadowRoot) continue;
      shadowTextLength += shadowRoot.textContent?.trim().length ?? 0;
      if (shadowTextLength >= SOURCE_SWITCH_MIN_TEXT_CONTENT_LENGTH) break;
    }
  }
  const textLength = viewport.textContent?.trim().length ?? 0;
  const skeletonCount = [
    ...surface.querySelectorAll('[data-slot="skeleton"]'),
  ].filter((element) => element.getBoundingClientRect().width > 4).length;

  return {
    hasContent:
      visibleCanvasCount > 0 ||
      visibleIframeCount > 0 ||
      textLength >= SOURCE_SWITCH_MIN_TEXT_CONTENT_LENGTH ||
      shadowTextLength >= SOURCE_SWITCH_MIN_TEXT_CONTENT_LENGTH,
    skeletonCount,
  };
}

function collectSourceSwitchMetrics(
  runs: readonly SourceSwitchBenchmarkRun[],
): SourceSwitchBenchmarkMetric[] {
  const neverRendered = runs.filter((run) => !run.settledHasContent);
  const warmRuns = runs.filter((run) => run.phase === "warm");
  const slowestWarm = warmRuns.reduce(
    (slowest, run) =>
      Math.max(slowest, run.timeToContentMs ?? Number.POSITIVE_INFINITY),
    0,
  );
  // Continuity counts only switches AWAY from a rendered document: the reader
  // was looking at content, so the viewport must never present an empty hole.
  const continuityRuns = runs.filter((run) => run.beforeHadContent);
  const continuityEmptyFrames = continuityRuns.reduce(
    (count, run) => count + run.emptyFrameCount,
    0,
  );
  const worstMutations = runs.reduce(
    (worst, run) => Math.max(worst, run.mutationCount),
    0,
  );

  return [
    {
      id: "switch-render",
      label: "Switch render",
      passed: neverRendered.length === 0,
      value:
        neverRendered.length === 0
          ? "all rendered"
          : neverRendered
              .map((run) => `${run.from}→${run.to} (${run.phase})`)
              .join(", "),
      budget: `every switch renders <= ${SOURCE_SWITCH_RENDER_BUDGET_MS}ms`,
      detail:
        "Every source switch must reach visible rendered content; a switch that never renders is a broken viewer, not a slow one.",
    },
    {
      id: "switch-warm-render",
      label: "Warm switch render",
      passed:
        warmRuns.length > 0 && slowestWarm <= SOURCE_SWITCH_WARM_RENDER_BUDGET_MS,
      value: `${Number.isFinite(slowestWarm) ? Math.round(slowestWarm) : "never"}ms slowest`,
      budget: `<= ${SOURCE_SWITCH_WARM_RENDER_BUDGET_MS}ms`,
      detail:
        "Returning to an already-rendered source reuses caches; a warm switch must not reload from scratch.",
    },
    {
      id: "switch-continuity",
      label: "Switch continuity",
      passed: continuityEmptyFrames === 0,
      value: `${continuityEmptyFrames} empty frames`,
      budget: "0 empty frames",
      detail:
        "A switch away from a rendered document never shows an empty viewport: the previous document (or a deliberate placeholder) holds until the successor paints.",
    },
    {
      id: "switch-settled-state",
      label: "Settled state",
      passed: runs.every((run) => run.settledHasContent || !run.beforeHadContent),
      value: `${runs.filter((run) => run.settledHasContent).length}/${runs.length} settled`,
      budget: "rendered after settle",
      detail: "After the switch settles, the new source is on screen.",
    },
    {
      id: "switch-mutations",
      label: "Switch mutations",
      passed: worstMutations <= SOURCE_SWITCH_MUTATION_BUDGET,
      value: `${worstMutations} worst`,
      budget: `<= ${SOURCE_SWITCH_MUTATION_BUDGET}`,
      detail:
        "A source switch is a full renderer swap, so churn is expected but bounded — a mutation storm marks a mount/unmount loop.",
    },
  ];
}

function logSourceSwitchBenchmarkResult(result: SourceSwitchBenchmarkResult) {
  const summary = {
    durationMs: Number(result.durationMs.toFixed(1)),
    failedMetricIds: result.metrics
      .filter((metric) => !metric.passed)
      .map((metric) => metric.id),
    formats: result.formats,
    sampledFrameCount: result.sampledFrameCount,
    status: result.status,
  };
  console.info(
    "[file-viewer:source-switch-benchmark] result",
    JSON.stringify(summary),
  );
  console.info(
    "[file-viewer:source-switch-benchmark] full result",
    JSON.stringify(result),
  );
  console.table(
    result.runs.map((run) => ({
      switch: `${run.from}→${run.to}`,
      phase: run.phase,
      "content(ms)": run.timeToContentMs ?? "never",
      "empty frames": run.emptyFrameCount,
      "old dropped(ms)": run.oldContentDroppedAtMs ?? "-",
      mutations: run.mutationCount,
    })),
  );
}

function nextSourceSwitchFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function waitForSourceSwitchFrames(count: number) {
  for (let index = 0; index < count; index += 1) {
    await nextSourceSwitchFrame();
  }
}
