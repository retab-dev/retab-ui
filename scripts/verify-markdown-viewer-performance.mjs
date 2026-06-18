#!/usr/bin/env node
import { spawn } from "node:child_process"
import { accessSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

const baseUrl =
  process.env.MARKDOWN_VIEWER_URL ??
  "http://localhost:3100/view/markdown-viewer"
const timeoutMs = Number(process.env.MARKDOWN_VIEWER_TIMEOUT_MS ?? 30_000)
const outputPath =
  process.env.MARKDOWN_VIEWER_PERFORMANCE_OUTPUT ??
  ".codex-artifacts/markdown-viewer-performance.json"
const budgets = {
  afterScrollMountedChunks: Number(
    process.env.MARKDOWN_VIEWER_MAX_AFTER_SCROLL_CHUNKS ?? 8
  ),
  firstMountedChunks: Number(process.env.MARKDOWN_VIEWER_MAX_FIRST_CHUNKS ?? 8),
  nodesAfterScroll: Number(
    process.env.MARKDOWN_VIEWER_MAX_AFTER_SCROLL_NODES ?? 12_000
  ),
  settledMountedChunks: Number(
    process.env.MARKDOWN_VIEWER_MAX_SETTLED_CHUNKS ?? 8
  ),
}

const chromePath = findChrome()
if (!chromePath) {
  fail(
    "Chrome/Chromium was not found. Set CHROME_BIN to run Markdown viewer performance verification."
  )
}

await assertDevServer(baseUrl)
await mkdir(dirname(outputPath), { recursive: true })

const userDataDir = await mkdtemp(join(tmpdir(), "retab-md-perf-chrome-"))
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
    if (params.type === "error") {
      errors.push(
        params.args?.map((arg) => arg.value ?? arg.description).join(" ") ??
          "console error"
      )
    }
  })

  await client.send("Runtime.enable")
  await client.send("Page.enable")
  await client.send("Performance.enable")
  await client.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: 720,
    mobile: false,
    width: 1280,
  })
  await client.send("Page.navigate", { url: `${baseUrl}#overview` })
  await client.waitFor("Page.loadEventFired", timeoutMs)

  const firstChunk = await waitForMetricSnapshot(
    client,
    (snapshot) => snapshot.chunkCount > 0 && snapshot.chunkCount <= 8,
    "first rendered chunk"
  )
  await delay(600)
  const settled = await metricSnapshot(client)
  await scrollLongDocument(client)
  await delay(300)
  const afterScroll = await metricSnapshot(client)
  assertPerformanceBudgets({
    afterScroll,
    firstChunk,
    settled,
  })

  if (errors.length > 0) {
    fail(`Markdown viewer emitted browser errors:\n${errors.join("\n")}`)
  }

  const result = {
    afterScroll,
    firstChunk,
    settled,
    url: baseUrl,
  }
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  console.log(`Markdown viewer performance written to ${outputPath}`)
  await client.close()
} finally {
  await stopChrome(chrome)
  await rm(userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })
}

async function scrollLongDocument(client) {
  await client.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `new Promise((resolve) => {
      const canvas = document.querySelector('[data-slot="markdown-virtual-canvas"]')
      const viewport = canvas?.closest('[data-slot="scroll-area-viewport"]')
      if (!viewport) {
        resolve(false)
        return
      }
      const target = Math.max(
        viewport.clientHeight * 8,
        Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.clientHeight * 14)
      )
      const start = performance.now()
      let step = 0
      function tick() {
        step += 1
        viewport.scrollTop = Math.min(target, step * viewport.clientHeight * 0.5)
        viewport.dispatchEvent(new Event('scroll', { bubbles: true }))
        if (viewport.scrollTop >= target || performance.now() - start > 3000) {
          resolve(true)
          return
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })`,
  })
}

async function waitForMetricSnapshot(client, predicate, label) {
  const start = Date.now()
  let lastSnapshot = null
  while (Date.now() - start < timeoutMs) {
    lastSnapshot = await metricSnapshot(client)
    if (predicate(lastSnapshot)) return lastSnapshot
    await delay(100)
  }
  fail(
    `${label} did not reach the expected state.\nLast snapshot:\n${JSON.stringify(
      lastSnapshot,
      null,
      2
    )}`
  )
}

async function metricSnapshot(client) {
  const [performanceMetrics, snapshot] = await Promise.all([
    client.send("Performance.getMetrics"),
    client.send("Runtime.evaluate", {
      expression: `(${metricSnapshotExpression})()`,
      returnByValue: true,
    }),
  ])
  return {
    ...snapshot.result.value,
    metrics: Object.fromEntries(
      performanceMetrics.metrics.map((metric) => [metric.name, metric.value])
    ),
  }
}

function metricSnapshotExpression() {
  const canvas = document.querySelector('[data-slot="markdown-virtual-canvas"]')
  const viewport = canvas?.closest('[data-slot="scroll-area-viewport"]')
  const chunks = Array.from(document.querySelectorAll("[data-markdown-chunk]"))
  const codeBlocks = Array.from(
    document.querySelectorAll("[data-pretext-code-source]")
  )
  const diagrams = Array.from(
    document.querySelectorAll("[data-diagram-language='mermaid']")
  )
  return {
    chunkCount: chunks.length,
    codeBlockCount: codeBlocks.length,
    diagramCount: diagrams.length,
    loading: Boolean(
      document.querySelector('[data-slot="markdown-loading-state"]')
    ),
    nativeFindEntries: document.querySelectorAll("[data-native-find-chunk-id]")
      .length,
    scrollHeight: viewport ? Math.round(viewport.scrollHeight) : 0,
    scrollTop: viewport ? Math.round(viewport.scrollTop) : 0,
    viewportHeight: viewport ? Math.round(viewport.clientHeight) : 0,
  }
}

function assertPerformanceBudgets({ afterScroll, firstChunk, settled }) {
  const failures = [
    assertBudget({
      actual: firstChunk.chunkCount,
      budget: budgets.firstMountedChunks,
      label: "first mounted chunks",
    }),
    assertBudget({
      actual: settled.chunkCount,
      budget: budgets.settledMountedChunks,
      label: "settled mounted chunks",
    }),
    assertBudget({
      actual: afterScroll.chunkCount,
      budget: budgets.afterScrollMountedChunks,
      label: "after-scroll mounted chunks",
    }),
    assertBudget({
      actual: afterScroll.metrics.Nodes,
      budget: budgets.nodesAfterScroll,
      label: "after-scroll DOM nodes",
    }),
  ].filter(Boolean)

  if (firstChunk.loading || settled.loading || afterScroll.loading) {
    failures.push("Markdown viewer stayed in loading state.")
  }
  if (afterScroll.scrollTop <= 0) {
    failures.push("Markdown viewer did not scroll during verification.")
  }

  if (failures.length > 0) {
    fail(
      `Markdown viewer exceeded performance budgets:\n${failures.join("\n")}`
    )
  }
}

function assertBudget({ actual, budget, label }) {
  if (typeof actual !== "number" || !Number.isFinite(actual)) {
    return `${label}: missing metric`
  }
  if (actual > budget) {
    return `${label}: ${actual} > ${budget}`
  }
  return null
}

async function assertDevServer(url) {
  try {
    const response = await fetch(url, { method: "HEAD" })
    if (!response.ok) fail(`Dev server responded ${response.status} for ${url}`)
  } catch {
    fail(
      `Dev server is not reachable at ${url}. Start it with "pnpm run dev" before running this verifier.`
    )
  }
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
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
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
