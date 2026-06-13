import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const profileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/json-form-large-array"
const chromePort = Number(process.env.CHROME_PORT ?? 9447)
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const outputPath = process.env.PROFILE_OUTPUT

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
      if (payload.error) request.reject(new Error(JSON.stringify(payload.error)))
      else request.resolve(payload.result)
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

function performanceMetrics(metricsRaw) {
  const metrics = Object.fromEntries(
    metricsRaw.metrics.map((metric) => [metric.name, metric.value])
  )
  return {
    JSHeapUsedSize: metrics.JSHeapUsedSize,
    Nodes: metrics.Nodes,
    LayoutCount: metrics.LayoutCount,
    RecalcStyleCount: metrics.RecalcStyleCount,
    LayoutDurationMs: (metrics.LayoutDuration ?? 0) * 1000,
    RecalcStyleDurationMs: (metrics.RecalcStyleDuration ?? 0) * 1000,
    ScriptDurationMs: (metrics.ScriptDuration ?? 0) * 1000,
    TaskDurationMs: (metrics.TaskDuration ?? 0) * 1000,
  }
}

function metricDelta(before, after) {
  return Object.fromEntries(
    Object.keys(after).map((key) => [key, after[key] - before[key]])
  )
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
    MinorGC: byName("MinorGC"),
    MajorGC: byName("MajorGC"),
    topEvents: completeEvents
      .filter((event) => (event.dur ?? 0) > 1_000)
      .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
      .slice(0, 20)
      .map((event) => ({
        name: event.name,
        ms: (event.dur ?? 0) / 1000,
        category: event.cat,
        type: event.args?.data?.type,
      })),
  }
}

async function waitInPage(send, expression, timeoutMs = 30_000) {
  return evaluate(
    send,
    `(async () => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < ${timeoutMs}) {
        if (${expression}) {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return { ok: true, elapsedMs: performance.now() - startedAt };
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return { ok: false, elapsedMs: performance.now() - startedAt };
    })()`
  )
}

async function collectPageState(send) {
  return evaluate(
    send,
    `(() => {
      const scroller = document.querySelector('[data-slot="json-form-table-scroll"]');
      const rowCountText = document.querySelector("header p")?.textContent ?? "";
      return {
        rowCountText,
        dom: {
          nodes: document.getElementsByTagName("*").length,
          tableRows: document.querySelectorAll('[data-slot="json-form-table-scroll"] [data-index]').length,
          dataCells: document.querySelectorAll('[data-slot="json-form-table-scroll"] [data-slot="data-cell"]').length,
          buttons: document.querySelectorAll("button").length,
        },
        scroll: scroller ? {
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
          scrollTop: scroller.scrollTop,
          maxScrollTop: scroller.scrollHeight - scroller.clientHeight
        } : null
      };
    })()`
  )
}

async function runScenario(page, send, name, action, waitExpression) {
  console.error(`Running scenario: ${name}`)
  page.events.length = 0
  const beforeMetrics = performanceMetrics(await send("Performance.getMetrics"))

  await send("Tracing.start", {
    transferMode: "ReportEvents",
    categories: [
      "devtools.timeline",
      "v8.execute",
      "blink.user_timing",
      "disabled-by-default-devtools.timeline",
    ].join(","),
  })

  const startedAt = await evaluate(send, "performance.now()")
  await action()
  const wait = waitExpression
    ? await waitInPage(send, waitExpression)
    : await waitInPage(send, "true", 100)
  const elapsedMs = await evaluate(
    send,
    `performance.now() - ${JSON.stringify(startedAt)}`
  )
  const state = await collectPageState(send)
  const afterMetrics = performanceMetrics(await send("Performance.getMetrics"))

  await send("Tracing.end")
  await page.waitForEvent("Tracing.tracingComplete", 60_000)
  const traceEvents = page.events
    .filter((event) => event.method === "Tracing.dataCollected")
    .flatMap((event) => event.params?.value ?? [])

  const scenario = {
    name,
    elapsedMs,
    wait,
    state,
    metricsDelta: metricDelta(beforeMetrics, afterMetrics),
    trace: summarizeTrace(traceEvents),
  }

  printScenarioSummary(scenario)
  return scenario
}

