import {
  findFixedGridScroller,
  isScrollableViewport,
} from "@/components/ui/fixed-grid-benchmark";

import {
  buildScrollTargets,
  getScenarioStepPx,
  measuredScrollDistance,
  summarizeFrameDurations,
  type ScenarioDefinition,
  type ScenarioResult,
  type ScrollDomMutationResult,
  type ScrollFrameSample,
} from "./scrollbench-core";

const VIEWER_READY_TIMEOUT_MS = 30_000;

export async function measureScenario(
  scroller: HTMLElement,
  scenario: ScenarioDefinition,
  { signal }: { signal?: AbortSignal },
): Promise<ScenarioResult> {
  throwIfAborted(signal);

  if (!isScrollableViewport(scroller)) {
    throw new Error("The selected viewer does not have a scrollable viewport.");
  }

  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
  if (!Number.isFinite(maxScrollTop) || maxScrollTop <= 0) {
    throw new Error("The selected viewer does not have a scrollable viewport.");
  }

  const stepPx = getScenarioStepPx({
    clientHeight: scroller.clientHeight,
    scenario,
  });
  const targets = buildScrollTargets({ maxScrollTop, stepPx });
  const frameDurations: number[] = [];
  const samples: ScrollFrameSample[] = [];
  const warmupFrameMs: number[] = [];
  const viewerRoot = closestViewerRoot(scroller);
  const mutationTracker = createScrollDomMutationTracker({
    scroller,
    viewerRoot,
  });
  const longTaskTracker = createLongTaskTracker();

  scroller.scrollTop = 0;
  warmupFrameMs.push(await timedNextFrame(signal));
  warmupFrameMs.push(await timedNextFrame(signal));

  let previous = performance.now();
  let previousScrollTop = scroller.scrollTop;

  try {
    mutationTracker.start();
    longTaskTracker.start();

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index] ?? 0;
      throwIfAborted(signal);
      const mutationStart = performance.now();
      scroller.scrollTop = target;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      const scrollMutationMs = performance.now() - mutationStart;

      await nextFrame(signal);
      const now = performance.now();
      const actualScrollTop = scroller.scrollTop;
      const frameMs = now - previous;
      const elementCounts = mutationTracker.sampleElementCounts();
      frameDurations.push(frameMs);
      samples.push({
        actualScrollTop,
        frameMs,
        index,
        scrollDeltaPx: actualScrollTop - previousScrollTop,
        scrollMutationMs,
        scrollportElementCount: elementCounts.scrollportElementCount,
        targetScrollTop: target,
        viewerElementCount: elementCounts.viewerElementCount,
      });
      previous = now;
      previousScrollTop = actualScrollTop;
    }
  } finally {
    longTaskTracker.stop();
    mutationTracker.stop();
  }

  await nextFrame(signal);

  return summarizeFrameDurations({
    domMutation: mutationTracker.result(),
    scenario,
    frameDurations,
    longTaskDurations: longTaskTracker.durations(),
    samples,
    stepPx,
    distancePx: measuredScrollDistance(targets),
    warmupFrameMs,
  });
}

export function findScrollableViewport(
  root: HTMLElement | null,
  selector: string,
) {
  if (!root) return null;

  const declaredScroller = findFixedGridScroller({ root, selector });
  if (declaredScroller) return declaredScroller;

  const allElements = root.querySelectorAll<HTMLElement>("*");
  for (const element of allElements) {
    const style = window.getComputedStyle(element);
    const canScrollY = /(auto|scroll)/.test(style.overflowY);
    if (canScrollY && isScrollableViewport(element)) {
      return element;
    }
  }

  return null;
}

export async function waitForScroller(
  getScroller: () => HTMLElement | null,
  {
    signal,
    timeoutMs = VIEWER_READY_TIMEOUT_MS,
  }: {
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
) {
  throwIfAborted(signal);

  const safeTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0;
  const start = performance.now();
  let scroller = getScroller();

  while (
    !isScrollableViewport(scroller) &&
    performance.now() - start < safeTimeoutMs
  ) {
    throwIfAborted(signal);
    await delay(100, signal);
    scroller = getScroller();
  }

  if (!scroller) {
    throw new Error("Could not find a viewer scrollport.");
  }

  if (!isScrollableViewport(scroller)) {
    throw new Error("The viewer scrollport is not scrollable yet.");
  }

  return scroller;
}

export function viewportMetrics(scroller: HTMLElement) {
  const clientHeight = finitePositiveMetric(scroller.clientHeight);
  const clientWidth = finitePositiveMetric(scroller.clientWidth);
  const scrollHeight = finitePositiveMetric(scroller.scrollHeight);
  const scrollWidth = finitePositiveMetric(scroller.scrollWidth);
  const viewerRoot = closestViewerRoot(scroller);

  return {
    clientHeight,
    clientWidth,
    scrollHeight,
    scrollWidth,
    maxScrollTop: Math.max(0, scrollHeight - clientHeight),
    maxScrollLeft: Math.max(0, scrollWidth - clientWidth),
    renderedElementCount: viewerRoot.querySelectorAll("*").length,
    scrollportElementCount: scroller.querySelectorAll("*").length,
  };
}

export function isAbortError(caught: unknown) {
  return caught instanceof DOMException && caught.name === "AbortError";
}

function nextFrame(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    let frame = 0;
    const handleAbort = () => {
      cancelAnimationFrame(frame);
      reject(abortError());
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
    frame = requestAnimationFrame(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    });
  });
}

