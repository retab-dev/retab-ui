import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const profileUrl =
  process.env.PDF_VIEWER_PROFILE_URL ??
  process.env.PROFILE_URL ??
  "http://localhost:3100/pdf-viewer-benchmark"
const chromePort = Number(process.env.CHROME_PORT ?? 9335)
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const variants = parseList(
  process.env.PDF_VIEWER_PROFILE_VARIANTS ??
    "baseline,cache,prerender,imperative"
)
const jumpPages = parseNumberList(
  process.env.PDF_VIEWER_PROFILE_JUMP_PAGES ??
    "50,56,50,51,52,200,206,200,201,400,406,400,401,585"
)
const settleMs = Number(process.env.PDF_VIEWER_PROFILE_SETTLE_MS ?? 180)
const shouldAssert = process.argv.includes("--assert")

function parseList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseNumberList(value) {
  return parseList(value)
    .map((item) => Number(item))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}

async function waitForProfileRoute(url) {
  const route = new URL(url)
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(route, {
        signal: AbortSignal.timeout(2_000),
      })
      if (response.ok) return
    } catch {
      await sleep(200)
    }
  }
  throw new Error(
    `No app server reachable at ${route.origin}. Start the existing dev server with "pnpm dev" before running this profiler.`
  )
}

async function waitForDevToolsEndpoint(endpoint) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 15_000) {
    try {
      return await fetchJson(`${endpoint}/json/version`)
    } catch {
      await sleep(100)
    }
  }
  throw new Error(`Chrome DevTools endpoint did not start at ${endpoint}`)
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl)
  let nextId = 0
  const pending = new Map()
  const events = []

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data)
    if (payload.id && pending.has(payload.id)) {
      const request = pending.get(payload.id)
      pending.delete(payload.id)
      if (payload.error) {
        request.reject(new Error(JSON.stringify(payload.error)))
      } else {
        request.resolve(payload.result)
      }
      return
    }
    if (payload.method) events.push(payload)
  })

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        events,
        socket,
        send(method, params = {}) {
          const id = ++nextId
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject })
          })
        },
        waitForEvent(method, timeoutMs = 30_000) {
          const startIndex = events.length
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error(`Timed out waiting for ${method}`)),
              timeoutMs
            )
            const interval = setInterval(() => {
              const event = events
                .slice(startIndex)
                .find((event) => event.method === method)
              if (!event) return
              clearTimeout(timeout)
              clearInterval(interval)
              resolve(event)
            }, 25)
          })
        },
      })
    })
    socket.addEventListener("error", reject)
  })
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails))
  }
  return result.result.value
}

