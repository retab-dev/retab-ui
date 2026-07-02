export type SidebarMotionBenchmarkMetricId =
  | "overshoot"
  | "back-and-forth"
  | "scroll-drift"
  | "sidebar-sync"
  | "renderer-continuity"
  | "visual-smoothness";

export type SidebarMotionBenchmarkMetric = {
  budget: string;
  detail: string;
  id: SidebarMotionBenchmarkMetricId;
  label: string;
  passed: boolean;
  value: string;
};

export type SidebarMotionBenchmarkResult = {
  durationMs: number;
  format: string;
  metrics: SidebarMotionBenchmarkMetric[];
  sampledFrameCount: number;
  side: string;
  status: "failed" | "passed";
};

type BenchmarkSample = {
  anchors: string[];
  frameWidth: number;
  gapWidth: number;
  scrollLeft: number;
  scrollTop: number;
  visualLeft: number | null;
  visualRight: number | null;
  visualWidth: number | null;
  windowScrollY: number;
};

type BenchmarkMotionRun = {
  action: "close" | "open";
  after: BenchmarkSample;
  before: BenchmarkSample;
  samples: BenchmarkSample[];
};

type BenchmarkRuntime = {
  content: HTMLElement;
  frame: HTMLElement;
  gap: HTMLElement;
  root: HTMLElement;
  trigger: HTMLButtonElement;
};

export async function runFileViewerSidebarMotionBenchmark(): Promise<SidebarMotionBenchmarkResult> {
  const startedAt = performance.now();
  const runtime = getBenchmarkRuntime();
  const format = runtime.root.dataset.benchmarkActiveFormat ?? "unknown";
  const side = runtime.root.dataset.benchmarkSide ?? "unknown";

  await openSidebarIfNeeded(runtime);
  await scrollBenchmarkViewport(runtime);
  await waitForStableRenderer(runtime);

  const close = await sampleTransition(runtime, "close");
  const open = await sampleTransition(runtime, "open");
  const metrics = [
    collectOvershootMetric(close, open),
    collectBackAndForthMetric(close, open),
    collectScrollDriftMetric(close, open),
    collectSidebarSyncMetric(close, open),
    collectRendererContinuityMetric(close, open),
    collectVisualSmoothnessMetric(close, open),
  ];

  return {
    durationMs: performance.now() - startedAt,
    format,
    metrics,
    sampledFrameCount: close.samples.length + open.samples.length,
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

async function openSidebarIfNeeded(runtime: BenchmarkRuntime) {
  if (runtime.root.dataset.fileViewerSidebarOpen === "true") return;
  runtime.trigger.click();
  await sampleAnimationFrames(24);
}

async function scrollBenchmarkViewport(runtime: BenchmarkRuntime) {
  const scroller = resolveBenchmarkScroller(runtime.root);
  if (!scroller) return;

  const availableScroll = Math.max(
    0,
    scroller.scrollHeight - scroller.clientHeight,
  );
  scroller.scrollTop = Math.min(
    availableScroll,
    Math.max(160, scroller.clientHeight * 1.35),
  );
  scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
  await sampleAnimationFrames(4);
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
  runtime.trigger.click();

  for (let index = 0; index < 22; index += 1) {
    await nextAnimationFrame();
    samples.push(readSample(runtime));
  }

  await sampleAnimationFrames(8);
  return {
    action,
    before,
    samples,
    after: readSample(runtime),
  };
}

function readSample(runtime: BenchmarkRuntime): BenchmarkSample {
  const gapRect = runtime.gap.getBoundingClientRect();
  const frameRect = runtime.frame.getBoundingClientRect();
  const scroller = resolveBenchmarkScroller(runtime.root);
  const visualRect = resolveBenchmarkVisual(
    runtime.root,
  )?.getBoundingClientRect();

  return {
    anchors: readRendererAnchors(runtime.root, scroller),
    frameWidth: frameRect.width,
    gapWidth: gapRect.width,
    scrollLeft: scroller?.scrollLeft ?? 0,
    scrollTop: scroller?.scrollTop ?? 0,
    visualLeft: visualRect?.left ?? null,
    visualRight: visualRect?.right ?? null,
    visualWidth: visualRect?.width ?? null,
    windowScrollY: window.scrollY,
  };
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
    detail: "Viewport scroll offsets stay stable while the sidebar is moving.",
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

function collectVisualSmoothnessMetric(
  close: BenchmarkMotionRun,
  open: BenchmarkMotionRun,
): SidebarMotionBenchmarkMetric {
  const overshoot = Math.max(
    visualOvershootPx(close, "visualLeft"),
    visualOvershootPx(close, "visualRight"),
    visualOvershootPx(close, "visualWidth"),
    visualOvershootPx(open, "visualLeft"),
    visualOvershootPx(open, "visualRight"),
    visualOvershootPx(open, "visualWidth"),
  );
  const reversals =
    visualReversalCount(close, "visualLeft") +
    visualReversalCount(close, "visualRight") +
    visualReversalCount(close, "visualWidth") +
    visualReversalCount(open, "visualLeft") +
    visualReversalCount(open, "visualRight") +
    visualReversalCount(open, "visualWidth");
  const snap = Math.max(
    visualSettleSnapPx(close, "visualLeft"),
    visualSettleSnapPx(close, "visualRight"),
    visualSettleSnapPx(close, "visualWidth"),
    visualSettleSnapPx(open, "visualLeft"),
    visualSettleSnapPx(open, "visualRight"),
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

function reversalCount(
  run: BenchmarkMotionRun,
  key: "frameWidth" | "gapWidth",
) {
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

function scrollDriftPx(
  run: BenchmarkMotionRun,
  key: "scrollLeft" | "scrollTop" | "windowScrollY",
) {
  const values = movingSamples(run).map((sample) => sample[key]);
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
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

  for (const sample of movingSamples(run)) {
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

function visualOvershootPx(
  run: BenchmarkMotionRun,
  key: "visualLeft" | "visualRight" | "visualWidth",
) {
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

function visualReversalCount(
  run: BenchmarkMotionRun,
  key: "visualLeft" | "visualRight" | "visualWidth",
) {
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

function visualSettleSnapPx(
  run: BenchmarkMotionRun,
  key: "visualLeft" | "visualRight" | "visualWidth",
) {
  const moving = movingSamples(run);
  const lastMoving = moving[moving.length - 1];
  const after = run.after[key];
  const last = lastMoving?.[key];
  if (after == null || last == null) return 0;
  return Math.abs(after - last);
}

function nullableValues(
  samples: BenchmarkSample[],
  key: "visualLeft" | "visualRight" | "visualWidth",
) {
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
  const visibleIds = renderedItems
    .filter((item) => isVisibleInViewport(item.element))
    .map((item) => item.id);

  return visibleIds.length > 0
    ? visibleIds
    : renderedItems.map((item) => item.id);
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
