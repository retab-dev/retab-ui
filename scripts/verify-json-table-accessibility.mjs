import { spawn } from "node:child_process"
import { chromium } from "@playwright/test"

const requestedProfileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/json-table-profile"
const serverMode = process.env.PROFILE_SERVER_MODE ?? "auto"
const reachabilityTimeoutMs = Number(
  process.env.PROFILE_REACHABILITY_TIMEOUT_MS ?? 5_000
)
const devServerTimeoutMs = Number(
  process.env.PROFILE_DEV_SERVER_TIMEOUT_MS ?? 60_000
)
const expectedProfileText = process.env.PROFILE_EXPECTED_TEXT ?? "JSON table"

const enumFieldPath = "transactions.0.transaction_type"
const dateFieldPath = "transactions.0.date"
const farTextFieldPath = "transactions.0.profile_far_note"
const farEnumFieldPath = "transactions.0.profile_far_status"
const farDateFieldPath = "transactions.0.profile_far_date"
const farStructuredObjectFieldPath = "transactions.0.profile_far_details"
const alignmentTolerancePx = 2

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm"
}

function profilePort(profileUrl) {
  const parsed = new URL(profileUrl)
  if (parsed.port) return Number(parsed.port)
  return parsed.protocol === "https:" ? 443 : 80
}

function profileUrlForPort(profileUrl, port) {
  const parsed = new URL(profileUrl)
  parsed.hostname = "localhost"
  parsed.port = String(port)
  return parsed.toString()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function collectCommandOutput(command, args, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs)
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.once("error", () => {
      clearTimeout(timeout)
      resolve({ code: 1, stdout })
    })
    child.once("exit", (code) => {
      clearTimeout(timeout)
      resolve({ code, stdout })
    })
  })
}

async function listeningProcessSummaryForPort(port) {
  const result = await collectCommandOutput("lsof", [
    "-nP",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-Fpnc",
  ])
  if (result.code !== 0 || !result.stdout.trim()) return ""

  const listeners = []
  let current = {}
  for (const line of result.stdout.trim().split("\n")) {
    const field = line.slice(0, 1)
    const value = line.slice(1)
    if (field === "p") {
      if (current.pid) listeners.push(current)
      current = { pid: value }
    } else if (field === "c") {
      current.command = value
    } else if (field === "n") {
      current.name = value
    }
  }
  if (current.pid) listeners.push(current)

  return listeners
    .map((listener) =>
      [
        `pid=${listener.pid}`,
        listener.command ? `command=${listener.command}` : null,
        listener.name ? `name=${listener.name}` : null,
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join("; ")
}

async function isPortAvailable(port) {
  return !(await listeningProcessSummaryForPort(port))
}

async function findAvailablePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 100; port += 1) {
    if (await isPortAvailable(port)) return port
  }
  throw new Error(
    `Could not find an available profile dev-server port starting at ${preferredPort}`
  )
}