async function waitInPage(send, predicate, timeoutMs = 60_000) {
  const timeoutMessage = JSON.stringify(`Timed out waiting for: ${predicate}`)
  return evaluate(
    send,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + ${timeoutMs};
      const tick = () => {
        if (${predicate}) {
          resolve(true);
        } else if (performance.now() > deadline) {
          reject(new Error(${timeoutMessage}));
        } else {
          setTimeout(tick, 100);
        }
      };
      tick();
    })`
  )
}

async function performanceMetrics(send) {
  const raw = await send("Performance.getMetrics")
  return Object.fromEntries(
    raw.metrics.map((metric) => [metric.name, metric.value])
  )
}

function metricDelta(before, after) {
  return {
    JSHeapUsedSize: after.JSHeapUsedSize,
    Nodes: after.Nodes,
    LayoutCount: delta(before, after, "LayoutCount"),
    RecalcStyleCount: delta(before, after, "RecalcStyleCount"),
    LayoutDurationMs: delta(before, after, "LayoutDuration") * 1000,
    RecalcStyleDurationMs: delta(before, after, "RecalcStyleDuration") * 1000,
    ScriptDurationMs: delta(before, after, "ScriptDuration") * 1000,
    TaskDurationMs: delta(before, after, "TaskDuration") * 1000,
  }
}

function delta(before, after, key) {
  return (after[key] ?? 0) - (before[key] ?? 0)
}

function summarizeTrace(events) {
  const completeEvents = events.filter((event) => event.ph === "X")

  function byName(name) {
    const matching = completeEvents.filter((event) => event.name === name)
    return {
      count: matching.length,
      maxMs: Math.max(0, ...matching.map((event) => (event.dur ?? 0) / 1000)),
      totalMs:
        matching.reduce((total, event) => total + (event.dur ?? 0), 0) / 1000,
    }
  }

  return {
    EventDispatch: byName("EventDispatch"),
    FunctionCall: byName("FunctionCall"),
    Layout: byName("Layout"),
    Paint: byName("Paint"),
    UpdateLayoutTree: byName("UpdateLayoutTree"),
    topEvents: completeEvents
      .filter((event) => (event.dur ?? 0) > 5_000)
      .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
      .slice(0, 20)
      .map((event) => ({
        category: event.cat,
        ms: (event.dur ?? 0) / 1000,
        name: event.name,
        type: event.args?.data?.type,
        url: event.args?.data?.url,
      })),
  }
}

async function installPageProfilers(send) {
  await evaluate(
    send,
    `(() => {
      const countElements = (nodes) => {
        let count = 0;
        for (const node of nodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          count += 1 + node.querySelectorAll("*").length;
        }
        return count;
      };

      window.__pdfViewerProfile = {
        longTasks: [],
        mutations: {
          records: 0,
          attributes: 0,
          characterData: 0,
          childList: 0,
          addedElements: 0,
          removedElements: 0
        }
      };

      try {
        new PerformanceObserver((list) => {
          window.__pdfViewerProfile.longTasks.push(
            ...list.getEntries().map((entry) => ({
              duration: entry.duration,
              startTime: entry.startTime
            }))
          );
        }).observe({ type: "longtask", buffered: true });
      } catch {}

      const root = document.querySelector('[data-slot="pdf-viewer-document"]');
      if (!root) throw new Error("PDF benchmark root not found");

      window.__pdfViewerMutationObserver?.disconnect?.();
      window.__pdfViewerMutationObserver = new MutationObserver((records) => {
        const mutations = window.__pdfViewerProfile.mutations;
        mutations.records += records.length;
        for (const record of records) {
          if (record.type === "attributes") mutations.attributes += 1;
          if (record.type === "characterData") mutations.characterData += 1;
          if (record.type === "childList") {
            mutations.childList += 1;
            mutations.addedElements += countElements(record.addedNodes);
            mutations.removedElements += countElements(record.removedNodes);
          }
        }
      });
      window.__pdfViewerMutationObserver.observe(root, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
    })()`
  )
}

async function resetPageProfilers(send) {
  await evaluate(
    send,
    `(() => {
      const profile = window.__pdfViewerProfile;
      if (!profile) return;
      profile.longTasks = [];
      profile.mutations = {
        records: 0,
        attributes: 0,
        characterData: 0,
        childList: 0,
        addedElements: 0,
        removedElements: 0
      };
    })()`
  )
}

async function readPageProfile(send) {
  return evaluate(
    send,
    `(() => ({
      profile: window.__pdfViewerProfile,
      snapshot: window.__pdfViewerBenchmark?.snapshot?.()
    }))()`
  )
}

async function openVariant(page, send, variant) {
  const url = new URL(profileUrl)
  url.searchParams.set("variant", variant)
  const loadEvent = page.waitForEvent("Page.loadEventFired", 120_000)
  await send("Page.navigate", { url: String(url) })
  await loadEvent
  await waitInPage(
    send,
    `window.__pdfViewerBenchmark?.variant === ${JSON.stringify(variant)} &&
      window.__pdfViewerBenchmark?.snapshot?.().scrollHeight >
      window.__pdfViewerBenchmark?.snapshot?.().clientHeight`,
    120_000
  )
  await sleep(500)
  await installPageProfilers(send)
  return evaluate(send, `window.__pdfViewerBenchmark.snapshot()`)
}

async function runVariant(page, send, variant) {
  const initial = await openVariant(page, send, variant)
  await resetPageProfilers(send)
  const beforeMetrics = await performanceMetrics(send)
  page.events.length = 0

  await send("Tracing.start", {
    categories: [
      "devtools.timeline",
      "v8.execute",
      "blink.user_timing",
      "disabled-by-default-devtools.timeline",
    ].join(","),
    transferMode: "ReportEvents",
  })

  const results = await evaluate(
    send,
    `window.__pdfViewerBenchmark.runJumpSequence(${JSON.stringify(jumpPages)}, { settleMs: ${settleMs} })`
  )

  await send("Tracing.end")
  await page.waitForEvent("Tracing.tracingComplete", 120_000)
  const traceEvents = page.events
    .filter((event) => event.method === "Tracing.dataCollected")
    .flatMap((event) => event.params?.value ?? [])
  const afterMetrics = await performanceMetrics(send)
  const pageProfile = await readPageProfile(send)

  return {
    initial,
    metricsDelta: metricDelta(beforeMetrics, afterMetrics),
    results,
    summary: summarizeJumpResults(results),
    trace: summarizeTrace(traceEvents),
    variant,
    ...pageProfile,
  }
}

function summarizeJumpResults(results) {
  const elapsed = results.map((result) => result.elapsedMs)
  const renderSummaries = results.map((result) => result.renderSummary)
  const alreadyRenderedJumpCount = results.filter(
    (result) =>
      result.renderedPages.includes(result.pageNumber) &&
      !result.renderTimings.some(
        (timing) =>
          timing.pageNumber === result.pageNumber &&
          timing.status === "rendered"
      )
  ).length

  return {
    alreadyRenderedJumpCount,
    cacheHitCount: sum(renderSummaries, "cacheHitCount"),
    cancelledCount: sum(renderSummaries, "cancelledCount"),
    elapsedAverageMs: average(elapsed),
    elapsedMaxMs: Math.max(0, ...elapsed),
    elapsedMedianMs: percentile(elapsed, 0.5),
    elapsedP95Ms: percentile(elapsed, 0.95),
    failedCount: sum(renderSummaries, "failedCount"),
    jumpCount: results.length,
    maxCanvasCount: Math.max(0, ...results.map((result) => result.canvasCount)),
    maxPageSlotCount: Math.max(
      0,
      ...results.map((result) => result.pageSlotCount)
    ),
    pdfRenderCount: sum(renderSummaries, "pdfRenderCount"),
    renderedCount: sum(renderSummaries, "renderedCount"),
    totalRenderDurationMs: sum(renderSummaries, "totalDurationMs"),
  }
}

function sum(items, key) {
  return items.reduce((total, item) => total + (item[key] ?? 0), 0)
}

function average(values) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0
}

function percentile(values, ratio) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[
    Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
  ]
}

function compareVariants(scenarios) {
  const baseline = scenarios.find((scenario) => scenario.variant === "baseline")
  if (!baseline) return []

  return scenarios
    .filter((scenario) => scenario !== baseline)
    .map((scenario) => {
      const comparison = {
        alreadyRenderedJumpDelta:
          scenario.summary.alreadyRenderedJumpCount -
          baseline.summary.alreadyRenderedJumpCount,
        cacheHitDelta:
          scenario.summary.cacheHitCount - baseline.summary.cacheHitCount,
        elapsedMedianDeltaMs:
          scenario.summary.elapsedMedianMs - baseline.summary.elapsedMedianMs,
        elapsedMedianDeltaPercent: percentDelta(
          baseline.summary.elapsedMedianMs,
          scenario.summary.elapsedMedianMs
        ),
        functionCallTotalDeltaMs:
          scenario.trace.FunctionCall.totalMs -
          baseline.trace.FunctionCall.totalMs,
        layoutDurationDeltaMs:
          scenario.metricsDelta.LayoutDurationMs -
          baseline.metricsDelta.LayoutDurationMs,
        pdfRenderDelta:
          scenario.summary.pdfRenderCount - baseline.summary.pdfRenderCount,
        scriptDurationDeltaMs:
          scenario.metricsDelta.ScriptDurationMs -
          baseline.metricsDelta.ScriptDurationMs,
        taskDurationDeltaMs:
          scenario.metricsDelta.TaskDurationMs -
          baseline.metricsDelta.TaskDurationMs,
        variant: scenario.variant,
      }
      return {
        ...comparison,
        moved: didMove(comparison),
      }
    })
}

function percentDelta(baseline, value) {
  return baseline > 0 ? ((value - baseline) / baseline) * 100 : 0
}

function didMove(comparison) {
  return (
    comparison.alreadyRenderedJumpDelta > 0 ||
    comparison.cacheHitDelta > 0 ||
    comparison.pdfRenderDelta < 0 ||
    comparison.elapsedMedianDeltaPercent <= -5 ||
    comparison.functionCallTotalDeltaMs <= -5 ||
    comparison.taskDurationDeltaMs <= -5
  )
}

function assertProfile(report) {
  const failures = report.comparisons
    .filter((comparison) => comparison.variant !== "default")
    .filter((comparison) => !comparison.moved)
    .map((comparison) => `${comparison.variant}: no measured improvement`)

  for (const scenario of report.scenarios) {
    if (scenario.summary.failedCount > 0) {
      failures.push(
        `${scenario.variant}: failed renders ${scenario.summary.failedCount}`
      )
    }
  }

  if (failures.length) {
    throw new Error(
      `PDF viewer profile assertions failed:\n${failures.join("\n")}`
    )
  }
}

function waitForProcessExit(process) {
  if (process.exitCode !== null || process.signalCode !== null) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    process.once("exit", resolve)
  })
}

async function removeChromeProfile(userDataDir) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(userDataDir, { recursive: true, force: true })
      return
    } catch (error) {
      if (attempt === 4) throw error
      await sleep(200)
    }
  }
}

await waitForProfileRoute(profileUrl)

const chromeEndpoint = `http://127.0.0.1:${chromePort}`
const userDataDir = await mkdtemp(
  join(tmpdir(), "pdf-viewer-benchmark-chrome-")
)
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" }
)

