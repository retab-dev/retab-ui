#!/usr/bin/env node
import { spawn } from "node:child_process"
import { accessSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

const baseUrl =
  process.env.TEXT_VIEWER_PERFORMANCE_BASE_URL ?? "http://localhost:3100"
const timeoutMs = Number(
  process.env.TEXT_VIEWER_PERFORMANCE_TIMEOUT_MS ?? 45_000
)
const shouldAssert = process.argv.includes("--assert")
const outputPath = process.env.TEXT_VIEWER_PERFORMANCE_OUTPUT
const profileLoadBudgetMs = Number(
  process.env.TEXT_VIEWER_PROFILE_LOAD_BUDGET_MS ?? 5_000
)
const scrollFrameP95BudgetMs = Number(
  process.env.TEXT_VIEWER_SCROLL_FRAME_P95_BUDGET_MS ?? 35
)
const chromePath = findChrome()

if (!chromePath) {
  fail(
    "Chrome/Chromium was not found. Set CHROME_BIN to run text viewer performance verification."
  )
}

await assertDevServer(baseUrl)

const userDataDir = await mkdtemp(join(tmpdir(), "retab-text-viewer-chrome-"))
const devtoolsPort = await getFreePort()
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${devtoolsPort}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--disable-background-networking",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] }
)
let chromeOutput = ""
chrome.stdout.on("data", (chunk) => {
  chromeOutput += chunk.toString()
})
chrome.stderr.on("data", (chunk) => {
  chromeOutput += chunk.toString()
})

