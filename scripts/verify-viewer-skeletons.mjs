#!/usr/bin/env node
import { spawn } from "node:child_process"
import { accessSync, readFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

const fixtures = JSON.parse(
  readFileSync(
    new URL(
      "../app/(view)/viewer-skeleton-verifier/fixtures.json",
      import.meta.url
    ),
    "utf8"
  )
)
const fixtureIds = new Set(
  (process.env.VIEWER_SKELETON_VIEWERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
)
const selectedFixtures =
  fixtureIds.size > 0
    ? fixtures.filter((fixture) => fixtureIds.has(fixture.id))
    : fixtures
const baseUrl =
  process.env.VIEWER_SKELETON_BASE_URL ??
  "http://localhost:3100/viewer-skeleton-verifier"
const timeoutMs = Number(process.env.VIEWER_SKELETON_TIMEOUT_MS ?? 20_000)
const tolerancePx = Number(process.env.VIEWER_SKELETON_TOLERANCE_PX ?? 0.5)

if (selectedFixtures.length === 0) {
  fail(`No viewer fixtures matched VIEWER_SKELETON_VIEWERS.`)
}

const chromePath = findChrome()
if (!chromePath) {
  fail(
    "Chrome/Chromium was not found. Set CHROME_BIN to run viewer skeleton verification."
  )
}

await assertDevServer(`${baseUrl}/${selectedFixtures[0].id}`)

const userDataDir = await mkdtemp(join(tmpdir(), "retab-viewer-skeletons-"))
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
  let activeFixture = null
  let isHoldingFixtureRequests = false
  let pausedRequests = []

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
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error") errors.push(params.entry.text)
  })
  client.on("Fetch.requestPaused", async (params) => {
    if (
      activeFixture &&
      isHoldingFixtureRequests &&
      params.request.url.includes(activeFixture.pauseUrlIncludes)
    ) {
      pausedRequests.push(params.requestId)
      return
    }
    await client.send("Fetch.continueRequest", {
      requestId: params.requestId,
    })
  })

  await client.send("Runtime.enable")
  await client.send("Log.enable")
  await client.send("Network.enable")
  await client.send("Network.setCacheDisabled", { cacheDisabled: true })
  await client.send("Page.enable")
  await client.send("Fetch.enable", {
    patterns: [
      {
        urlPattern: "*",
        requestStage: "Request",
      },
    ],
  })

  const results = []
  for (const fixture of selectedFixtures) {
    activeFixture = fixture
    isHoldingFixtureRequests = true
    pausedRequests = []
    const runId = `${Date.now()}-${fixture.id}`
    const url = `${baseUrl}/${fixture.id}?run=${encodeURIComponent(runId)}`
    await client.send("Page.navigate", { url })

    const skeletonSnapshot = await waitForSnapshot(
      client,
      fixture,
      (snapshot) =>
        snapshot?.skeletonRect &&
        (fixture.readySelector
          ? !snapshot.readyRect
          : fixture.skeletonPersists || !snapshot.loadedRect),
      `${fixture.label} skeleton`,
      timeoutMs
    )
    await waitForPausedRequest(
      fixture,
      () => pausedRequests.length > 0,
      timeoutMs
    )
    if (pausedRequests.length === 0) {
      fail(`${fixture.label} resource request was not paused.`)
    }

    isHoldingFixtureRequests = false
    for (const requestId of pausedRequests) {
      await client.send("Fetch.continueRequest", { requestId })
    }

    const loadedSnapshot = await waitForSnapshot(
      client,
      fixture,
      (snapshot) =>
        snapshot?.loadedRect &&
        (fixture.readySelector
          ? snapshot.readyRect
          : fixture.skeletonPersists || !snapshot.skeletonRect),
      `${fixture.label} loaded content`,
      timeoutMs
    )
    const mismatch = rectMismatch(
      skeletonSnapshot.skeletonRect,
      loadedSnapshot.loadedRect,
      tolerancePx
    )
    if (mismatch) {
      fail(
        [
          `${fixture.label} skeleton does not overlap loaded content.`,
          `Tolerance: ${tolerancePx}px`,
          `Skeleton: ${formatRect(skeletonSnapshot.skeletonRect)}`,
          `Loaded:   ${formatRect(loadedSnapshot.loadedRect)}`,
          `Mismatch: ${mismatch}`,
        ].join("\n")
      )
    }
    results.push(
      `${fixture.id}: ${formatRect(
        skeletonSnapshot.skeletonRect
      )} within ${tolerancePx}px`
    )
  }

  if (errors.length > 0) {
    fail(
      `Viewer skeleton verifier emitted browser errors:\n${errors.join("\n")}`
    )
  }

  console.log(`Viewer skeletons verified:\n${results.join("\n")}`)
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

async function assertDevServer(url) {
  try {
    const response = await fetch(url, { method: "HEAD" })
    if (!response.ok) {
      fail(`Dev server responded ${response.status} for ${url}`)
    }
  } catch {
    fail(
      `Dev server is not reachable at ${url}. Start it with "bun run dev" before running this verifier.`
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
      // try next candidate
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
    send(method, params = {}) {
      id += 1
      socket.send(JSON.stringify({ id, method, params }))
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
      })
    },
    on(method, handler) {
      const handlers = listeners.get(method) ?? []
      handlers.push(handler)
      listeners.set(method, handlers)
    },
    close() {
      socket.close()
    },
  }
}

async function waitForSnapshot(client, fixture, predicate, label, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    const result = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `window.__viewerSkeletonVerifier?.snapshot(${JSON.stringify({
        loadedSelector: fixture.loadedSelector,
        readySelector: fixture.readySelector,
        skeletonSelector: fixture.skeletonSelector,
      })}) ?? null`,
    })
    const snapshot = result.result?.value
    if (predicate(snapshot)) return snapshot
    await delay(100)
  }
  fail(`Timed out waiting for ${label}.`)
}

async function waitForPausedRequest(fixture, predicate, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (predicate()) return
    await delay(25)
  }
  fail(`Timed out waiting for ${fixture.label} resource request to pause.`)
}

function rectMismatch(actual, expected, tolerance) {
  for (const key of ["left", "top", "width", "height"]) {
    const delta = Math.abs(actual[key] - expected[key])
    if (delta > tolerance) {
      return `${key} differs by ${round(delta)}px`
    }
  }
  return null
}

function formatRect(rect) {
  return `left=${rect.left}, top=${rect.top}, width=${rect.width}, height=${rect.height}`
}

function round(value) {
  return Math.round(value * 100) / 100
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
