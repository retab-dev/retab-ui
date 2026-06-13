import { spawn } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const assertMode = process.argv.includes("--assert")
const profileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/json-table-profile"
const chromePort = Number(process.env.CHROME_PORT ?? 9341)
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const outputPath =
  process.env.PROFILE_OUTPUT ??
  "tmp/json-table-primitive-interactions-profile.json"

const enumFieldPath = "transactions.0.transaction_type"
const dateFieldPath = "transactions.0.date"

function profileTargets() {
  return [
    {
      name: "default",
      url: profileUrl,
    },
    {
      name: "large",
      url: urlWithSearchParam(profileUrl, "variant", "large"),
    },
  ]
}

function urlWithSearchParam(url, key, value) {
  const parsed = new URL(url)
  parsed.searchParams.set(key, value)
  return parsed.toString()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
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

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data)
    if (!payload.id || !pending.has(payload.id)) return

    const request = pending.get(payload.id)
    pending.delete(payload.id)
    if (payload.error) request.reject(new Error(JSON.stringify(payload.error)))
    else request.resolve(payload.result)
  })

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        socket,
        send(method, params = {}) {
          const id = ++nextId
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject })
          })
        },
      })
    })
    socket.addEventListener("error", reject)
  })
}

async function evaluate(send, expression) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (result.exceptionDetails) {
        throw new Error(JSON.stringify(result.exceptionDetails))
      }
      return result.result.value
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isTransientContextError =
        message.includes("Cannot find default execution context") ||
        message.includes("Inspected target navigated") ||
        message.includes("Execution context was destroyed")
      if (!isTransientContextError || attempt === 49) throw error
      await sleep(100)
    }
  }

  throw new Error("Runtime.evaluate did not complete")
}

async function waitInPage(send, expression, timeoutMs = 5_000) {
  return evaluate(
    send,
    `(async () => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < ${timeoutMs}) {
        if (${expression}) {
          await new Promise((resolve) => setTimeout(resolve, 32));
          return { ok: true, elapsedMs: performance.now() - startedAt };
        }
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      return { ok: false, elapsedMs: performance.now() - startedAt };
    })()`
  )
}

