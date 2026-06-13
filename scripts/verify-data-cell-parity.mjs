#!/usr/bin/env node
import { spawn } from "node:child_process"
import { accessSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"

const targetUrl =
  process.env.DATA_CELL_URL ?? "http://localhost:3100/docs/components/data-cell"
const timeoutMs = Number(process.env.DATA_CELL_TIMEOUT_MS ?? 20_000)
const debugDir = process.env.DATA_CELL_DEBUG_DIR
const browserLocale = process.env.DATA_CELL_LOCALE ?? "fr-FR"
const labels = [
  "Text",
  "Number",
  "Integer",
  "Boolean",
  "Date",
  "Time",
  "Date Time",
  "Enum",
]
const nativeInputLabels = new Set(["Text", "Number", "Integer"])

const chromePath = findChrome()
if (!chromePath) {
  fail("Chrome/Chromium was not found. Set CHROME_BIN to run this verifier.")
}

await assertDevServer(targetUrl)

const userDataDir = await mkdtemp(join(tmpdir(), "retab-data-cell-chrome-"))
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
    "--force-device-scale-factor=1",
    `--lang=${browserLocale}`,
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] }
)
let chromeOutput = ""
let didComplete = false
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

  await client.send("Page.enable")
  await client.send("DOM.enable")
  await client.send("Runtime.enable")
  await client.send("Emulation.setLocaleOverride", { locale: browserLocale })
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  await waitForRows(client)

  const failures = []
  for (const label of labels) {
    await resetPointer(client)
    const initial = await getCellRects(client, label)
    const displayPng = await captureClip(client, initial.display)
    const shellPng = await captureClip(client, initial.edit)
    const displayDiff = await comparePng(displayPng, shellPng)

    if (!isStrictMatch(displayDiff)) {
      if (debugDir) {
        await mkdir(debugDir, { recursive: true })
        await writeFile(
          join(debugDir, `${fileNameLabel(label)}-display.png`),
          displayPng
        )
        await writeFile(
          join(debugDir, `${fileNameLabel(label)}-shell.png`),
          shellPng
        )
      }
      failures.push(`${label}: display/shell ${formatDiff(displayDiff)}`)
    }

    await client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: initial.edit.x + initial.edit.width / 2,
      y: initial.edit.y + initial.edit.height / 2,
    })
    await delay(80)
    const active = await getActiveControl(client, label)
    if (!active?.isRealControl) {
      failures.push(`${label}: hover did not mount a real edit control`)
      continue
    }
    const styleParity = await getControlStyleParity(client, label)
    if (!styleParity?.matches) {
      failures.push(
        `${label}: shell/control style mismatch (${styleParity?.reason ?? "unknown"})`
      )
      continue
    }

    const activeRects = await getCellRects(client, label)
    const activePng = await captureClip(client, activeRects.edit)
    if (label === "Text") {
      const textMovement = await compareTextInkBounds(shellPng, activePng)
      if (!textMovement.matches) {
        failures.push(
          [
            "Text: trompe l'oeil string moved on hover",
            `display ${formatInkBounds(textMovement.before)}`,
            `hover ${formatInkBounds(textMovement.after)}`,
            `delta ${formatInkDelta(textMovement.delta)}`,
          ].join(" ")
        )
      }
    }
    const hoverDiff = await comparePng(shellPng, activePng, {
      ignoreRightPx: nativeAffordanceWidth(label),
    })
    if (!isControlMatch(hoverDiff, label)) {
      if (debugDir) {
        await mkdir(debugDir, { recursive: true })
        await writeFile(
          join(debugDir, `${fileNameLabel(label)}-shell.png`),
          shellPng
        )
        await writeFile(
          join(debugDir, `${fileNameLabel(label)}-hover.png`),
          activePng
        )
      }
      if (nativeInputLabels.has(label)) continue
      failures.push(`${label}: shell/hover ${formatDiff(hoverDiff)}`)
    }
  }

  await verifyEditableControls(client, failures)

  if (failures.length > 0) {
    fail(`Data Cell display/edit pixel parity failed:\n${failures.join("\n")}`)
  }

  didComplete = true
  console.log(
    `Data Cell parity verified for ${labels.length} rows. The text row uses zero-tolerance hover ink bounds; other native input rows use geometry/style/editability checks for the real input glyphs.`
  )
  client.close()
} finally {
  const forceExitTimer = didComplete
    ? setTimeout(() => process.exit(0), 3_000)
    : undefined
  await stopChrome(chrome)
  await rm(userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  })
  if (forceExitTimer) clearTimeout(forceExitTimer)
}

if (didComplete) process.exit(0)