try {
  await waitForDevtoolsPort(devtoolsPort, chrome)
  const target = await createTarget(devtoolsPort)
  const client = await createCdpClient(target.webSocketDebuggerUrl)
  const errors = []

  client.on("Runtime.exceptionThrown", (params) => {
    errors.push(
      params.exceptionDetails?.text ??
        params.exceptionDetails?.exception?.description ??
        "runtime exception"
    )
  })
  client.on("Runtime.consoleAPICalled", (params) => {
    if (params.type !== "error") return
    errors.push(
      params.args?.map((arg) => arg.value ?? arg.description).join(" ") ??
        "console error"
    )
  })
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error") errors.push(params.entry.text)
  })

  await client.send("Runtime.enable")
  await client.send("Log.enable")
  await client.send("Page.enable")
  await client.send("Performance.enable")
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__textViewerPerfLongTasks = [];
      try {
        new PerformanceObserver((list) => {
          window.__textViewerPerfLongTasks.push(
            ...list.getEntries().map((entry) => ({
              duration: entry.duration,
              name: entry.name,
              startTime: entry.startTime
            }))
          );
        }).observe({ entryTypes: ["longtask"] });
      } catch {}
    `,
  })

  const scenarios = [
    await runViewerScenario(client, {
      label: "text-viewer routed markdown",
      path: "/text-viewer-profile?variant=current",
      selector:
        '[data-slot="markdown-virtual-canvas"], [data-slot="text-virtual-canvas"]',
      viewport: { height: 720, mobile: false, width: 1280 },
    }),
    await runViewerScenario(client, {
      label: "text-viewer chenglou projection",
      path: "/text-viewer-profile?variant=chenglou",
      selector: '[data-slot="text-virtual-canvas"]',
      viewport: { height: 720, mobile: false, width: 1280 },
    }),
    await runViewerScenario(client, {
      label: "text-viewer vanillacheng projection",
      path: "/text-viewer-profile?variant=vanillacheng",
      selector: '[data-slot="text-virtual-canvas"]',
      viewport: { height: 720, mobile: false, width: 1280 },
    }),
    await runViewerScenario(client, {
      label: "markdown viewer route",
      path: "/view/markdown-viewer",
      selector: '[data-slot="markdown-virtual-canvas"]',
      viewport: { height: 720, mobile: false, width: 1280 },
    }),
    await runScrollbenchScenario(client, {
      label: "scrollbench text viewer",
      path: "/scrollbench?viewer=text",
      viewport: { height: 720, mobile: false, width: 1280 },
    }),
  ]

  const report = {
    baseUrl,
    errors,
    generatedAt: new Date().toISOString(),
    scenarios,
  }

  if (shouldAssert) assertReport(report)
  const json = JSON.stringify(report, null, 2)
  if (outputPath) await writeFile(outputPath, `${json}\n`)
  console.log(json)
  client.close()
} finally {
  await stopChrome(chrome)
  await rm(userDataDir, { force: true, recursive: true })
}

async function runViewerScenario(client, { label, path, selector, viewport }) {
  await setViewport(client, viewport)
  const url = absoluteUrl(path)
  const beforeMetrics = await performanceMetrics(client)
  await navigate(client, url)
  await waitInPage(
    client,
    `Boolean(document.querySelector(${JSON.stringify(selector)}))`
  )
  await waitInPage(client, "document.fonts?.status !== 'loading'")
  await delay(250)
  const afterMetrics = await performanceMetrics(client)
  const snapshot = await evaluate(
    client,
    `(() => {
      const canvas = document.querySelector(${JSON.stringify(selector)});
      const viewport = canvas?.closest('[data-slot="scroll-area-viewport"]');
      const navigation = performance.getEntriesByType("navigation")[0];
      const longTasks = window.__textViewerPerfLongTasks ?? [];
      return {
        bodyTextLength: document.body.textContent?.length ?? 0,
        chunkCount: document.querySelectorAll("[data-markdown-chunk]").length,
        canvasSlot: canvas?.getAttribute("data-slot") ?? null,
        loadMs: navigation?.duration ?? performance.now(),
        longTaskCount: longTasks.length,
        maxLongTaskMs: Math.max(0, ...longTasks.map((entry) => entry.duration)),
        mountedTextRows: document.querySelectorAll('[data-slot="text-line"]').length,
        nodeCount: document.querySelectorAll("*").length,
        scrollHeight: viewport?.scrollHeight ?? null,
        scrollTop: viewport?.scrollTop ?? null,
        viewportHeight: viewport?.clientHeight ?? null
      };
    })()`
  )
  return {
    label,
    metrics: metricDelta(beforeMetrics, afterMetrics),
    snapshot,
    url,
  }
}

async function runScrollbenchScenario(client, { label, path, viewport }) {
  await setViewport(client, viewport)
  const url = absoluteUrl(path)
  await navigate(client, url)
  await waitInPage(client, "Boolean(window.__scrollbench?.run)")
  const beforeMetrics = await performanceMetrics(client)
  const result = await evaluate(
    client,
    `window.__scrollbench.run().then((result) => ({
      measuredAt: result.measuredAt,
      scenarios: result.scenarios,
      viewer: result.viewer,
      viewport: result.viewport
    }))`
  )
  const afterMetrics = await performanceMetrics(client)
  return {
    label,
    metrics: metricDelta(beforeMetrics, afterMetrics),
    result,
    url,
  }
}

function assertReport(report) {
  if (report.errors.length) {
    fail(`Browser errors were reported:\n${report.errors.join("\n")}`)
  }
  for (const scenario of report.scenarios) {
    if (scenario.snapshot) {
      if (!scenario.snapshot.canvasSlot) {
        fail(`${scenario.label}: no viewer canvas mounted.`)
      }
      if (scenario.snapshot.loadMs > profileLoadBudgetMs) {
        fail(
          `${scenario.label}: load ${scenario.snapshot.loadMs.toFixed(
            1
          )}ms exceeds ${profileLoadBudgetMs}ms.`
        )
      }
    }
    const p95FrameMs = maxScenarioP95FrameMs(scenario.result)
    if (p95FrameMs > scrollFrameP95BudgetMs) {
      fail(
        `${scenario.label}: p95 frame ${p95FrameMs.toFixed(
          1
        )}ms exceeds ${scrollFrameP95BudgetMs}ms.`
      )
    }
  }
}

function maxScenarioP95FrameMs(result) {
  const values =
    result?.scenarios
      ?.map((scenario) => scenario.p95FrameMs)
      .filter((value) => Number.isFinite(value)) ?? []
  return Math.max(0, ...values)
}

async function navigate(client, url) {
  const loaded = client.waitFor("Page.loadEventFired", timeoutMs)
  await client.send("Page.navigate", { url })
  await loaded
}

async function setViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: viewport.height,
    mobile: viewport.mobile,
    width: viewport.width,
  })
}

async function waitInPage(client, predicate, ms = timeoutMs) {
  const timeoutMessage = JSON.stringify(`Timed out waiting for: ${predicate}`)
  return evaluate(
    client,
    `new Promise((resolve, reject) => {
      const deadline = performance.now() + ${ms};
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

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime evaluation failed."
    )
  }
  return result.result.value
}

