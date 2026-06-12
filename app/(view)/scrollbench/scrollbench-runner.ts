import {
  findFixedGridScroller,
  isScrollableViewport,
} from "@/components/ui/fixed-grid-benchmark"

import {
  buildScrollTargets,
  getScenarioStepPx,
  measuredScrollDistance,
  summarizeFrameDurations,
  type ScenarioDefinition,
  type ScenarioResult,
} from "./scrollbench-core"

const VIEWER_READY_TIMEOUT_MS = 30_000

export async function measureScenario(
  scroller: HTMLElement,
  scenario: ScenarioDefinition,
  { signal }: { signal?: AbortSignal }
): Promise<ScenarioResult> {
  throwIfAborted(signal)

  if (!isScrollableViewport(scroller)) {
    throw new Error("The selected viewer does not have a scrollable viewport.")
  }

  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight
  if (!Number.isFinite(maxScrollTop) || maxScrollTop <= 0) {
    throw new Error("The selected viewer does not have a scrollable viewport.")
  }

  const stepPx = getScenarioStepPx({
    clientHeight: scroller.clientHeight,
    scenario,
  })
  const targets = buildScrollTargets({ maxScrollTop, stepPx })
  const frameDurations: number[] = []

  scroller.scrollTop = 0
  await nextFrame(signal)
  await nextFrame(signal)

  let previous = performance.now()

  for (const target of targets) {
    throwIfAborted(signal)
    scroller.scrollTop = target
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }))

    await nextFrame(signal)
    const now = performance.now()
    frameDurations.push(now - previous)
    previous = now
  }

  await nextFrame(signal)

  return summarizeFrameDurations({
    scenario,
    frameDurations,
    stepPx,
    distancePx: measuredScrollDistance(targets),
  })
}

export function findScrollableViewport(root: HTMLElement | null, selector: string) {
  if (!root) return null

  const declaredScroller = findFixedGridScroller({ root, selector })
  if (declaredScroller) return declaredScroller

  const allElements = root.querySelectorAll<HTMLElement>("*")
  for (const element of allElements) {
    const style = window.getComputedStyle(element)
    const canScrollY = /(auto|scroll)/.test(style.overflowY)
    if (canScrollY && isScrollableViewport(element)) {
      return element
    }
  }

  return null
}

export async function waitForScroller(
  getScroller: () => HTMLElement | null,
  {
    signal,
    timeoutMs = VIEWER_READY_TIMEOUT_MS,
  }: {
    signal?: AbortSignal
    timeoutMs?: number
  } = {}
) {
  throwIfAborted(signal)

  const safeTimeoutMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0
  const start = performance.now()
  let scroller = getScroller()

  while (
    !isScrollableViewport(scroller) &&
    performance.now() - start < safeTimeoutMs
  ) {
    throwIfAborted(signal)
    await delay(100, signal)
    scroller = getScroller()
  }

  if (!scroller) {
    throw new Error("Could not find a viewer scrollport.")
  }

  if (!isScrollableViewport(scroller)) {
    throw new Error("The viewer scrollport is not scrollable yet.")
  }

  return scroller
}

export function viewportMetrics(scroller: HTMLElement) {
  const clientHeight = finitePositiveMetric(scroller.clientHeight)
  const scrollHeight = finitePositiveMetric(scroller.scrollHeight)

  return {
    clientHeight,
    scrollHeight,
    maxScrollTop: Math.max(0, scrollHeight - clientHeight),
  }
}

export function isAbortError(caught: unknown) {
  return caught instanceof DOMException && caught.name === "AbortError"
}

function nextFrame(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    let frame = 0
    const handleAbort = () => {
      cancelAnimationFrame(frame)
      reject(abortError())
    }
    signal?.addEventListener("abort", handleAbort, { once: true })
    frame = requestAnimationFrame(() => {
      signal?.removeEventListener("abort", handleAbort)
      resolve()
    })
  })
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    let timeout = 0
    const handleAbort = () => {
      window.clearTimeout(timeout)
      reject(abortError())
    }

    signal?.addEventListener("abort", handleAbort, { once: true })
    timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort)
      resolve()
    }, ms)
  })
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
}

function abortError() {
  return new DOMException("Scrollbench run was cancelled.", "AbortError")
}

function finitePositiveMetric(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}
