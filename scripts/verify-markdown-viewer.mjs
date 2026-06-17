#!/usr/bin/env node
import { spawn } from "node:child_process"
import { accessSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

const baseUrl =
  process.env.MARKDOWN_VIEWER_URL ??
  "http://localhost:3100/view/markdown-viewer"
const timeoutMs = Number(
  process.env.MARKDOWN_VIEWER_TIMEOUT_MS ?? 30_000
)

const chromePath = findChrome()
if (!chromePath) {
  fail(
    "Chrome/Chromium was not found. Set CHROME_BIN to run Markdown viewer browser verification."
  )
}

await assertDevServer(baseUrl)

const userDataDir = await mkdtemp(join(tmpdir(), "retab-pretext-md-chrome-"))
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

  const results = []
  results.push(
    await runScenario(client, {
      colorScheme: "light",
      hash: "diagrams",
      label: "desktop diagrams",
      predicate: (snapshot) =>
        snapshot.hasViewerCanvas &&
        snapshot.chunkCount > 0 &&
        snapshot.chunkCount <= 8 &&
        snapshot.diagrams.length >= 3 &&
        snapshot.diagrams.every((diagram) => diagram.state === "ready") &&
        snapshot.diagrams.every((diagram) => diagram.hasSvg) &&
        !snapshot.hasDiagramError &&
        !snapshot.hasDocumentOverflow &&
        !snapshot.pageChrome,
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runScenario(client, {
      colorScheme: "light",
      hash: "release-readiness-matrix",
      label: "mobile table overflow",
      predicate: (snapshot) =>
        snapshot.chunkCount > 0 &&
        snapshot.chunkCount <= 8 &&
        snapshot.tableRegions.length > 0 &&
        snapshot.tableRegions.every((region) => region.isScrollable) &&
        !snapshot.hasDocumentOverflow &&
        !snapshot.pageChrome,
      viewport: { height: 760, mobile: true, width: 390 },
    })
  )
  results.push(
    await runScenario(client, {
      colorScheme: "light",
      hash: "code-blocks",
      label: "code block rendering",
      predicate: (snapshot) =>
        snapshot.chunkCount > 0 &&
        snapshot.chunkCount <= 8 &&
        snapshot.codeBlocks.length >= 4 &&
        snapshot.codeBlocks.some(
          (block) =>
            block.language === "ts" &&
            block.hasTitle &&
            block.hasCaption &&
            block.hasCopyButton &&
            block.lineCount >= 10 &&
            block.tokenCount > 0
        ) &&
        snapshot.codeBlocks.some(
          (block) => block.language === "diff" && block.diffLineCount >= 2
        ) &&
        !snapshot.hasDocumentOverflow &&
        !snapshot.pageChrome,
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runScenario(client, {
      colorScheme: "light",
      hash: "hostile-blocks",
      label: "hostile block previews",
      predicate: (snapshot) =>
        snapshot.chunkCount > 0 &&
        snapshot.chunkCount <= 8 &&
        snapshot.hostileBlocks.length >= 2 &&
        snapshot.hostileBlocks.every(
          (block) => block.mountedLines > 0 && block.mountedLines < 120
        ) &&
        snapshot.hostileBlocks.some((block) => block.lineCount >= 450) &&
        snapshot.hostileBlocks.some((block) => block.lineCount >= 250) &&
        snapshot.hostileBlocks.every((block) => block.hasCopyButton) &&
        !snapshot.hasDocumentOverflow &&
        !snapshot.pageChrome,
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runSourceModeScenario(client, {
      colorScheme: "light",
      hash: "code-blocks",
      label: "source mode virtualized anchor",
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runScenario(client, {
      colorScheme: "dark",
      hash: "diagrams",
      label: "dark diagrams",
      predicate: (snapshot) =>
        snapshot.isDark &&
        snapshot.contrastRatio >= 3 &&
        snapshot.diagrams.length >= 3 &&
        snapshot.diagrams.every((diagram) => diagram.state === "ready") &&
        !snapshot.hasDocumentOverflow,
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runScenario(client, {
      colorScheme: "light",
      hash: "user-content-fn-overview",
      label: "footnote direct hash",
      predicate: (snapshot) =>
        snapshot.footnoteSection &&
        snapshot.footnoteBackrefs > 0 &&
        snapshot.viewportScrollTop > 0 &&
        !snapshot.hasDocumentOverflow,
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runFootnoteBackrefScenario(client, {
      colorScheme: "light",
      hash: "user-content-fn-overview",
      label: "footnote backref navigation",
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runLongScrollScenario(client, {
      colorScheme: "light",
      hash: "overview",
      label: "long scroll bounded virtualization",
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runNativeFindScenario(client, {
      colorScheme: "light",
      hash: "overview",
      label: "native find offscreen bridge",
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )
  results.push(
    await runScenario(client, {
      colorScheme: "light",
      hash: "media",
      label: "media load",
      predicate: (snapshot) =>
        snapshot.images.length >= 2 &&
        snapshot.images.every((image) => image.state === "ready") &&
        snapshot.images.every((image) => image.naturalWidth > 0) &&
        !snapshot.hasDocumentOverflow,
      viewport: { height: 720, mobile: false, width: 1280 },
    })
  )

  if (errors.length > 0) {
    fail(
      `Markdown viewer emitted browser errors:\n${errors.join("\n")}`
    )
  }

  console.log(`Markdown viewer verified:\n${results.join("\n")}`)
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

async function runScenario(
  client,
  { colorScheme, hash, label, predicate, viewport }
) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: viewport.height,
    mobile: viewport.mobile,
    width: viewport.width,
  })
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: colorScheme }],
  })
  const url = scenarioUrl(hash)
  await client.send("Page.navigate", { url })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  if (colorScheme === "dark") {
    await client.send("Runtime.evaluate", {
      expression: `(() => {
        try { localStorage.theme = "dark" } catch {}
        document.documentElement.classList.add("dark")
        document.documentElement.style.colorScheme = "dark"
      })()`,
    })
  }
  const snapshot = await waitForSnapshot(client, predicate, label, timeoutMs)
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
  })
  if (!screenshot.data || screenshot.data.length < 12_000) {
    fail(`${label} screenshot was unexpectedly small.`)
  }
  return `${label}: ${snapshot.chunkCount} chunks, ${screenshot.data.length} screenshot bytes`
}

async function runLongScrollScenario(
  client,
  { colorScheme, hash, label, viewport }
) {
  await prepareScenario(client, { colorScheme, hash, viewport })
  await waitForSnapshot(
    client,
    (snapshot) =>
      snapshot.chunkCount > 0 &&
      snapshot.chunkCount <= 8 &&
      snapshot.scrollHeight > snapshot.viewportHeight * 2 &&
      snapshot.viewportScrollTop > 0 &&
      !snapshot.hasDocumentOverflow &&
      !snapshot.pageChrome,
    label,
    timeoutMs
  )
  await client.send("Runtime.evaluate", {
    expression: `new Promise((resolve) => {
      const viewport = document.querySelector('[data-slot="markdown-virtual-canvas"]')?.closest('[data-slot="scroll-area-viewport"]')
      if (!viewport) {
        resolve(false)
        return
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          viewport.scrollTop = viewport.scrollHeight
          viewport.dispatchEvent(new Event("scroll", { bubbles: true }))
          resolve(true)
        })
      })
    })`,
    awaitPromise: true,
    returnByValue: true,
  })
  const snapshot = await waitForSnapshot(
    client,
    (snapshot) =>
      snapshot.viewportScrollTop > snapshot.viewportHeight &&
      snapshot.chunkCount > 0 &&
      snapshot.chunkCount <= 8 &&
      !snapshot.hasDocumentOverflow &&
      !snapshot.pageChrome,
    label,
    timeoutMs
  )
  return `${label}: scrollTop ${snapshot.viewportScrollTop}, ${snapshot.chunkCount} chunks`
}

async function runFootnoteBackrefScenario(
  client,
  { colorScheme, hash, label, viewport }
) {
  await prepareScenario(client, { colorScheme, hash, viewport })
  await waitForSnapshot(
    client,
    (snapshot) =>
      snapshot.footnoteSection &&
      snapshot.footnoteBackrefs > 0 &&
      snapshot.firstFootnoteBackrefHref &&
      snapshot.viewportScrollTop > 0 &&
      !snapshot.hasDocumentOverflow,
    label,
    timeoutMs
  )
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const backref = document.querySelector('[data-footnote-backref]')
      if (!(backref instanceof HTMLElement)) return false
      backref.click()
      return true
    })()`,
    returnByValue: true,
  })
  const snapshot = await waitForSnapshot(
    client,
    (snapshot) =>
      /^#(?:user-content-)?fnref-/i.test(snapshot.locationHash) &&
      snapshot.viewportScrollTop < snapshot.scrollHeight &&
      !snapshot.hasDocumentOverflow,
    label,
    timeoutMs
  )
  return `${label}: ${snapshot.locationHash}, scrollTop ${snapshot.viewportScrollTop}`
}

async function runNativeFindScenario(
  client,
  { colorScheme, hash, label, viewport }
) {
  await prepareScenario(client, { colorScheme, hash, viewport })
  await waitForSnapshot(
    client,
    (snapshot) =>
      snapshot.hasViewerCanvas &&
      snapshot.nativeFindEntries > 5 &&
      snapshot.chunkCount > 0 &&
      snapshot.chunkCount <= 8 &&
      !snapshot.hasDocumentOverflow,
    label,
    timeoutMs
  )
  await client.send("Runtime.evaluate", {
    expression: `(() => {
      const entries = Array.from(document.querySelectorAll('[data-native-find-chunk-id]'))
      const entry = entries.find((element) => element.textContent?.includes('Long Report Section 30'))
      if (!entry) return false
      entry.dispatchEvent(new Event("beforematch"))
      return true
    })()`,
    returnByValue: true,
  })
  const snapshot = await waitForSnapshot(
    client,
    (snapshot) =>
      snapshot.viewportScrollTop > snapshot.viewportHeight * 8 &&
      snapshot.chunkCount > 0 &&
      snapshot.chunkCount <= 8 &&
      !snapshot.hasDocumentOverflow &&
      !snapshot.pageChrome,
    label,
    timeoutMs
  )
  return `${label}: ${snapshot.nativeFindEntries} entries, scrollTop ${snapshot.viewportScrollTop}`
}

async function runSourceModeScenario(
  client,
  { colorScheme, hash, label, viewport }
) {
  await prepareScenario(client, { colorScheme, hash, viewport })
  await waitForSnapshot(
    client,
    (snapshot) =>
      snapshot.hasViewerCanvas &&
      snapshot.chunkCount > 0 &&
      snapshot.chunkCount <= 8 &&
      !snapshot.hasDocumentOverflow &&
      !snapshot.pageChrome,
    label,
    timeoutMs
  )
  await client.send("Runtime.evaluate", {
    expression: `new Promise((resolve) => {
      const viewport = document.querySelector('[data-slot="markdown-virtual-canvas"]')?.closest('[data-slot="scroll-area-viewport"]')
      if (!viewport) {
        resolve(false)
        return
      }
      requestAnimationFrame(() => {
        viewport.scrollTop = Math.max(900, Math.floor(viewport.scrollHeight * 0.18))
        viewport.dispatchEvent(new Event("scroll", { bubbles: true }))
        requestAnimationFrame(() => {
          const textButton = Array.from(document.querySelectorAll('[aria-label="Markdown view mode"] button')).find((button) => button.textContent?.trim() === "Text")
          if (!(textButton instanceof HTMLElement)) {
            resolve(false)
            return
          }
          textButton.click()
          resolve(true)
        })
      })
    })`,
    awaitPromise: true,
    returnByValue: true,
  })
  const snapshot = await waitForSnapshot(
    client,
    (snapshot) =>
      snapshot.sourceMode &&
      snapshot.sourceScrollHeight > snapshot.viewportHeight * 2 &&
      snapshot.sourceMountedLines > 0 &&
      snapshot.sourceMountedLines < snapshot.sourceLineCount &&
      snapshot.viewportScrollTop > 0 &&
      !snapshot.hasDocumentOverflow &&
      !snapshot.pageChrome,
    label,
    timeoutMs
  )
  return `${label}: ${snapshot.sourceMountedLines}/${snapshot.sourceLineCount} source lines, scrollTop ${snapshot.viewportScrollTop}`
}

async function prepareScenario(client, { colorScheme, hash, viewport }) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: viewport.height,
    mobile: viewport.mobile,
    width: viewport.width,
  })
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: colorScheme }],
  })
  await client.send("Page.navigate", { url: scenarioUrl(hash) })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  if (colorScheme === "dark") {
    await client.send("Runtime.evaluate", {
      expression: `(() => {
        try { localStorage.theme = "dark" } catch {}
        document.documentElement.classList.add("dark")
        document.documentElement.style.colorScheme = "dark"
      })()`,
    })
  }
}

function scenarioUrl(hash) {
  const url = new URL(baseUrl)
  url.searchParams.set("verify", `${Date.now()}-${Math.random()}`)
  url.hash = hash
  return url.toString()
}

async function waitForSnapshot(client, predicate, label, ms) {
  const start = Date.now()
  let lastSnapshot = null
  while (Date.now() - start < ms) {
    const result = await client.send("Runtime.evaluate", {
      expression: `(${snapshotExpression})()`,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      fail(
        `${label} snapshot failed: ${
          result.exceptionDetails.text ??
          result.exceptionDetails.exception?.description ??
          "runtime exception"
        }`
      )
    }
    lastSnapshot = result.result?.value
    if (lastSnapshot && predicate(lastSnapshot)) return lastSnapshot
    await delay(150)
  }
  fail(
    `${label} did not reach the expected state.\nLast snapshot:\n${JSON.stringify(
      lastSnapshot,
      null,
      2
    )}`
  )
}

function snapshotExpression() {
  // The scroll viewport is the same element in rendered and source mode, but
  // only one canvas is mounted at a time, so resolve it from whichever exists.
  const viewport = document
    .querySelector(
      '[data-slot="markdown-virtual-canvas"], [data-slot="markdown-source-scroll-canvas"]'
    )
    ?.closest('[data-slot="scroll-area-viewport"]')
  const diagrams = Array.from(
    document.querySelectorAll('[data-diagram-language="mermaid"]')
  ).map((element) => {
    const rect = element.getBoundingClientRect()
    return {
      hasSvg: Boolean(element.querySelector("svg")),
      height: Math.round(rect.height),
      state: element.getAttribute("data-diagram-state"),
      width: Math.round(rect.width),
    }
  })
  const tableRegions = Array.from(
    document.querySelectorAll("[data-markdown-table-scroll]")
  ).map((element) => ({
    clientWidth: element.clientWidth,
    isScrollable: element.scrollWidth > element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  const images = Array.from(
    document.querySelectorAll("[data-pretext-image-state]")
  ).map((figure) => {
    const image = figure.querySelector("img")
    return {
      naturalWidth: image?.naturalWidth ?? 0,
      state: figure.getAttribute("data-pretext-image-state"),
    }
  })
  const codeBlocks = Array.from(
    document.querySelectorAll("[data-pretext-code-language]")
  ).map((figure) => ({
    diffLineCount: figure.querySelectorAll("[data-pretext-code-diff-line]")
      .length,
    hasCaption: Boolean(figure.querySelector("[data-pretext-code-caption]")),
    hasCopyButton: Boolean(
      Array.from(figure.querySelectorAll("button")).some((button) =>
        /copy/i.test(button.getAttribute("aria-label") ?? "")
      )
    ),
    hasTitle: Boolean(figure.querySelector("[data-pretext-code-title]")),
    language: figure.getAttribute("data-pretext-code-language"),
    lineCount: figure.querySelectorAll("[data-line]").length,
    tokenCount: figure.querySelectorAll("[data-pretext-code-token]").length,
  }))
  const hostileBlocks = Array.from(
    document.querySelectorAll("[data-markdown-hostile-fallback]")
  ).map((section) => ({
    hasCopyButton: Boolean(
      Array.from(section.querySelectorAll("button")).some((button) =>
        /copy/i.test(
          button.getAttribute("aria-label") ?? button.textContent ?? ""
        )
      )
    ),
    lineCount: Number(
      section.getAttribute("data-markdown-hostile-line-count") ?? 0
    ),
    mountedLines: Number(
      section.getAttribute("data-markdown-hostile-mounted-lines") ?? 0
    ),
    omittedLines: Number(
      section.getAttribute("data-markdown-hostile-omitted-lines") ?? 0
    ),
  }))
  const sourceScrollCanvas = document.querySelector(
    '[data-slot="markdown-source-scroll-canvas"]'
  )
  const sourceCanvas = document.querySelector(
    '[data-slot="markdown-source-canvas"]'
  )
  const sourceLines = document.querySelectorAll("[data-source-line]")
  const foreground = getComputedStyle(document.body).color
  const background = effectiveBackgroundColor(viewport ?? document.body)
  return {
    background,
    chunkCount: document.querySelectorAll(
      '[data-slot="markdown-greenfield-content"]'
    ).length,
    contrastRatio: contrastRatio(foreground, background),
    codeBlocks,
    documentTitle: document.title,
    diagrams,
    firstFootnoteBackrefHref:
      document.querySelector("[data-footnote-backref]")?.getAttribute("href") ??
      null,
    footnoteBackrefs: document.querySelectorAll("[data-footnote-backref]")
      .length,
    footnoteSection: Boolean(document.querySelector("[data-footnotes]")),
    foreground,
    hasDiagramError: Boolean(
      document.querySelector("[data-pretext-diagram-error]")
    ),
    hasDocumentOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 2,
    hasViewerCanvas: Boolean(
      document.querySelector('[data-slot="markdown-virtual-canvas"]')
    ),
    hostileBlocks,
    images,
    isDark:
      document.documentElement.classList.contains("dark") ||
      matchMedia("(prefers-color-scheme: dark)").matches,
    locationHash: window.location.hash,
    nativeFindEntries: document.querySelectorAll("[data-native-find-chunk-id]")
      .length,
    pageChrome:
      document.body.textContent?.match(
        /Page\\s+\\d+\\s+of\\s+\\d+|Page\\s+\\d+/i
      )?.[0] ?? null,
    scrollHeight: viewport ? Math.round(viewport.scrollHeight) : 0,
    sourceLineCount: sourceScrollCanvas
      ? Math.round(sourceScrollCanvas.scrollHeight / 22)
      : 0,
    sourceMode: Boolean(sourceScrollCanvas && sourceCanvas),
    sourceMountedLines: sourceLines.length,
    sourceScrollHeight: sourceScrollCanvas
      ? Math.round(sourceScrollCanvas.getBoundingClientRect().height)
      : 0,
    tableRegions,
    title: document.querySelector("h1")?.textContent?.trim() ?? null,
    viewportHeight: viewport ? Math.round(viewport.clientHeight) : 0,
    viewportScrollTop: viewport ? Math.round(viewport.scrollTop) : 0,
  }

  function contrastRatio(a, b) {
    const left = luminanceFromColor(a)
    const right = luminanceFromColor(b)
    const lighter = Math.max(left, right)
    const darker = Math.min(left, right)
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100
  }

  function luminanceFromColor(value) {
    const lab = value.match(/lab\(\s*([\d.]+)/)
    if (lab) {
      const lightness = Math.max(0, Math.min(100, Number(lab[1])))
      return lightness <= 8 ? lightness / 903.3 : ((lightness + 16) / 116) ** 3
    }
    return luminance(rgb(value))
  }

  function luminance([red, green, blue]) {
    return [red, green, blue]
      .map((value) => {
        const channel = value / 255
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4
      })
      .reduce(
        (sum, channel, index) =>
          sum + channel * [0.2126, 0.7152, 0.0722][index],
        0
      )
  }

  function rgb(value) {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    return match
      ? [Number(match[1]), Number(match[2]), Number(match[3])]
      : [255, 255, 255]
  }

  function effectiveBackgroundColor(element) {
    let current = element
    while (current) {
      const color = getComputedStyle(current).backgroundColor
      if (!isTransparent(color)) return color
      current = current.parentElement
    }
    return document.documentElement.classList.contains("dark")
      ? "rgb(0, 0, 0)"
      : "rgb(255, 255, 255)"
  }

  function isTransparent(value) {
    return (
      value === "transparent" ||
      value === "rgba(0, 0, 0, 0)" ||
      /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(value)
    )
  }
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