async function checkProfilePage(profileUrl) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), reachabilityTimeoutMs)
  try {
    const response = await fetch(profileUrl, { signal: controller.signal })
    const body = await response.text()
    return {
      ok: response.ok && body.includes(expectedProfileText),
      detail: response.ok
        ? `response did not contain ${JSON.stringify(expectedProfileText)}`
        : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function startManagedDevServer(profileUrl) {
  const port = profilePort(profileUrl)
  const logs = []
  const child = spawn(
    pnpmCommand(),
    ["exec", "next", "dev", "--port", String(port)],
    {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    }
  )

  function recordLog(chunk, stream) {
    const text = chunk.toString()
    logs.push(text)
    if (logs.length > 120) logs.splice(0, logs.length - 120)
    stream.write(text)
  }

  child.stdout.on("data", (chunk) => recordLog(chunk, process.stdout))
  child.stderr.on("data", (chunk) => recordLog(chunk, process.stderr))

  return {
    child,
    logs,
    stop() {
      if (child.exitCode !== null || child.signalCode !== null) return
      child.kill("SIGTERM")
    },
  }
}

async function waitForProfilePage(profileUrl, devServer) {
  const startedAt = Date.now()
  let lastCheck = null

  while (Date.now() - startedAt < devServerTimeoutMs) {
    if (devServer.child.exitCode !== null || devServer.child.signalCode) {
      throw new Error(
        [
          `Managed Next dev server exited before ${profileUrl} became reachable.`,
          `Exit code: ${devServer.child.exitCode ?? "n/a"}`,
          `Signal: ${devServer.child.signalCode ?? "n/a"}`,
          "",
          "Dev server log tail:",
          devServer.logs.join(""),
        ].join("\n")
      )
    }

    const check = await checkProfilePage(profileUrl)
    if (check.ok) return
    lastCheck = check
    await sleep(500)
  }

  throw new Error(
    [
      `Managed Next dev server did not expose ${profileUrl} within ${devServerTimeoutMs}ms.`,
      `Last check: ${lastCheck?.detail ?? "none"}`,
      "",
      "Dev server log tail:",
      devServer.logs.join(""),
    ].join("\n")
  )
}

async function resolveProfileUrl() {
  if (serverMode === "existing") {
    const check = await checkProfilePage(requestedProfileUrl)
    if (!check.ok) {
      throw new Error(
        `Profile page is not reachable at ${requestedProfileUrl}: ${check.detail}`
      )
    }
    return { profileUrl: requestedProfileUrl, devServer: null }
  }

  if (serverMode !== "auto" && serverMode !== "managed") {
    throw new Error(
      `Unsupported PROFILE_SERVER_MODE=${JSON.stringify(
        serverMode
      )}; expected auto, existing, or managed`
    )
  }

  if (serverMode === "auto") {
    const check = await checkProfilePage(requestedProfileUrl)
    if (check.ok) return { profileUrl: requestedProfileUrl, devServer: null }
  }

  const port = await findAvailablePort(profilePort(requestedProfileUrl))
  const profileUrl = profileUrlForPort(requestedProfileUrl, port)
  const devServer = startManagedDevServer(profileUrl)
  await waitForProfilePage(profileUrl, devServer)
  return { profileUrl, devServer }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function fieldSelector(fieldPath) {
  return `td[data-field-path="${fieldPath}"]`
}

async function axTree(page) {
  const session = await page.context().newCDPSession(page)
  await session.send("Accessibility.enable")
  const tree = await session.send("Accessibility.getFullAXTree")
  await session.detach()
  return tree.nodes ?? []
}

function axValue(value) {
  return value && typeof value === "object" && "value" in value
    ? value.value
    : value
}

function axRole(node) {
  return axValue(node.role)
}

function axProperty(node, name) {
  const property = node.properties?.find((item) => item.name === name)
  return axValue(property?.value)
}

function hasAxRole(nodes, role) {
  return nodes.some((node) => axRole(node) === role)
}

function hasExpandedAxCombobox(nodes) {
  return nodes.some(
    (node) => axRole(node) === "combobox" && axProperty(node, "expanded")
  )
}

async function assertTableSemantics(page, label) {
  const summary = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table")).map(
      (table) => ({
        colcount: table.getAttribute("aria-colcount"),
        rowcount: table.getAttribute("aria-rowcount"),
      })
    )
    const spacerLeaks = document.querySelectorAll(
      '[data-json-table-header-spacer]:not([aria-hidden="true"]), [data-slot="json-table-column-spacer"]:not([aria-hidden="true"])'
    ).length
    const rowIndexes = Array.from(
      document.querySelectorAll('[data-slot="json-table-row"][aria-rowindex]')
    ).map((row) => row.getAttribute("aria-rowindex"))
    const cellIndexes = Array.from(
      document.querySelectorAll("td[data-field-path][aria-colindex]")
    ).map((cell) => cell.getAttribute("aria-colindex"))
    const headerIndexes = Array.from(
      document.querySelectorAll("thead th[aria-colindex]")
    ).map((cell) => cell.getAttribute("aria-colindex"))

    return { cellIndexes, headerIndexes, rowIndexes, spacerLeaks, tables }
  })

  assert(
    summary.tables.some((table) => table.colcount),
    `${label}: no aria-colcount`
  )
  assert(
    summary.tables.some((table) => table.rowcount),
    `${label}: no aria-rowcount`
  )
  assert(summary.rowIndexes.length > 0, `${label}: no aria-rowindex rows`)
  assert(summary.cellIndexes.length > 0, `${label}: no aria-colindex cells`)
  assert(summary.headerIndexes.length > 0, `${label}: no aria-colindex headers`)
  assert(
    summary.spacerLeaks === 0,
    `${label}: spacer leaked into accessibility tree`
  )
}