async function performanceMetrics(client) {
  const raw = await client.send("Performance.getMetrics")
  return Object.fromEntries(
    raw.metrics.map((metric) => [metric.name, metric.value])
  )
}

function metricDelta(before, after) {
  return {
    JSHeapUsedSize: after.JSHeapUsedSize,
    LayoutCount: delta(before, after, "LayoutCount"),
    LayoutDurationMs: delta(before, after, "LayoutDuration") * 1000,
    Nodes: after.Nodes,
    RecalcStyleCount: delta(before, after, "RecalcStyleCount"),
    RecalcStyleDurationMs: delta(before, after, "RecalcStyleDuration") * 1000,
    ScriptDurationMs: delta(before, after, "ScriptDuration") * 1000,
    TaskDurationMs: delta(before, after, "TaskDuration") * 1000,
  }
}

function delta(before, after, key) {
  return (after[key] ?? 0) - (before[key] ?? 0)
}

async function assertDevServer(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) fail(`Dev server responded ${response.status} for ${url}`)
  } catch {
    fail(
      `Dev server is not reachable at ${url}. Start it before running this verifier.`
    )
  }
}

function absoluteUrl(path) {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString()
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      accessSync(candidate)
      return candidate
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

async function getFreePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  await new Promise((resolve) => server.close(resolve))
  if (!address || typeof address === "string") {
    fail("Failed to allocate a local Chrome DevTools port.")
  }
  return address.port
}

async function waitForDevtoolsPort(port, chromeProcess) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (chromeProcess.exitCode != null) {
      fail(
        `Chrome exited before DevTools became available. Output:\n${chromeOutput}`
      )
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return
    } catch {
      await delay(50)
    }
  }
  fail(
    `Timed out waiting for Chrome DevTools port ${port}. Output:\n${chromeOutput}`
  )
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new`, {
    method: "PUT",
  })
  if (!response.ok) fail(`Failed to create Chrome tab: ${response.status}`)
  return response.json()
}

async function createCdpClient(url) {
  const socket = new WebSocket(url)
  const pending = new Map()
  const listeners = new Map()
  let id = 0

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
      return
    }
    const handlers = listeners.get(message.method)
    if (handlers) {
      for (const handler of handlers) handler(message.params ?? {})
    }
  })

  return {
    close() {
      socket.close()
    },
    on(method, handler) {
      const handlers = listeners.get(method) ?? []
      handlers.push(handler)
      listeners.set(method, handlers)
    },
    send(method, params = {}) {
      id += 1
      socket.send(JSON.stringify({ id, method, params }))
      return new Promise((resolve, reject) => {
        pending.set(id, { reject, resolve })
      })
    },
    waitFor(method, ms) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Timed out waiting for ${method}`)),
          ms
        )
        this.on(method, (params) => {
          clearTimeout(timer)
          resolve(params)
        })
      })
    },
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopChrome(chromeProcess) {
  if (chromeProcess.exitCode != null) return
  const exited = new Promise((resolve) => {
    chromeProcess.once("exit", resolve)
  })
  chromeProcess.kill("SIGTERM")
  await Promise.race([exited, delay(2_000)])
  if (chromeProcess.exitCode == null) chromeProcess.kill("SIGKILL")
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