async function clickPoint(send, point) {
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

async function clickButtonByText(send, text) {
  const point = await evaluate(
    send,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.includes(${JSON.stringify(text)}));
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
  if (!point) throw new Error(`Button not found: ${text}`)
  await clickPoint(send, point)
}

function performanceMetrics(metricsRaw) {
  const metrics = Object.fromEntries(
    metricsRaw.metrics.map((metric) => [metric.name, metric.value])
  )
  return {
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

function topEntries(record, limit = 24) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

async function installPage(send) {
  await evaluate(
    send,
    `(() => {
      window.__jsonTableProfiler = {
        enabled: true,
        events: [],
        renders: {
          total: 0,
          byComponent: {},
          byInstance: {},
          changedProps: {}
        },
        snapshots: {}
      };
    })()`
  )
}

async function loadEditableProfile(send) {
  console.error("Waiting for editable profile page")
  const scrollerWait = await waitInPage(
    send,
    `document.querySelector('[data-slot="json-table-scroll"]')`,
    15_000
  )
  if (!scrollerWait.ok) {
    const pageState = await evaluate(
      send,
      `({ href: location.href, text: document.body.innerText.slice(0, 1000) })`
    )
    throw new Error(`JSON table scroller did not mount: ${JSON.stringify(pageState)}`)
  }
  const editableButtonWait = await waitInPage(
    send,
    `[...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Editable"))`,
    15_000
  )
  if (!editableButtonWait.ok) {
    const buttonTexts = await evaluate(
      send,
      `({
        href: location.href,
        text: document.body.innerText.slice(0, 1000),
        buttons: [...document.querySelectorAll("button")].map((button) => button.textContent)
      })`
    )
    throw new Error(`Editable button did not mount: ${JSON.stringify(buttonTexts)}`)
  }
  await clickButtonByText(send, "Editable")
  const wait = await waitInPage(
    send,
    `document.querySelectorAll('[data-json-table-editable-cell="true"]').length > 0`,
    5_000
  )
  if (!wait.ok) throw new Error("Editable JSON table did not mount")
  console.error("Editable table mounted")
  await sleep(500)
}

async function resetProfiler(send) {
  await evaluate(
    send,
    `(() => {
      window.__jsonTableProfiler.events = [];
      window.__jsonTableProfiler.renders = {
        total: 0,
        byComponent: {},
        byInstance: {},
        changedProps: {}
      };
      const original = Element.prototype.getBoundingClientRect;
      window.__jsonTableRectProbe = { count: 0, bySlot: {}, original };
      Element.prototype.getBoundingClientRect = function() {
        const slot = this.getAttribute?.("data-slot") || this.getAttribute?.("role") || this.tagName;
        window.__jsonTableRectProbe.count += 1;
        window.__jsonTableRectProbe.bySlot[slot] = (window.__jsonTableRectProbe.bySlot[slot] || 0) + 1;
        return original.apply(this, arguments);
      };
    })()`
  )
}

async function restoreRectProbe(send) {
  await evaluate(
    send,
    `(() => {
      if (window.__jsonTableRectProbe?.original) {
        Element.prototype.getBoundingClientRect = window.__jsonTableRectProbe.original;
      }
    })()`
  )
}

async function editableCellPoint(send, fieldPath) {
  return evaluate(
    send,
    `(() => {
      const cell = document.querySelector('[data-field-path="${fieldPath}"]');
      if (!cell) throw new Error("Missing cell: ${fieldPath}");
      const rect = cell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function firstVisibleCellPoint(send, selector) {
  return evaluate(
    send,
    `(() => {
      const element = [...document.querySelectorAll(${JSON.stringify(
        selector
      )})].find((element) => {
        const cell = element.closest('[data-json-table-editable-cell="true"]') ?? element;
        const rect = cell.getBoundingClientRect();
        return rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
      });
      const cell = element?.closest('[data-json-table-editable-cell="true"]') ?? element;
      if (!cell) return null;
      const rect = cell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function selectCommitOptionPoint(send) {
  return evaluate(
    send,
    `(() => {
      const options = [...document.querySelectorAll('[data-slot="data-cell-select-popup"] [role="option"]')];
      const option = options.find((option) =>
        option.getAttribute("aria-selected") !== "true" &&
        option.getAttribute("aria-disabled") !== "true"
      );
      if (!option) throw new Error("No selectable commit option found");
      const rect = option.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function summarizeScenario(send, beforeMetrics, startedAt, wait) {
  const afterMetrics = performanceMetrics(await send("Performance.getMetrics"))
  const summary = await evaluate(
    send,
    `(() => {
      const profiler = window.__jsonTableProfiler;
      const reactCommits = profiler.events.filter((event) => event.type === "react-commit");
      const popup = document.querySelector('[data-slot="data-cell-select-popup"]');
      const pickerPopup = document.querySelector('[data-slot="data-cell-picker-popup"]');
      const baseUiSelect = document.querySelector('[data-slot="select-popup"], [data-slot="select-positioner"], [data-slot="select-list"]');
      const topEntries = ${topEntries.toString()};
      return {
        popupMounted: Boolean(popup),
        pickerPopupMounted: Boolean(pickerPopup),
        calendarMounted: Boolean(document.querySelector('[data-slot="calendar"]')),
        popupOptions: popup ? popup.querySelectorAll('[role="option"]').length : 0,
        baseUiSelectMounted: Boolean(baseUiSelect),
        activeEditableCells: document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length,
        totalDomNodes: document.querySelectorAll("*").length,
        rectProbe: {
          count: window.__jsonTableRectProbe?.count ?? 0,
          bySlot: window.__jsonTableRectProbe?.bySlot ?? {}
        },
        profiler: {
          renders: {
            total: profiler.renders.total,
            byComponent: topEntries(profiler.renders.byComponent),
            byInstance: topEntries(profiler.renders.byInstance),
            changedProps: topEntries(profiler.renders.changedProps, 32)
          },
          reactCommits: {
            count: reactCommits.length,
            totalActualDurationMs: reactCommits.reduce((total, event) => total + (event.detail?.actualDuration || 0), 0),
            maxActualDurationMs: Math.max(0, ...reactCommits.map((event) => event.detail?.actualDuration || 0))
          }
        }
      };
    })()`
  )
  summary.wait = wait
  summary.elapsedMs = await evaluate(
    send,
    `performance.now() - ${JSON.stringify(startedAt)}`
  )
  summary.metricsDelta = metricDelta(beforeMetrics, afterMetrics)
  return summary
}

async function runScenario(send, name, action, waitExpression) {
  console.error(`Running scenario: ${name}`)
  await resetProfiler(send)
  const beforeMetrics = performanceMetrics(await send("Performance.getMetrics"))
  const startedAt = await evaluate(send, "performance.now()")
  await action()
  const wait = await waitInPage(send, waitExpression, 5_000)
  const summary = await summarizeScenario(send, beforeMetrics, startedAt, wait)
  await restoreRectProbe(send)
  console.error(`Finished scenario: ${name}`)
  return { name, ...summary }
}

async function runProfileTarget(chromeEndpoint, targetConfig) {
  console.error(`Profiling target: ${targetConfig.name} (${targetConfig.url})`)
  const newTargetResponse = await fetch(
    `${chromeEndpoint}/json/new?${encodeURIComponent(targetConfig.url)}`,
    { method: "PUT" }
  )
  if (!newTargetResponse.ok) {
    throw new Error(`/json/new failed: ${newTargetResponse.status}`)
  }

  const target = await newTargetResponse.json()
  const page = await connectCdp(target.webSocketDebuggerUrl)
  const send = page.send

  try {
    await send("Page.enable")
    await send("Runtime.enable")
    await send("Performance.enable")
    await sleep(700)
    await installPage(send)
    await loadEditableProfile(send)

    const scenarios = []
    const enumPoint = await editableCellPoint(send, enumFieldPath)

    scenarios.push(
      await runScenario(
        send,
        "open-enum",
        async () => {
          await evaluate(
            send,
            `window.__jsonTableRectProbe.count = 0; window.__jsonTableRectProbe.bySlot = {};`
          )
          await clickPoint(send, enumPoint)
        },
        `Boolean(document.querySelector('[data-slot="data-cell-select-popup"] [role="option"]'))`
      )
    )

    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    })
    await sleep(200)
    scenarios.push(
      await runScenario(
        send,
        "open-and-commit-enum",
        async () => {
          const point = await editableCellPoint(send, enumFieldPath)
          await clickPoint(send, point)
          await waitInPage(
            send,
            `Boolean(document.querySelector('[data-slot="data-cell-select-popup"] [role="option"]'))`,
            3_000
          )
          await clickPoint(send, await selectCommitOptionPoint(send))
        },
        `!document.querySelector('[data-slot="data-cell-select-popup"]')`
      )
    )

    scenarios.push(
      await runScenario(
        send,
        "toggle-checkbox",
        async () => {
          const point = await firstVisibleCellPoint(
            send,
            '[data-field-path="transactions.0.is_reconciled"] [data-kind="boolean"][data-mode="display"]'
          )
          if (!point) throw new Error("No checkbox cell found")
          await clickPoint(send, point)
        },
        `document.querySelector('[data-field-path="transactions.0.is_reconciled"] [data-kind="boolean"][data-mode="display"]')`
      )
    )

    scenarios.push(
      await runScenario(
        send,
        "open-date-picker",
        async () => {
          const point = await firstVisibleCellPoint(
            send,
            '[data-kind="date"][data-mode="display"]'
          )
          if (!point) throw new Error("No date cell found")
          await clickPoint(send, point)
        },
        `Boolean(document.querySelector('[data-slot="calendar"]'))`
      )
    )

    return {
      name: targetConfig.name,
      route: targetConfig.url,
      scenarios,
    }
  } finally {
    try {
      page.socket.close()
    } catch {}
  }
}

function assertScenario(condition, message) {
  if (!condition) throw new Error(message)
}

function editableCellRenderNames(scenario) {
  return scenario.profiler.renders.byInstance
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("EditableJsonTableCell:"))
}

function assertOnlyTargetEditableCellRendered(scenario, targetFieldPath) {
  const unexpected = editableCellRenderNames(scenario).filter(
    (name) => name !== `EditableJsonTableCell:${targetFieldPath}`
  )
  assertScenario(
    unexpected.length === 0,
    `${scenario.name}: unrelated editable cells rendered: ${unexpected.join(", ")}`
  )
}

function assertNoTableOrRowRender(scenario) {
  const unexpected = scenario.profiler.renders.byComponent.filter((entry) =>
    [
      "SingleFileTableView",
      "SingleFileVirtualizedTable",
      "SingleFileFormRow",
    ].includes(entry.name)
  )
  assertScenario(
    unexpected.length === 0,
    `${scenario.name}: table or row rendered during editor-local interaction: ${unexpected
      .map((entry) => `${entry.name}(${entry.count})`)
      .join(", ")}`
  )
}

function assertReport(report) {
  const profiles = report.profiles ?? [
    {
      name: "default",
      scenarios: report.scenarios,
    },
  ]

  for (const profile of profiles) {
    assertProfile(profile)
  }
}

function assertProfile(profile) {
  const open = profile.scenarios.find(
    (scenario) => scenario.name === "open-enum"
  )
  const commit = profile.scenarios.find(
    (scenario) => scenario.name === "open-and-commit-enum"
  )
  const checkbox = profile.scenarios.find(
    (scenario) => scenario.name === "toggle-checkbox"
  )
  const date = profile.scenarios.find(
    (scenario) => scenario.name === "open-date-picker"
  )
  const label = `${profile.name}: `

  assertScenario(open?.wait.ok, `${label}open-enum did not complete`)
  assertScenario(open.popupMounted, `${label}open-enum did not mount select popup`)
  assertScenario(!open.baseUiSelectMounted, `${label}open-enum mounted Base UI select`)
  assertScenario(
    open.rectProbe.count <= 1,
    `${label}open-enum expected <= 1 rect read, got ${open.rectProbe.count}`
  )
  assertOnlyTargetEditableCellRendered(open, enumFieldPath)
  assertNoTableOrRowRender(open)

  assertScenario(commit?.wait.ok, `${label}open-and-commit-enum did not complete`)
  assertScenario(!commit.popupMounted, `${label}open-and-commit-enum left popup open`)
  assertScenario(
    !commit.baseUiSelectMounted,
    `${label}open-and-commit-enum mounted Base UI select`
  )
  assertOnlyTargetEditableCellRendered(commit, enumFieldPath)

  assertScenario(checkbox?.wait.ok, `${label}toggle-checkbox did not complete`)
  assertOnlyTargetEditableCellRendered(checkbox, "transactions.0.is_reconciled")

  assertScenario(date?.wait.ok, `${label}open-date-picker did not complete`)
  assertScenario(date.pickerPopupMounted, `${label}open-date-picker did not mount picker popup`)
  assertScenario(date.calendarMounted, `${label}open-date-picker did not mount calendar`)
  assertScenario(
    (date.rectProbe.bySlot["data-cell"] ?? 0) <= 1,
    `${label}open-date-picker expected <= 1 data-cell rect read, got ${
      date.rectProbe.bySlot["data-cell"] ?? 0
    }`
  )
  assertOnlyTargetEditableCellRendered(date, dateFieldPath)
  assertNoTableOrRowRender(date)
}

async function main() {
  const chromeEndpoint = `http://127.0.0.1:${chromePort}`
  const userDataDir = await mkdtemp(join(tmpdir(), "json-table-primitive-"))
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
    await waitForDevToolsEndpoint(chromeEndpoint)
    const profiles = []
    for (const target of profileTargets()) {
      profiles.push(await runProfileTarget(chromeEndpoint, target))
    }

    const report = {
      measuredAt: new Date().toISOString(),
      profiles,
      scenarios: profiles[0]?.scenarios ?? [],
    }

    if (assertMode) assertReport(report)

    await mkdir("tmp", { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
    console.error(`Wrote ${outputPath}`)
  } finally {
    chrome.kill("SIGTERM")
    await new Promise((resolve) => chrome.once("exit", resolve))
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