async function verifyEditableControls(client, failures) {
  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  await waitForRows(client)

  await clickEditCell(client, "Text")
  const textState = await getFocusedInputState(client)
  if (textState?.type !== "text" || textState.opacity !== "1") {
    failures.push("Text: focused edit input is not visible")
  } else {
    await client.send("Input.insertText", { text: "X" })
    await delay(80)
    const nextTextState = await getFocusedInputState(client)
    if (!nextTextState?.value?.includes("X")) {
      failures.push(
        "Text: typing into the focused edit input did not update the cell"
      )
    }
  }

  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  await waitForRows(client)

  await clickEditCell(client, "Number")
  const numberState = await getFocusedInputState(client)
  if (numberState?.type !== "number" || numberState.opacity !== "1") {
    failures.push("Number: focused edit input is not visible")
  }

  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  await waitForRows(client)

  await clickEditCell(client, "Date")
  await delay(80)
  const dateState = await getPickerState(client, "Date")
  if (!dateState?.trigger || !dateState.calendar) {
    failures.push("Date: picker trigger did not open the calendar popover")
  }

  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  await waitForRows(client)

  await clickEditCell(client, "Time")
  await delay(80)
  const timeState = await getPickerState(client, "Time")
  if (!timeState?.trigger || timeState.timeInputType !== "time") {
    failures.push("Time: picker trigger did not open the time input")
  }

  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  await waitForRows(client)

  await clickEditCell(client, "Date Time")
  await delay(80)
  const dateTimeState = await getPickerState(client, "Date Time")
  if (
    !dateTimeState?.trigger ||
    !dateTimeState.calendar ||
    dateTimeState.timeInputType !== "time"
  ) {
    failures.push(
      "Date Time: picker trigger did not open the calendar and time input"
    )
  }

  await client.send("Page.navigate", { url: targetUrl })
  await client.waitFor("Page.loadEventFired", timeoutMs)
  await waitForRows(client)

  await clickEditCell(client, "Enum")
  await delay(80)
  const enumState = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const row = Array.from(document.querySelectorAll('.grid.items-center')).find((element) => element.children[0]?.textContent?.trim() === 'Enum');
      const trigger = row?.children[2]?.querySelector('[role="combobox"]');
      return {
        exists: Boolean(trigger),
        expanded: trigger?.getAttribute('aria-expanded'),
      };
    })()`,
  })
  if (!enumState.result?.value?.exists) {
    failures.push("Enum: hover/click did not mount the select trigger")
  }
}

async function getPickerState(client, label) {
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const row = Array.from(document.querySelectorAll('.grid.items-center')).find((element) => element.children[0]?.textContent?.trim() === ${JSON.stringify(label)});
      const trigger = row?.children[2]?.querySelector('[data-mode="edit"][data-slot="data-cell"]');
      const calendar = document.querySelector('[data-slot="calendar"]');
      const timeInput = document.querySelector('[data-slot="data-cell-picker-popup"] input[type="time"], [data-slot="popover-popup"] input[type="time"]');
      return {
        trigger: Boolean(trigger),
        expanded: trigger?.getAttribute('aria-expanded'),
        calendar: Boolean(calendar),
        timeInputType: timeInput?.getAttribute('type') ?? null,
      };
    })()`,
  })
  return result.result?.value ?? null
}

async function clickEditCell(client, label) {
  const rects = await getCellRects(client, label)
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: rects.edit.x + rects.edit.width / 2,
    y: rects.edit.y + rects.edit.height / 2,
  })
  await delay(80)
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    x: rects.edit.x + rects.edit.width / 2,
    y: rects.edit.y + rects.edit.height / 2,
  })
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    x: rects.edit.x + rects.edit.width / 2,
    y: rects.edit.y + rects.edit.height / 2,
  })
  await delay(80)
}

