import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const profileUrl =
  process.env.PROFILE_URL ??
  "http://localhost:3100/scrollbench?viewer=json-form-sources"
const chromePort = Number(process.env.CHROME_PORT ?? 9334)
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
      if (payload.error)
        request.reject(new Error(JSON.stringify(payload.error)))
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

async function mouseMove(send, point) {
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  })
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

async function installPageHelpers(send) {
  await evaluate(
    send,
    `(() => {
      window.__jsonFormSourceProfile = {
        activeAttributeChanges: 0,
        activeAttributeSets: 0,
        activeAttributeClears: 0,
        sourcePathMouseOvers: 0,
        sourcePathMouseOuts: 0
      };

      if (!window.__jsonFormSourceObserver) {
        window.__jsonFormSourceObserver = new MutationObserver((mutations) => {
          const profile = window.__jsonFormSourceProfile;
          for (const mutation of mutations) {
            if (mutation.type !== "attributes") continue;
            if (mutation.attributeName !== "data-source-active") continue;
            profile.activeAttributeChanges += 1;
            if (mutation.target.getAttribute("data-source-active") === "true") {
              profile.activeAttributeSets += 1;
            } else {
              profile.activeAttributeClears += 1;
            }
          }
        });
        window.__jsonFormSourceObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-source-active"],
          subtree: true
        });
      }

      if (!window.__jsonFormSourceEventCountersInstalled) {
        window.__jsonFormSourceEventCountersInstalled = true;
        document.addEventListener("mouseover", (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("[data-source-path]")) {
            window.__jsonFormSourceProfile.sourcePathMouseOvers += 1;
          }
        }, true);
        document.addEventListener("mouseout", (event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("[data-source-path]")) {
            window.__jsonFormSourceProfile.sourcePathMouseOuts += 1;
          }
        }, true);
      }
    })()`
  )
}

async function resetScenario(send) {
  await evaluate(
    send,
    `(() => {
      const profile = window.__jsonFormSourceProfile;
      if (profile) {
        profile.activeAttributeChanges = 0;
        profile.activeAttributeSets = 0;
        profile.activeAttributeClears = 0;
        profile.sourcePathMouseOvers = 0;
        profile.sourcePathMouseOuts = 0;
      }
      performance.clearMarks();
      performance.clearMeasures();
    })()`
  )
}

async function collectScenario(send) {
  return evaluate(
    send,
    `(() => ({
      sourceProfile: window.__jsonFormSourceProfile,
      dom: {
        nodes: document.getElementsByTagName("*").length,
        sourceCells: document.querySelectorAll("[data-source-path]").length,
        activeSourceCells: document.querySelectorAll("[data-source-active='true']").length,
        rows: document.querySelectorAll('[data-slot="json-form-table-scroll"] [data-index]').length
      }
    }))()`
  )
}

async function waitInPage(send, expression, timeoutMs = 5_000) {
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

async function runScenario(page, send, name, action, waitExpression) {
  console.error(`Running scenario: ${name}`)
  await resetScenario(send)
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
  const details = await collectScenario(send)
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
    ...details,
    metricsDelta: metricDelta(beforeMetrics, afterMetrics),
    trace: summarizeTrace(traceEvents),
  }

  console.log(`\n${name}`)
  console.log(
    `  wait: ${wait.ok ? "ok" : "timeout"} ${wait.elapsedMs.toFixed(1)} ms`
  )
  console.log(
    `  source attrs: ${scenario.sourceProfile.activeAttributeChanges} changes (${scenario.sourceProfile.activeAttributeSets} set, ${scenario.sourceProfile.activeAttributeClears} clear)`
  )
  console.log(
    `  events: ${scenario.sourceProfile.sourcePathMouseOvers} over, ${scenario.sourceProfile.sourcePathMouseOuts} out`
  )
  console.log(
    `  trace: script ${scenario.metricsDelta.ScriptDurationMs.toFixed(1)} ms, style ${scenario.metricsDelta.RecalcStyleDurationMs.toFixed(1)} ms, layout ${scenario.metricsDelta.LayoutDurationMs.toFixed(1)} ms, task ${scenario.metricsDelta.TaskDurationMs.toFixed(1)} ms`
  )
  console.log(
    `  max: event ${scenario.trace.EventDispatch.maxMs.toFixed(1)} ms, function ${scenario.trace.FunctionCall.maxMs.toFixed(1)} ms, style ${scenario.trace.UpdateLayoutTree.maxMs.toFixed(1)} ms`
  )

  return scenario
}

async function moveOutsideForm(send) {
  await mouseMove(send, { x: 8, y: 8 })
  await sleep(80)
}

async function visibleSourceCellPoints(send, limit) {
  return evaluate(
    send,
    `(() => {
      const scroller = document.querySelector('[data-slot="json-form-table-scroll"]');
      if (!scroller) return [];
      return [...scroller.querySelectorAll("[data-source-path]")]
        .slice(0, ${limit})
        .map((cell) => {
          const rect = cell.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        });
    })()`
  )
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
const userDataDir = await mkdtemp(join(tmpdir(), "json-form-sources-chrome-"))
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

  await waitInPage(
    send,
    `document.querySelectorAll('[data-slot="json-form-table-scroll"] [data-source-path]').length > 0`,
    30_000
  )
  await installPageHelpers(send)
  await sleep(500)

  const initial = await evaluate(
    send,
    `(() => {
      const scroller = document.querySelector('[data-slot="json-form-table-scroll"]');
      const navigation = performance.getEntriesByType("navigation")[0];
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
        scroll: {
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
          scrollTop: scroller.scrollTop,
          scrollWidth: scroller.scrollWidth,
          clientWidth: scroller.clientWidth
        },
        sourceCells: document.querySelectorAll("[data-source-path]").length,
        totalDomNodes: document.getElementsByTagName("*").length
      };
    })()`
  )

  const scenarios = []

  scenarios.push(
    await runScenario(
      page,
      send,
      "hover-first-45-source-cells",
      async () => {
        await moveOutsideForm(send)
        const points = await visibleSourceCellPoints(send, 45)
        if (points.length === 0) throw new Error("No source cells found")
        for (const point of points) {
          await mouseMove(send, point)
          await sleep(16)
        }
      },
      "true"
    )
  )

  scenarios.push(
    await runScenario(
      page,
      send,
      "hover-same-source-cell-30x",
      async () => {
        await moveOutsideForm(send)
        const [point] = await visibleSourceCellPoints(send, 1)
        if (!point) throw new Error("No source cell found")
        for (let index = 0; index < 30; index++) {
          await mouseMove(send, {
            x: point.x + (index % 2 === 0 ? 1 : -1),
            y: point.y,
          })
          await sleep(8)
        }
      },
      "true"
    )
  )

  scenarios.push(
    await runScenario(
      page,
      send,
      "scroll-transactions-table",
      async () => {
        await evaluate(
          send,
          `new Promise(async (resolve) => {
            const scroller = document.querySelector('[data-slot="json-form-table-scroll"]');
            scroller.scrollTop = 0;
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
            const max = scroller.scrollHeight - scroller.clientHeight;
            for (let index = 0; index < 80; index++) {
              const ratio = index % 40 / 39;
              scroller.scrollTop = Math.round((index < 40 ? ratio : 1 - ratio) * max);
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

  const report = {
    measuredAt: new Date().toISOString(),
    route: profileUrl,
    mode: "headless Chrome CDP + source-link trace",
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