try {
  console.error("Waiting for Chrome DevTools endpoint")
  await waitForDevToolsEndpoint(chromeEndpoint)

  const newTargetResponse = await fetch(
    `${chromeEndpoint}/json/new?about:blank`,
    { method: "PUT" }
  )
  if (!newTargetResponse.ok) {
    throw new Error(`/json/new failed: ${newTargetResponse.status}`)
  }

  const target = await newTargetResponse.json()
  const page = await connectCdp(target.webSocketDebuggerUrl)
  const send = (method, params = {}) => page.send(method, params)

  await send("Page.enable")
  await send("Runtime.enable")
  await send("Performance.enable")
  await send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: Number(process.env.PROFILE_VIEWPORT_HEIGHT ?? 900),
    mobile: false,
    width: Number(process.env.PROFILE_VIEWPORT_WIDTH ?? 1440),
  })

  const scenarios = []
  for (const variant of variants) {
    console.error(`Profiling PDF viewer variant: ${variant}`)
    scenarios.push(await runVariant(page, send, variant))
  }

  const report = {
    jumpPages,
    measuredAt: new Date().toISOString(),
    mode: "headless Chrome CDP + PDF viewer benchmark route",
    route: profileUrl,
    settleMs,
    scenarios,
  }
  report.comparisons = compareVariants(scenarios)

  console.log(JSON.stringify(report, null, 2))

  page.socket.close()
  if (shouldAssert) assertProfile(report)
} finally {
  chrome.kill("SIGTERM")
  await waitForProcessExit(chrome)
  await removeChromeProfile(userDataDir)
}
