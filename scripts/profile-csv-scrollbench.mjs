import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const profileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/scrollbench?viewer=csv"
const chromePort = Number(process.env.CHROME_PORT ?? 9334)
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const shouldAssert = process.argv.includes("--assert")
const shouldWarmup = process.env.CSV_SCROLLBENCH_WARMUP !== "0"
const frameP95BudgetMs = Number(
  process.env.CSV_SCROLLBENCH_P95_BUDGET_MS ?? 16.7
)
const maxFrameBudgetMs = Number(
  process.env.CSV_SCROLLBENCH_MAX_FRAME_BUDGET_MS ?? 33.4
)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
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

async function waitInPage(send, predicate, timeoutMs = 30_000) {
  return evaluate(
    send,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + ${timeoutMs};
      const tick = () => {
        if (${predicate}) {
          resolve(true);
        } else if (performance.now() > deadline) {
          reject(new Error("Timed out waiting for: ${predicate.replaceAll('"', '\\"')}"));
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
      totalMs:
        matching.reduce((total, event) => total + (event.dur ?? 0), 0) / 1000,
      maxMs: Math.max(0, ...matching.map((event) => (event.dur ?? 0) / 1000)),
    }
  }

  return {
    EventDispatch: byName("EventDispatch"),
    FunctionCall: byName("FunctionCall"),
    UpdateLayoutTree: byName("UpdateLayoutTree"),
    Layout: byName("Layout"),
    Paint: byName("Paint"),
    topEvents: completeEvents
      .filter((event) => (event.dur ?? 0) > 5_000)
      .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
      .slice(0, 20)
      .map((event) => ({
        name: event.name,
        ms: (event.dur ?? 0) / 1000,
        category: event.cat,
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

      window.__csvScrollbenchProfile = {
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
          window.__csvScrollbenchProfile.longTasks.push(
            ...list.getEntries().map((entry) => ({
              startTime: entry.startTime,
              duration: entry.duration
            }))
          );
        }).observe({ type: "longtask", buffered: true });
      } catch {}

      const scroller = window.__scrollbench?.getScroller?.();
      const root = scroller?.closest('[data-slot="csv-grid"]') ?? scroller;
      if (!root) throw new Error("CSV scrollbench root not found");

      window.__csvScrollbenchMutationObserver?.disconnect?.();
      window.__csvScrollbenchMutationObserver = new MutationObserver((records) => {
        const mutations = window.__csvScrollbenchProfile.mutations;
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
      window.__csvScrollbenchMutationObserver.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
    })()`
  )
}

async function resetPageProfilers(send) {
  await evaluate(
    send,
    `(() => {
      const profile = window.__csvScrollbenchProfile;
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

async function settleScrollerAtTop(send) {
  await evaluate(
    send,
    `new Promise((resolve) => {
      const scroller = window.__scrollbench?.getScroller?.();
      if (!scroller) {
        resolve(false);
        return;
      }
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => resolve(true), 100);
        });
      });
    })`
  )
}

async function readPageProfile(send) {
  return evaluate(
    send,
    `(() => {
      const scroller = window.__scrollbench?.getScroller?.();
      const grid = document.querySelector('[data-slot="csv-grid"]');
      return {
        profile: window.__csvScrollbenchProfile,
        scroll: scroller ? {
          scrollTop: scroller.scrollTop,
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
          maxScrollTop: scroller.scrollHeight - scroller.clientHeight
        } : null,
        dom: {
          rows: document.querySelectorAll('[data-slot="csv-row"]').length,
          cells: document.querySelectorAll('[data-slot="csv-cell"]').length,
          totalNodes: document.getElementsByTagName("*").length,
          ariaRows: grid
            ? [...grid.querySelectorAll('[data-slot="csv-row"]')]
                .slice(0, 8)
                .map((row) => row.getAttribute("aria-rowindex"))
            : []
        }
      };
    })()`
  )
}

async function runScenario(page, send, scenarioId, options = {}) {
  await settleScrollerAtTop(send)
  if (options.setupExpression) {
    await evaluate(send, options.setupExpression)
  }
  await resetPageProfilers(send)
  const beforeMetrics = await performanceMetrics(send)
  page.events.length = 0

  await send("Tracing.start", {
    transferMode: "ReportEvents",
    categories: [
      "devtools.timeline",
      "v8.execute",
      "blink.user_timing",
      "disabled-by-default-devtools.timeline",
    ].join(","),
  })

  const scrollbench = await evaluate(
    send,
    `window.__scrollbench.runScenario(${JSON.stringify(scenarioId)})`
  )

  await send("Tracing.end")
  await page.waitForEvent("Tracing.tracingComplete", 60_000)
  const traceEvents = page.events
    .filter((event) => event.method === "Tracing.dataCollected")
    .flatMap((event) => event.params?.value ?? [])
  const afterMetrics = await performanceMetrics(send)
  const pageProfile = await readPageProfile(send)

  return {
    id: options.id ?? scenarioId,
    baseScenarioId: scenarioId,
    scrollbench,
    metricsDelta: metricDelta(beforeMetrics, afterMetrics),
    trace: summarizeTrace(traceEvents),
    ...pageProfile,
  }
}

async function warmUpScrollbench(send) {
  await settleScrollerAtTop(send)
  await evaluate(send, `window.__scrollbench.runScenario("small")`)
  await settleScrollerAtTop(send)
  await resetPageProfilers(send)
}

function assertProfile(report) {
  const failures = []

  for (const scenario of report.scenarios) {
    const mutations = scenario.profile?.mutations ?? {}
    const longTaskCount = scenario.profile?.longTasks?.length ?? 0
    const p95FrameMs =
      scenario.scrollbench?.p95FrameMs ?? Number.POSITIVE_INFINITY
    const maxFrameMs =
      scenario.scrollbench?.maxFrameMs ?? Number.POSITIVE_INFINITY

    if (mutations.childList !== 0) {
      failures.push(`${scenario.id}: childList ${mutations.childList} !== 0`)
    }
    if (mutations.addedElements !== 0) {
      failures.push(
        `${scenario.id}: addedElements ${mutations.addedElements} !== 0`
      )
    }
    if (mutations.removedElements !== 0) {
      failures.push(
        `${scenario.id}: removedElements ${mutations.removedElements} !== 0`
      )
    }
    if (longTaskCount !== 0) {
      failures.push(`${scenario.id}: longTasks ${longTaskCount} !== 0`)
    }
    if (p95FrameMs > frameP95BudgetMs) {
      failures.push(
        `${scenario.id}: p95FrameMs ${p95FrameMs.toFixed(1)} > ${frameP95BudgetMs}`
      )
    }
    if (maxFrameMs > maxFrameBudgetMs) {
      failures.push(
        `${scenario.id}: maxFrameMs ${maxFrameMs.toFixed(1)} > ${maxFrameBudgetMs}`
      )
    }
  }

  if (failures.length) {
    throw new Error(
      `CSV ScrollBench assertions failed:\n${failures.join("\n")}`
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

const chromeEndpoint = `http://127.0.0.1:${chromePort}`
const userDataDir = await mkdtemp(join(tmpdir(), "csv-scrollbench-chrome-"))
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
    width: Number(process.env.PROFILE_VIEWPORT_WIDTH ?? 1440),
    height: Number(process.env.PROFILE_VIEWPORT_HEIGHT ?? 900),
    deviceScaleFactor: 1,
    mobile: false,
  })

  console.error(`Opening ${profileUrl}`)
  const loadEvent = page.waitForEvent("Page.loadEventFired", 60_000)
  const startedAt = Date.now()
  await send("Page.navigate", { url: profileUrl })
  await loadEvent

  await waitInPage(
    send,
    `window.__scrollbench?.getScroller?.()?.scrollHeight > window.__scrollbench?.getScroller?.()?.clientHeight`,
    30_000
  )
  await installPageProfilers(send)
  await sleep(500)

  const initial = await evaluate(
    send,
    `(() => {
      const scroller = window.__scrollbench.getScroller();
      const navigation = performance.getEntriesByType("navigation")[0];
      const paint = performance.getEntriesByType("paint")
        .map((entry) => ({ name: entry.name, startTime: entry.startTime }));
      return {
        url: location.href,
        elapsedWallMs: ${Date.now()} - ${startedAt},
        navigation: navigation ? {
          domContentLoaded: navigation.domContentLoadedEventEnd,
          load: navigation.loadEventEnd,
          responseEnd: navigation.responseEnd,
          transferSize: navigation.transferSize,
          encodedBodySize: navigation.encodedBodySize
        } : null,
        paint,
        scroll: {
          scrollTop: scroller.scrollTop,
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
          maxScrollTop: scroller.scrollHeight - scroller.clientHeight
        },
        dom: {
          rows: document.querySelectorAll('[data-slot="csv-row"]').length,
          cells: document.querySelectorAll('[data-slot="csv-cell"]').length,
          totalNodes: document.getElementsByTagName("*").length
        }
      };
    })()`
  )

  if (shouldWarmup) {
    console.error("Warming up CSV ScrollBench")
    await warmUpScrollbench(send)
  }

  const scenarios = [
    await runScenario(page, send, "small"),
    await runScenario(page, send, "large"),
    await runScenario(page, send, "large", {
      id: "horizontal-large",
      setupExpression: `new Promise((resolve) => {
        const scroller = window.__scrollbench?.getScroller?.();
        if (!scroller) {
          resolve(false);
          return;
        }
        scroller.scrollLeft = 12 * 180;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => resolve(true), 100);
          });
        });
      })`,
    }),
  ]

  const report = {
    measuredAt: new Date().toISOString(),
    route: profileUrl,
    mode: "headless Chrome CDP + ScrollBench CSV runner",
    initial,
    scenarios,
  }

  console.log(JSON.stringify(report, null, 2))

  page.socket.close()
  if (shouldAssert) assertProfile(report)
} finally {
  chrome.kill("SIGTERM")
  await waitForProcessExit(chrome)
  await removeChromeProfile(userDataDir)
}