async function activateCell(page, fieldPath) {
  const locator = page.locator(fieldSelector(fieldPath))
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  assert(box, `Could not locate visible cell box for ${fieldPath}`)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

async function focusCellSurface(page, fieldPath) {
  const surface = page.locator(
    `${fieldSelector(fieldPath)} [data-slot="data-cell"]`
  )
  await surface.waitFor()
  await surface.focus()
  await page.waitForFunction((selector) => {
    const cell = document.querySelector(selector)
    return Boolean(cell && cell.contains(document.activeElement))
  }, fieldSelector(fieldPath))
  return surface
}

async function focusTableCell(page, fieldPath) {
  const cell = page.locator(fieldSelector(fieldPath))
  await cell.waitFor()
  await cell.focus()
  await page.waitForFunction((selector) => {
    const cell = document.querySelector(selector)
    return Boolean(cell && cell.contains(document.activeElement))
  }, fieldSelector(fieldPath))
  return cell
}

async function assertFocusWithinCell(page, fieldPath, label) {
  const hasFocus = await page.evaluate((selector) => {
    const cell = document.querySelector(selector)
    return Boolean(cell && cell.contains(document.activeElement))
  }, fieldSelector(fieldPath))
  assert(hasFocus, `${label}: focus did not return to ${fieldPath}`)
}

async function scrollFarColumns(page) {
  await scrollJsonTableColumns(page, 1)
}

async function scrollJsonTableColumns(page, ratio) {
  await page.evaluate(() => {
    const scroller = document.querySelector('[data-slot="json-table-scroll"]')
    if (!(scroller instanceof HTMLElement)) {
      throw new Error("Expected JSON table scroll container")
    }
    scroller.scrollLeft = scroller.scrollWidth
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }))
  })
  await page.waitForTimeout(50)
  await page.evaluate((nextRatio) => {
    const scroller = document.querySelector('[data-slot="json-table-scroll"]')
    if (!(scroller instanceof HTMLElement)) {
      throw new Error("Expected JSON table scroll container")
    }
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth
    scroller.scrollLeft = Math.max(0, maxScrollLeft * nextRatio)
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }))
  }, ratio)
  await page.waitForTimeout(100)
}

async function assertHeaderBodyAlignment(page, label) {
  const summary = await page.evaluate(() => {
    const headerCells = new Map()
    for (const cell of document.querySelectorAll(
      'thead th[aria-colindex]:not([aria-hidden="true"])'
    )) {
      if (!(cell instanceof HTMLElement)) continue
      if (cell.colSpan !== 1) continue
      const columnIndex = cell.getAttribute("aria-colindex")
      if (!columnIndex) continue
      const rect = cell.getBoundingClientRect()
      headerCells.set(columnIndex, {
        left: rect.left,
        width: rect.width,
      })
    }

    const bodyCells = Array.from(
      document.querySelectorAll("tbody tr:first-child td[data-field-path]")
    )
      .map((cell) => {
        if (!(cell instanceof HTMLElement)) return null
        const columnIndex = cell.getAttribute("aria-colindex")
        if (!columnIndex) return null
        const rect = cell.getBoundingClientRect()
        return {
          columnIndex,
          left: rect.left,
          width: rect.width,
        }
      })
      .filter(Boolean)

    return {
      bodyCells,
      headerCells: Array.from(headerCells, ([columnIndex, rect]) => ({
        columnIndex,
        ...rect,
      })),
    }
  })

  assert(summary.bodyCells.length > 0, `${label}: no body cells to align`)
  assert(summary.headerCells.length > 0, `${label}: no leaf headers to align`)

  const headerByColumnIndex = new Map(
    summary.headerCells.map((cell) => [cell.columnIndex, cell])
  )

  for (const bodyCell of summary.bodyCells) {
    const headerCell = headerByColumnIndex.get(bodyCell.columnIndex)
    assert(
      headerCell,
      `${label}: missing header for body column ${bodyCell.columnIndex}`
    )

    const leftDelta = Math.abs(headerCell.left - bodyCell.left)
    const widthDelta = Math.abs(headerCell.width - bodyCell.width)
    assert(
      leftDelta <= alignmentTolerancePx &&
        widthDelta <= alignmentTolerancePx,
      [
        `${label}: header/body column ${bodyCell.columnIndex} is misaligned`,
        `left delta ${leftDelta.toFixed(2)}px`,
        `width delta ${widthDelta.toFixed(2)}px`,
        `header left ${headerCell.left.toFixed(2)} width ${headerCell.width.toFixed(2)}`,
        `body left ${bodyCell.left.toFixed(2)} width ${bodyCell.width.toFixed(2)}`,
      ].join("; ")
    )
  }
}