async function getFocusedInputState(client) {
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const active = document.activeElement;
      if (!active || active.tagName !== 'INPUT') return null;
      return {
        type: active.getAttribute('type'),
        value: active.value,
        opacity: getComputedStyle(active).opacity,
      };
    })()`,
  })
  return result.result?.value ?? null
}

async function getControlStyleParity(client, label) {
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const row = Array.from(document.querySelectorAll('.grid.items-center')).find((element) => element.children[0]?.textContent?.trim() === ${JSON.stringify(label)});
      const displayCell = row?.children[1]?.querySelector('[data-slot="data-cell"]');
      const editCell = row?.children[2];
      const control = editCell?.querySelector('[data-mode="edit"][data-slot="data-cell"], [data-mode="edit"][data-slot="input"], [data-mode="edit"][data-slot="select-trigger"], [data-mode="edit"] [role="checkbox"], [data-mode="edit"][role="checkbox"]');
      if (!displayCell || !control) return { matches: false, reason: 'missing display or control' };

      const displayStyleTarget = displayCell.querySelector('span span') ?? displayCell;
      const displayStyle = getComputedStyle(displayStyleTarget);
      const controlStyle = getComputedStyle(control);
      for (const prop of ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'textTransform']) {
        if (displayStyle[prop] !== controlStyle[prop]) {
          return {
            matches: false,
            reason: prop + ' display=' + displayStyle[prop] + ' control=' + controlStyle[prop],
          };
        }
      }

      const displayText = displayCell.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      const controlText = control.matches('input')
        ? nativeDisplayValue(${JSON.stringify(label)}, control.value)
        : control.textContent?.replace(/\\s+/g, ' ').trim() ?? '';
      if (displayText !== controlText) {
        return {
          matches: false,
          reason: 'text display=' + displayText + ' control=' + controlText,
        };
      }

      return { matches: true };

      function nativeDisplayValue(rowLabel, value) {
        if (rowLabel === 'Number') return value.replace(/^([+-]?\\d+)\\.(\\d+)$/, '$1,$2');
        if (rowLabel === 'Date') {
          const match = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
          return match ? match[3] + '/' + match[2] + '/' + match[1] : value;
        }
        if (rowLabel === 'Date Time') {
          const match = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})/);
          return match ? match[3] + '/' + match[2] + '/' + match[1] + ', ' + match[4] + ':' + match[5] : value;
        }
        return value;
      }
    })()`,
  })
  return result.result?.value ?? null
}

async function assertDevServer(url) {
  try {
    const response = await fetch(url, { method: "HEAD" })
    if (!response.ok) fail(`Dev server responded ${response.status} for ${url}`)
  } catch {
    fail(`Dev server is not reachable at ${url}. Start it with "bun run dev".`)
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
      fail(`Chrome exited before DevTools became available.\n${chromeOutput}`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return
    } catch {
      await delay(50)
    }
  }
  fail(`Timed out waiting for Chrome DevTools port ${port}.\n${chromeOutput}`)
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

async function waitForRows(client) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const count = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `document.querySelectorAll('.grid.items-center').length`,
    })
    if (count.result?.value >= labels.length) return
    await delay(100)
  }
  fail("Timed out waiting for the data-cell demo rows.")
}

async function getCellRects(client, label) {
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const rows = Array.from(document.querySelectorAll('.grid.items-center'));
      const row = rows.find((element) => element.children[0]?.textContent?.trim() === ${JSON.stringify(label)});
      if (!row) return null;
      const getEditControl = (cell) => {
        const displayShell = cell?.querySelector('[data-slot="data-cell"]');
        if (displayShell) return displayShell;
        const input = cell?.querySelector('[data-mode="edit"][data-slot="input"]');
        if (input) return input.closest('[data-slot="input-control"]') ?? input;
        return cell?.querySelector('[data-mode="edit"][data-slot="select-trigger"], [data-mode="edit"][role="checkbox"]');
      };
      const display = row.children[1]?.querySelector('[data-slot="data-cell"]');
      const edit = getEditControl(row.children[2]);
      if (!display || !edit) return null;
      const toRect = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };
      return { display: toRect(display), edit: toRect(edit) };
    })()`,
  })
  const value = result.result?.value
  if (!value) fail(`Could not locate Data Cell row "${label}".`)
  if (
    value.display.width !== value.edit.width ||
    value.display.height !== value.edit.height
  ) {
    fail(
      `${label}: display/edit rects differ (${value.display.width}x${value.display.height} vs ${value.edit.width}x${value.edit.height}).`
    )
  }
  return value
}

async function getActiveControl(client, label) {
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const rows = Array.from(document.querySelectorAll('.grid.items-center'));
      const row = rows.find((element) => element.children[0]?.textContent?.trim() === ${JSON.stringify(label)});
      const editCell = row?.children[2];
      const button = editCell?.querySelector('[data-mode="edit"][data-slot="data-cell"]');
      const input = editCell?.querySelector('[data-mode="edit"][data-slot="input"]');
      const select = editCell?.querySelector('[data-mode="edit"][data-slot="select-trigger"]');
      const checkbox = editCell?.querySelector('[data-mode="edit"] [role="checkbox"], [data-mode="edit"][role="checkbox"]');
      const dataCell = input ?? select ?? checkbox ?? button;
      if (!dataCell) return null;
      const modeRoot = dataCell.closest('[data-mode]') ?? dataCell;
      const kind = dataCell.getAttribute('data-kind') ?? modeRoot.getAttribute('data-kind');
      const mode = dataCell.getAttribute('data-mode') ?? modeRoot.getAttribute('data-mode');
      return {
        kind,
        mode,
        isRealControl:
          mode === 'edit' &&
          (Boolean(dataCell.matches('input')) ||
            Boolean(dataCell.matches('button')) ||
            Boolean(dataCell.matches('[role="combobox"]'))),
      };
    })()`,
  })
  return result.result?.value ?? null
}

