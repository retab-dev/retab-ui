#!/usr/bin/env node
import { spawn } from "node:child_process"
import { accessSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

const targetUrl =
  process.env.XLSX_VIEWER_URL ??
  "http://localhost:3100/docs/components/file-viewer/renderers/xlsx"
const timeoutMs = Number(process.env.XLSX_VIEWER_TIMEOUT_MS ?? 20_000)

const chromePath = findChrome()
if (!chromePath) {
  fail(
    "Chrome/Chromium was not found. Set CHROME_BIN to run XLSX viewer browser verification."
  )
}

await assertDevServer(targetUrl)

const userDataDir = await mkdtemp(join(tmpdir(), "retab-xlsx-chrome-"))
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
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error") errors.push(params.entry.text)
  })

  await client.send("Runtime.enable")
  await client.send("Log.enable")
  await client.send("Page.enable")
  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)

  const metadata = await waitForGridMetadata(client, timeoutMs)
  if (errors.length > 0) {
    fail(`XLSX viewer emitted browser errors:\n${errors.join("\n")}`)
  }

  console.log(
    `XLSX viewer verified: ${metadata.label}, ${metadata.rows} rows x ${metadata.columns} columns, ${metadata.renderedCells} rendered cells.`
  )
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
    close() {
      socket.close()
    },
  }
}

async function waitForGridMetadata(client, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    const result = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const viewer = document.querySelector('[data-slot="xlsx-viewer"]');
        const shadowRoot = viewer
          ? Array.from(viewer.querySelectorAll('*')).find((el) => el.shadowRoot)?.shadowRoot
          : null;
        const grid = shadowRoot?.querySelector('[role="grid"]');
        const selectedWorkbookTab = viewer?.querySelector('[data-slot="xlsx-viewer-tabs"] [role="tab"][aria-selected="true"]');
        if (!grid || !selectedWorkbookTab) return null;
        return {
          label: grid.getAttribute('aria-label'),
          rows: grid.getAttribute('aria-rowcount'),
          columns: grid.getAttribute('aria-colcount'),
          renderedRows: grid.querySelectorAll('[role="row"]').length,
          renderedCells: grid.querySelectorAll('[role="gridcell"]').length,
          selectedTab: selectedWorkbookTab.textContent?.trim() || null,
        };
      })()`,
    })
    const metadata = result.result?.value
    if (
      metadata?.label &&
      Number(metadata.rows) > 0 &&
      Number(metadata.columns) > 0 &&
      metadata.renderedCells > 0
    ) {
      return metadata
    }
    await delay(100)
  }
  fail("Timed out waiting for the XLSX demo grid inside the shadow root.")
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