async function timedNextFrame(signal?: AbortSignal) {
  const start = performance.now();
  await nextFrame(signal);
  return performance.now() - start;
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    let timeout = 0;
    const handleAbort = () => {
      window.clearTimeout(timeout);
      reject(abortError());
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
    timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function abortError() {
  return new DOMException("Scrollbench run was cancelled.", "AbortError");
}

function finitePositiveMetric(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function closestViewerRoot(scroller: HTMLElement) {
  let element: HTMLElement | null = scroller;

  while (element) {
    const slot = element.getAttribute("data-slot");
    if (slot?.endsWith("-viewer")) return element;
    element = element.parentElement;
  }

  return scroller;
}

function createScrollDomMutationTracker({
  scroller,
  viewerRoot,
}: {
  scroller: HTMLElement;
  viewerRoot: HTMLElement;
}) {
  const state: ScrollDomMutationResult = {
    addedElements: 0,
    addedNodes: 0,
    attributeMutations: 0,
    characterDataMutations: 0,
    finalScrollportElementCount: 0,
    finalViewerElementCount: 0,
    initialScrollportElementCount: elementCount(scroller),
    initialViewerElementCount: elementCount(viewerRoot),
    maxScrollportElementCount: 0,
    maxViewerElementCount: 0,
    mutationRecords: 0,
    removedElements: 0,
    removedNodes: 0,
  };
  state.maxScrollportElementCount = state.initialScrollportElementCount;
  state.maxViewerElementCount = state.initialViewerElementCount;

  const observer =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver((records) =>
          recordMutationRecords(records, state),
        );

  return {
    result: () => ({ ...state }),
    sampleElementCounts: () => {
      const scrollportElementCount = elementCount(scroller);
      const viewerElementCount = elementCount(viewerRoot);
      state.maxScrollportElementCount = Math.max(
        state.maxScrollportElementCount,
        scrollportElementCount,
      );
      state.maxViewerElementCount = Math.max(
        state.maxViewerElementCount,
        viewerElementCount,
      );
      return { scrollportElementCount, viewerElementCount };
    },
    start: () => {
      observer?.observe(viewerRoot, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });
    },
    stop: () => {
      if (observer) {
        recordMutationRecords(observer.takeRecords(), state);
        observer.disconnect();
      }
      state.finalScrollportElementCount = elementCount(scroller);
      state.finalViewerElementCount = elementCount(viewerRoot);
      state.maxScrollportElementCount = Math.max(
        state.maxScrollportElementCount,
        state.finalScrollportElementCount,
      );
      state.maxViewerElementCount = Math.max(
        state.maxViewerElementCount,
        state.finalViewerElementCount,
      );
    },
  };
}

function createLongTaskTracker() {
  const durations: number[] = [];
  const supportsLongTasks =
    typeof PerformanceObserver !== "undefined" &&
    Array.isArray(PerformanceObserver.supportedEntryTypes) &&
    PerformanceObserver.supportedEntryTypes.includes("longtask");
  const observer = supportsLongTasks
    ? new PerformanceObserver((list) =>
        recordPerformanceEntryDurations(list.getEntries(), durations),
      )
    : null;

  return {
    durations: () => [...durations],
    start: () => {
      try {
        observer?.observe({ entryTypes: ["longtask"] });
      } catch {
        durations.length = 0;
      }
    },
    stop: () => {
      if (!observer) return;
      recordPerformanceEntryDurations(observer.takeRecords(), durations);
      observer.disconnect();
    },
  };
}

function elementCount(element: HTMLElement) {
  return element.querySelectorAll("*").length;
}

function nodeListElementCount(nodes: NodeList) {
  let count = 0;

  for (const node of nodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    count += 1;
    count += (node as Element).querySelectorAll("*").length;
  }

  return count;
}

function recordPerformanceEntryDurations(
  entries: readonly PerformanceEntry[],
  durations: number[],
) {
  for (const entry of entries) {
    if (Number.isFinite(entry.duration) && entry.duration >= 0) {
      durations.push(entry.duration);
    }
  }
}

function recordMutationRecords(
  records: readonly MutationRecord[],
  state: ScrollDomMutationResult,
) {
  state.mutationRecords += records.length;

  for (const record of records) {
    if (record.type === "attributes") {
      state.attributeMutations += 1;
      continue;
    }
    if (record.type === "characterData") {
      state.characterDataMutations += 1;
      continue;
    }

    state.addedNodes += record.addedNodes.length;
    state.removedNodes += record.removedNodes.length;
    state.addedElements += nodeListElementCount(record.addedNodes);
    state.removedElements += nodeListElementCount(record.removedNodes);
  }
}
