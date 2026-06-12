import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const profileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/json-table-profile"
const chromePort = Number(process.env.CHROME_PORT ?? 9333)
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`)
  }
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
    if (payload.method) {
      events.push(payload)
    }
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

async function runScrollScenario(send, page, { name, scrollStep }) {
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

  const scroll = await evaluate(
    send,
    `(async () => {
      const scroller = window.__jsonTableScroller;
      const section = window.__jsonTableSection;
      if (!scroller || !section) return { error: "json table scroller not found" };

      window.__jsonTablePerf.longTasks.length = 0;
      const frames = [];
      let lastFrameAt = performance.now();
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;

      for (let i = 0; i < 120; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        frames.push(now - lastFrameAt);
        lastFrameAt = now;
        scroller.scrollTop = Math.min(maxScrollTop, i * ${scrollStep});
      }

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const sorted = frames.slice().sort((a, b) => a - b);
      const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

      return {
        finalScrollTop: scroller.scrollTop,
        frames: {
          count: frames.length,
          avg: frames.reduce((total, value) => total + value, 0) / frames.length,
          p50: percentile(0.5),
          p95: percentile(0.95),
          max: sorted[sorted.length - 1],
          over16: frames.filter((duration) => duration > 16.7).length,
          over33: frames.filter((duration) => duration > 33.4).length,
        },
        longTasks: window.__jsonTablePerf.longTasks,
        mountedRows: section.querySelectorAll("tr").length,
        mountedDataCells: section.querySelectorAll("[data-field-path]").length,
        totalDomNodes: document.getElementsByTagName("*").length,
      };
    })()`
  )

  const performanceMetricsRaw = await send("Performance.getMetrics")
  const performanceMetrics = Object.fromEntries(
    performanceMetricsRaw.metrics.map((metric) => [metric.name, metric.value])
  )

  await send("Tracing.end")
  await page.waitForEvent("Tracing.tracingComplete", 60_000)
  const traceEvents = page.events
    .filter((event) => event.method === "Tracing.dataCollected")
    .flatMap((event) => event.params?.value ?? [])

  return {
    name,
    scroll,
    performanceMetrics: {
      JSHeapUsedSize: performanceMetrics.JSHeapUsedSize,
      Nodes: performanceMetrics.Nodes,
      LayoutCount: performanceMetrics.LayoutCount,
      RecalcStyleCount: performanceMetrics.RecalcStyleCount,
      LayoutDurationMs: (performanceMetrics.LayoutDuration ?? 0) * 1000,
      RecalcStyleDurationMs:
        (performanceMetrics.RecalcStyleDuration ?? 0) * 1000,
      ScriptDurationMs: (performanceMetrics.ScriptDuration ?? 0) * 1000,
      TaskDurationMs: (performanceMetrics.TaskDuration ?? 0) * 1000,
    },
    trace: summarizeTrace(traceEvents),
  }
}

const chromeEndpoint = `http://127.0.0.1:${chromePort}`
const userDataDir = await mkdtemp(join(tmpdir(), "json-table-chrome-"))
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

try {
  await waitForDevToolsEndpoint(chromeEndpoint)
  const newTargetResponse = await fetch(
    `${chromeEndpoint}/json/new?about:blank`,
    {
      method: "PUT",
    }
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
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__jsonTablePerf = { longTasks: [] };
      try {
        new PerformanceObserver((list) => {
          window.__jsonTablePerf.longTasks.push(
            ...list.getEntries().map((entry) => ({
              startTime: entry.startTime,
              duration: entry.duration
            }))
          );
        }).observe({ type: "longtask", buffered: true });
      } catch {}
    `,
  })

  const loadEvent = page.waitForEvent("Page.loadEventFired", 60_000)
  const startedAt = Date.now()
  await send("Page.navigate", { url: profileUrl })
  await loadEvent

  await evaluate(
    send,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + 15000;
      const find = () => {
        const section = [...document.querySelectorAll("section")]
          .find((section) => section.textContent?.includes("JSON table"));
        const scroller = section
          ? [...section.querySelectorAll("div")]
              .find((element) => element.scrollHeight > element.clientHeight + 100 && element.clientHeight > 100)
          : null;
        if (section && scroller) {
          window.__jsonTableSection = section;
          window.__jsonTableScroller = scroller;
          resolve(true);
        } else if (performance.now() > deadline) {
          reject(new Error("JSON table section/scroller not found"));
        } else {
          setTimeout(find, 100);
        }
      };
      find();
    })`
  )
  await sleep(500)

  const initial = await evaluate(
    send,
    `(() => {
      const section = window.__jsonTableSection;
      const scroller = window.__jsonTableScroller;
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
          encodedBodySize: navigation.encodedBodySize,
        } : null,
        paint,
        scroll: {
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
          scrollTop: scroller.scrollTop,
        },
        mountedRows: section.querySelectorAll("tr").length,
        mountedDataCells: section.querySelectorAll("[data-field-path]").length,
        totalDomNodes: document.getElementsByTagName("*").length,
      };
    })()`
  )

  const smallScroll = await runScrollScenario(send, page, {
    name: "small-increment",
    scrollStep: Number(process.env.SMALL_SCROLL_STEP ?? 20),
  })
  const largeScroll = await runScrollScenario(send, page, {
    name: "large-jump",
    scrollStep: Number(process.env.LARGE_SCROLL_STEP ?? 420),
  })

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        route: profileUrl,
        mode: "headless Chrome CDP",
        initial,
        scenarios: [smallScroll, largeScroll],
      },
      null,
      2
    )
  )

  page.socket.close()
} finally {
  chrome.kill("SIGTERM")
  await waitForProcessExit(chrome)
  await removeChromeProfile(userDataDir)
}