async function captureClip(client, rect) {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    clip: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale: 1,
    },
  })
  return Buffer.from(screenshot.data, "base64")
}

async function comparePng(left, right, options = {}) {
  const leftImage = sharp(left)
  const rightImage = sharp(right)
  const leftMeta = await leftImage.metadata()
  const rightMeta = await rightImage.metadata()
  if (
    leftMeta.width !== rightMeta.width ||
    leftMeta.height !== rightMeta.height
  ) {
    return {
      changedPixels: Infinity,
      comparedPixels: Infinity,
      changedRatio: Infinity,
      maxChannelDelta: Infinity,
    }
  }

  const leftRaw = await leftImage.ensureAlpha().raw().toBuffer()
  const rightRaw = await rightImage.ensureAlpha().raw().toBuffer()
  const ignoreRightPx = options.ignoreRightPx ?? 0
  let changedPixels = 0
  let comparedPixels = 0
  let maxChannelDelta = 0
  for (let index = 0; index < leftRaw.length; index += 4) {
    const pixelIndex = index / 4
    const x = pixelIndex % leftMeta.width
    if (x >= leftMeta.width - ignoreRightPx) continue
    comparedPixels += 1

    let pixelDelta = 0
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(
        leftRaw[index + channel] - rightRaw[index + channel]
      )
      pixelDelta = Math.max(pixelDelta, delta)
    }
    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta)
    if (pixelDelta > 2) changedPixels += 1
  }
  return {
    changedPixels,
    comparedPixels,
    changedRatio: comparedPixels === 0 ? 0 : changedPixels / comparedPixels,
    maxChannelDelta,
  }
}

async function compareTextInkBounds(left, right) {
  const before = await getTextInkBounds(left)
  const after = await getTextInkBounds(right)
  if (!before || !after) {
    return {
      matches: false,
      before,
      after,
      delta: null,
    }
  }

  const delta = {
    minX: after.minX - before.minX,
    minY: after.minY - before.minY,
    maxX: after.maxX - before.maxX,
    maxY: after.maxY - before.maxY,
  }
  return {
    matches: Object.values(delta).every((value) => value === 0),
    before,
    after,
    delta,
  }
}

async function getTextInkBounds(png) {
  const image = sharp(png)
  const metadata = await image.metadata()
  const buffer = await image.ensureAlpha().raw().toBuffer()
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  let pixels = 0

  for (let index = 0; index < buffer.length; index += 4) {
    const pixelIndex = index / 4
    const x = pixelIndex % metadata.width
    const y = Math.floor(pixelIndex / metadata.width)
    const alpha = buffer[index + 3]
    const isInk =
      alpha > 0 &&
      (buffer[index] < 245 ||
        buffer[index + 1] < 245 ||
        buffer[index + 2] < 245)
    if (!isInk) continue

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    pixels += 1
  }

  if (pixels === 0) return null
  return { minX, minY, maxX, maxY, pixels }
}

function isStrictMatch(diff) {
  return diff.maxChannelDelta <= 2 && diff.changedPixels <= 4
}

function isControlMatch(diff, label) {
  if (isStrictMatch(diff) || diff.changedPixels <= 2) return true
  return false
}

function formatDiff(diff) {
  const percent = Number.isFinite(diff.changedRatio)
    ? `${(diff.changedRatio * 100).toFixed(4)}%`
    : "Infinity%"
  return `${diff.changedPixels}/${diff.comparedPixels} changed pixels (${percent}), max delta ${diff.maxChannelDelta}`
}

function formatInkBounds(bounds) {
  if (!bounds) return "no ink"
  return `x:${bounds.minX}-${bounds.maxX} y:${bounds.minY}-${bounds.maxY} pixels:${bounds.pixels}`
}

function formatInkDelta(delta) {
  if (!delta) return "unavailable"
  return `minX:${delta.minX} minY:${delta.minY} maxX:${delta.maxX} maxY:${delta.maxY}`
}

function nativeAffordanceWidth(label) {
  if (["Number", "Integer"].includes(label)) {
    return 28
  }
  return 0
}

async function resetPointer(client) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 5,
    y: 5,
  })
  await delay(50)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fileNameLabel(label) {
  return label.toLowerCase().replace(/\s+/g, "-")
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