async function enterJsonEditableMode(page) {
  await page.evaluate(() => {
    const group = Array.from(document.querySelectorAll('[role="group"]')).find(
      (element) => element.getAttribute("aria-label") === "Data edit mode"
    )
    const button = group
      ? Array.from(group.querySelectorAll("button")).find(
          (item) => item.textContent?.trim() === "Editable"
        )
      : null

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("JSON Editable mode button is missing")
    }

    button.click()
  })
  await page.locator('[data-json-table-editable-cell="true"]').first().waitFor()
}

async function assertOpenEnum(page, fieldPath, label) {
  await activateCell(page, fieldPath)
  const trigger = page.locator(`${fieldSelector(fieldPath)} [role="combobox"]`)
  await trigger.waitFor()
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click()
  }
  await page
    .locator('[data-slot="data-cell-select-popup"] [role="option"]')
    .first()
    .waitFor()

  await expectAttribute(trigger, "aria-expanded", "true", label)
  await expectAttribute(trigger, "aria-haspopup", "listbox", label)
  const controls = await trigger.getAttribute("aria-controls")
  assert(controls, `${label}: enum trigger is missing aria-controls`)
  assert(
    await page.locator(`#${controls}`).count(),
    `${label}: enum aria-controls target is missing`
  )

  const nodes = await axTree(page)
  assert(
    hasExpandedAxCombobox(nodes),
    `${label}: no expanded combobox in accessibility tree`
  )
  assert(
    hasAxRole(nodes, "listbox"),
    `${label}: no listbox in accessibility tree`
  )
  assert(
    hasAxRole(nodes, "option"),
    `${label}: no option in accessibility tree`
  )
}

async function assertKeyboardEnumFlow(page, fieldPath, label) {
  await focusCellSurface(page, fieldPath)
  await page.keyboard.press("Enter")

  const trigger = page.locator(`${fieldSelector(fieldPath)} [role="combobox"]`)
  await trigger.waitFor()
  await page
    .locator('[data-slot="data-cell-select-popup"] [role="option"]')
    .first()
    .waitFor()
  await expectAttribute(trigger, "aria-expanded", "true", label)

  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Escape")
  await page.locator(`${fieldSelector(fieldPath)} [role="combobox"]`).waitFor({
    state: "detached",
  })
  await assertFocusWithinCell(page, fieldPath, label)
}