function printScenarioSummary(scenario) {
  const metrics = scenario.metricsDelta
  const trace = scenario.trace
  console.log(`\n${scenario.name}`)
  console.log(
    `  wait: ${scenario.wait.ok ? "ok" : "timeout"} ${scenario.wait.elapsedMs.toFixed(1)} ms; elapsed ${scenario.elapsedMs.toFixed(1)} ms`
  )
  console.log(
    `  dom: ${scenario.state.dom.tableRows} rows, ${scenario.state.dom.dataCells} cells, ${scenario.state.dom.nodes} nodes`
  )
  console.log(
    `  trace: script ${metrics.ScriptDurationMs.toFixed(1)} ms, style ${metrics.RecalcStyleDurationMs.toFixed(1)} ms, layout ${metrics.LayoutDurationMs.toFixed(1)} ms, task ${metrics.TaskDurationMs.toFixed(1)} ms`
  )
  console.log(
    `  max: function ${trace.FunctionCall.maxMs.toFixed(1)} ms, style ${trace.UpdateLayoutTree.maxMs.toFixed(1)} ms, layout ${trace.Layout.maxMs.toFixed(1)} ms`
  )
}

async function clickButtonByText(send, text) {
  const point = await evaluate(
    send,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === ${JSON.stringify(text)});
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
  if (!point) throw new Error(`Button not found: ${text}`)
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  })
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  })
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  })
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
const userDataDir = await mkdtemp(join(tmpdir(), "json-form-large-array-"))
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
  console.error(`Opening ${profileUrl}`)
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

  const loadEvent = page.waitForEvent("Page.loadEventFired", 60_000)
  const startedAt = Date.now()
  await send("Page.navigate", { url: profileUrl })
  await loadEvent
  const ready = await waitInPage(
    send,
    `document.querySelectorAll('[data-slot="json-form-table-scroll"] [data-slot="data-cell"]').length > 0`,
    60_000
  )
  if (!ready.ok) throw new Error("Large array page did not become ready")
  await sleep(500)

  const initial = {
    wallMs: Date.now() - startedAt,
    state: await collectPageState(send),
    metrics: performanceMetrics(await send("Performance.getMetrics")),
  }
  console.log("\ninitial")
  console.log(
    `  wall: ${initial.wallMs} ms; ${initial.state.rowCountText}; ${initial.state.dom.tableRows} rows, ${initial.state.dom.dataCells} cells`
  )

  const scenarios = []

  scenarios.push(
    await runScenario(
      page,
      send,
      "small-scroll-120-frames",
      async () => {
        await evaluate(
          send,
          `new Promise(async (resolve) => {
            const scroller = document.querySelector('[data-slot="json-form-table-scroll"]');
            scroller.scrollTop = 0;
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
            const max = scroller.scrollHeight - scroller.clientHeight;
            for (let index = 0; index < 120; index++) {
              scroller.scrollTop = Math.round(((index + 1) * 120) % max);
              scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
              await new Promise((done) => requestAnimationFrame(done));
            }
            resolve(true);
          })`
        )
      },
      "true"
    )
  )

  scenarios.push(
    await runScenario(
      page,
      send,
      "jump-scroll-80-frames",
      async () => {
        await evaluate(
          send,
          `new Promise(async (resolve) => {
            const scroller = document.querySelector('[data-slot="json-form-table-scroll"]');
            const max = scroller.scrollHeight - scroller.clientHeight;
            for (let index = 0; index < 80; index++) {
              const ratio = index % 2 === 0 ? 0.92 : 0.08;
              scroller.scrollTop = Math.round(max * ratio);
              scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
              await new Promise((done) => requestAnimationFrame(done));
            }
            resolve(true);
          })`
        )
      },
      "true"
    )
  )

  scenarios.push(
    await runScenario(
      page,
      send,
      "reset-to-100k",
      async () => clickButtonByText(send, "100,000"),
      `document.querySelector("header p")?.textContent?.includes("100,000")`
    )
  )

  scenarios.push(
    await runScenario(
      page,
      send,
      "reset-to-10k",
      async () => clickButtonByText(send, "10,000"),
      `document.querySelector("header p")?.textContent?.includes("10,000")`
    )
  )

  const report = {
    measuredAt: new Date().toISOString(),
    route: profileUrl,
    mode: "headless Chrome CDP + JsonForm large array trace",
    initial,
    scenarios,
  }

  console.log("\nFull JSON report follows.")
  console.log(JSON.stringify(report, null, 2))

  if (outputPath) {
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.error(`Wrote ${outputPath}`)
  }

  page.socket.close()
} finally {
  chrome.kill("SIGTERM")
  await waitForProcessExit(chrome)
  await removeChromeProfile(userDataDir)
}