async function assertOpenDate(page, fieldPath, label) {
  await activateCell(page, fieldPath)
  const trigger = page.locator(
    `${fieldSelector(fieldPath)} button[data-slot="data-cell"][aria-haspopup="dialog"]`
  )
  await trigger.waitFor()
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click()
  }
  await page.locator('[data-slot="calendar"]').waitFor()

  await expectAttribute(trigger, "aria-expanded", "true", label)
  await expectAttribute(trigger, "aria-haspopup", "dialog", label)
  const controls = await trigger.getAttribute("aria-controls")
  assert(controls, `${label}: date trigger is missing aria-controls`)
  assert(
    await page.locator(`#${controls}`).count(),
    `${label}: date aria-controls target is missing`
  )

  const nodes = await axTree(page)
  assert(
    hasAxRole(nodes, "dialog"),
    `${label}: no dialog in accessibility tree`
  )
  assert(
    hasAxRole(nodes, "grid") || hasAxRole(nodes, "table"),
    `${label}: no calendar grid/table in accessibility tree`
  )
}

async function assertKeyboardDateFlow(page, fieldPath, label) {
  await focusCellSurface(page, fieldPath)
  await page.keyboard.press("Enter")

  const trigger = page.locator(
    `${fieldSelector(fieldPath)} button[data-slot="data-cell"][aria-haspopup="dialog"]`
  )
  await trigger.waitFor()
  await page.locator('[data-slot="calendar"]').waitFor()
  await expectAttribute(trigger, "aria-expanded", "true", label)

  await page.keyboard.press("Escape")
  await page.locator('[data-slot="calendar"]').waitFor({ state: "detached" })
  await assertFocusWithinCell(page, fieldPath, label)
}

async function assertKeyboardTextCommit(page, fieldPath, label) {
  await focusCellSurface(page, fieldPath)
  await page.keyboard.press("K")

  const input = page.locator(
    `${fieldSelector(fieldPath)} input[data-mode="edit"]`
  )
  await input.waitFor()
  await page.keyboard.type("eyboard far note")
  await expectInputValue(input, "Keyboard far note", label)
  await page.keyboard.press("Enter")
  await input.waitFor({ state: "detached" })
  await assertFocusWithinCell(page, fieldPath, label)
  await page
    .locator(fieldSelector(fieldPath))
    .filter({ hasText: "Keyboard far note" })
    .waitFor()
}

function structuredDialog(page) {
  return page.locator('[data-slot="popover-popup"][role="dialog"]')
}

async function assertStructuredDialogVisible(page, label) {
  await structuredDialog(page).waitFor()
  const nodes = await axTree(page)
  assert(
    hasAxRole(nodes, "dialog"),
    `${label}: no structured dialog in accessibility tree`
  )
}

async function assertStructuredObjectControls(page, label) {
  const controls = await page.evaluate(() => {
    const popover = document.querySelector('[data-slot="popover-popup"]')
    if (!(popover instanceof HTMLElement)) return []

    return Array.from(popover.querySelectorAll("input")).map((input) => ({
      label: input
        .closest('[data-slot="form-item"]')
        ?.querySelector('[data-slot="form-label"]')
        ?.textContent?.trim(),
      type: input.getAttribute("type") ?? "text",
      value: input.value,
    }))
  })

  assert(
    controls.some(
      (control) =>
        control.label === "reviewer" &&
        control.type === "text" &&
        control.value === "reviewer-0"
    ),
    `${label}: missing reviewer string control`
  )
  assert(
    controls.some(
      (control) =>
        control.label === "priority" &&
        control.type === "number" &&
        control.value === "1"
    ),
    `${label}: missing priority number control`
  )
}

async function assertOpenStructuredObject(page, fieldPath, label) {
  await activateCell(page, fieldPath)
  await assertStructuredDialogVisible(page, label)

  const cell = page.locator(fieldSelector(fieldPath))
  await expectAttribute(cell, "data-active", "true", label)
  await page
    .locator(`${fieldSelector(fieldPath)} [data-slot="popover-trigger"]`)
    .waitFor()
  await assertStructuredObjectControls(page, label)
}

async function assertStructuredHorizontalRemount(page, fieldPath, label) {
  await assertOpenStructuredObject(page, fieldPath, label)

  await scrollJsonTableColumns(page, 0)
  await page.locator(fieldSelector(fieldPath)).waitFor({ state: "detached" })
  await structuredDialog(page).waitFor({ state: "detached" })

  await scrollFarColumns(page)
  await page.locator(fieldSelector(fieldPath)).waitFor()
  await assertStructuredDialogVisible(page, label)
  await expectAttribute(
    page.locator(fieldSelector(fieldPath)),
    "data-active",
    "true",
    label
  )

  await page.keyboard.press("Escape")
  await structuredDialog(page).waitFor({ state: "detached" })
}

async function assertKeyboardStructuredObjectFlow(page, fieldPath, label) {
  await focusTableCell(page, fieldPath)
  await page.keyboard.press("Enter")
  await assertStructuredDialogVisible(page, label)
  await expectAttribute(
    page.locator(fieldSelector(fieldPath)),
    "data-active",
    "true",
    label
  )

  await page.keyboard.press("Escape")
  await structuredDialog(page).waitFor({ state: "detached" })
  await assertFocusWithinCell(page, fieldPath, label)
}

async function expectAttribute(locator, attribute, expected, label) {
  const actual = await locator.getAttribute(attribute)
  assert(
    actual === expected,
    `${label}: expected ${attribute}=${JSON.stringify(
      expected
    )}, got ${JSON.stringify(actual)}`
  )
}

async function expectInputValue(locator, expected, label) {
  const actual = await locator.inputValue()
  assert(
    actual === expected,
    `${label}: expected input value ${JSON.stringify(
      expected
    )}, got ${JSON.stringify(actual)}`
  )
}

async function main() {
  const { profileUrl, devServer } = await resolveProfileUrl()
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    })

    await page.goto(profileUrl, { waitUntil: "networkidle" })
    await assertTableSemantics(page, "default inactive")
    await enterJsonEditableMode(page)
    await assertOpenEnum(page, enumFieldPath, "default open enum")
    await page.keyboard.press("Escape")
    await assertOpenDate(page, dateFieldPath, "default open date")
    await page.keyboard.press("Escape")

    const largeUrl = new URL(profileUrl)
    largeUrl.searchParams.set("variant", "large")
    await page.goto(largeUrl.toString(), { waitUntil: "networkidle" })
    await assertTableSemantics(page, "large inactive")
    await enterJsonEditableMode(page)
    await scrollJsonTableColumns(page, 0)
    await assertHeaderBodyAlignment(page, "large left columns")
    await scrollJsonTableColumns(page, 0.5)
    await assertHeaderBodyAlignment(page, "large middle columns")
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farEnumFieldPath)).waitFor()
    await assertTableSemantics(page, "large far columns")
    await assertHeaderBodyAlignment(page, "large far columns")
    await assertOpenEnum(page, farEnumFieldPath, "large far enum")
    await page.keyboard.press("Escape")
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farDateFieldPath)).waitFor()
    await assertOpenDate(page, farDateFieldPath, "large far date")
    await page.keyboard.press("Escape")
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farEnumFieldPath)).waitFor()
    await assertKeyboardEnumFlow(page, farEnumFieldPath, "large keyboard far enum")
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farDateFieldPath)).waitFor()
    await assertKeyboardDateFlow(page, farDateFieldPath, "large keyboard far date")
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farTextFieldPath)).waitFor()
    await assertKeyboardTextCommit(page, farTextFieldPath, "large keyboard far text")
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farStructuredObjectFieldPath)).waitFor()
    await assertOpenStructuredObject(
      page,
      farStructuredObjectFieldPath,
      "large far structured object"
    )
    await page.keyboard.press("Escape")
    await structuredDialog(page).waitFor({ state: "detached" })
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farStructuredObjectFieldPath)).waitFor()
    await assertStructuredHorizontalRemount(
      page,
      farStructuredObjectFieldPath,
      "large far structured object remount"
    )
    await scrollFarColumns(page)
    await page.locator(fieldSelector(farStructuredObjectFieldPath)).waitFor()
    await assertKeyboardStructuredObjectFlow(
      page,
      farStructuredObjectFieldPath,
      "large keyboard far structured object"
    )

    console.log(
      `ok json-table accessibility browser verification at ${profileUrl}`
    )
  } finally {
    await browser.close().catch(() => {})
    devServer?.stop()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
