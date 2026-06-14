import { spawn } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const assertMode = process.argv.includes("--assert")
const styleExperimentMode =
  process.argv.includes("--style-experiments") ||
  process.env.JSON_TABLE_STYLE_EXPERIMENTS === "1"
const verboseOutput =
  process.argv.includes("--verbose") ||
  process.env.JSON_TABLE_PERFORMANCE_VERBOSE === "1"
const traceMode =
  process.argv.includes("--trace") ||
  process.env.JSON_TABLE_PROFILE_TRACE === "1"
const repeatCount = profileRepeatCount()
const warmupCount = profileWarmupCount()
const profileTargetNames = optionNameSet(
  "--targets",
  "JSON_TABLE_PROFILE_TARGETS"
)
const profileScenarioNames = optionNameSet(
  "--scenarios",
  "JSON_TABLE_PROFILE_SCENARIOS"
)
if (assertMode && profileScenarioNames) {
  throw new Error(
    "JSON table scenario filters are diagnostic-only and cannot be combined with --assert"
  )
}
const profileUrl =
  process.env.PROFILE_URL ?? "http://localhost:3100/json-table-profile"
const chromePort = Number(process.env.CHROME_PORT ?? 9341)
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const outputPath =
  process.env.PROFILE_OUTPUT ??
  "tmp/json-table-primitive-interactions-profile.json"
const traceCategories =
  process.env.JSON_TABLE_PROFILE_TRACE_CATEGORIES ??
  [
    "devtools.timeline",
    "blink",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.invalidationTracking",
  ].join(",")

const enumFieldPath = "transactions.0.transaction_type"
const dateFieldPath = "transactions.0.date"
const textFieldPath = "transactions.0.description"
const numberFieldPath = "transactions.0.amount.amount"
const booleanFieldPath = "transactions.0.is_reconciled"
const farTextFieldPath = "transactions.0.profile_far_note"
const farEnumFieldPath = "transactions.0.profile_far_status"
const farDateFieldPath = "transactions.0.profile_far_date"
const profileSurfaceTimeoutMs = 15_000
const editableCellTimeoutMs = 10_000

// These budgets guard the overlay mount path against structural regressions.
// They are intentionally coarse: React render counts are strict elsewhere, while
// browser layout/style durations vary by machine and should diagnose before they
// fail a run.
const maxDateOpenNodeDelta = Number(process.env.DATE_OPEN_NODE_BUDGET ?? 240)
const maxDateOpenLayoutDurationMs = Number(
  process.env.DATE_OPEN_LAYOUT_MS_BUDGET ?? 80
)

function optionValue(optionName) {
  const prefix = `${optionName}=`
  const inlineValue = process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
  if (inlineValue !== undefined) return inlineValue

  const optionIndex = process.argv.indexOf(optionName)
  if (optionIndex === -1) return undefined
  return process.argv[optionIndex + 1]
}

function profileRepeatCount() {
  const rawValue =
    optionValue("--repeat") ?? process.env.JSON_TABLE_PROFILE_REPEAT ?? "1"
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `Invalid JSON table profile repeat count: ${JSON.stringify(rawValue)}`
    )
  }
  return value
}

function profileWarmupCount() {
  const rawValue =
    optionValue("--warmup") ?? process.env.JSON_TABLE_PROFILE_WARMUP ?? "0"
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Invalid JSON table profile warmup count: ${JSON.stringify(rawValue)}`
    )
  }
  return value
}

function optionNameSet(optionName, envName) {
  const rawValue = optionValue(optionName) ?? process.env[envName]
  if (!rawValue || rawValue === "all") return null

  const names = rawValue
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) return null

  return new Set(names)
}

function profileTargets() {
  const targets = [
    {
      name: "default",
      url: profileUrl,
    },
    {
      name: "large",
      url: urlWithSearchParam(profileUrl, "variant", "large"),
    },
  ]

  if (styleExperimentMode) {
    targets.push(
      {
        name: "large-rows-120",
        url: urlWithSearchParams(profileUrl, {
          rows: "120",
          variant: "large",
        }),
      },
      {
        name: "large-extra-columns-0",
        url: urlWithSearchParams(profileUrl, {
          extraColumns: "0",
          variant: "large",
        }),
      },
      {
        name: "large-extra-columns-6",
        url: urlWithSearchParams(profileUrl, {
          extraColumns: "6",
          variant: "large",
        }),
      },
      {
        name: "large-overscan-12",
        url: urlWithSearchParams(profileUrl, {
          jumpOverscan: "12",
          overscan: "12",
          variant: "large",
        }),
      }
    )
  }

  if (!profileTargetNames) return targets

  const selectedTargets = targets.filter((target) =>
    profileTargetNames.has(target.name)
  )
  if (selectedTargets.length === 0) {
    throw new Error(
      `No JSON table profile target matched ${JSON.stringify([
        ...profileTargetNames,
      ])}; available targets: ${targets.map((target) => target.name).join(", ")}`
    )
  }

  return selectedTargets
}

function shouldProfileScenario(name) {
  return !profileScenarioNames || profileScenarioNames.has(name)
}

function assertSelectedScenarioNamesMatched(report) {
  if (!profileScenarioNames) return

  const measuredScenarioNames = new Set()
  for (const profile of report.profiles ?? []) {
    for (const scenario of profile.scenarios ?? []) {
      measuredScenarioNames.add(scenario.name)
    }
  }

  const missingScenarioNames = [...profileScenarioNames].filter(
    (name) => !measuredScenarioNames.has(name)
  )
  if (missingScenarioNames.length > 0) {
    throw new Error(
      `No JSON table profile scenario matched ${JSON.stringify(
        missingScenarioNames
      )}; measured scenarios: ${[...measuredScenarioNames].join(", ")}`
    )
  }
}

function urlWithSearchParam(url, key, value) {
  return urlWithSearchParams(url, { [key]: value })
}

function urlWithSearchParams(url, params) {
  const parsed = new URL(url)
  for (const [key, value] of Object.entries(params)) {
    parsed.searchParams.set(key, value)
  }
  return parsed.toString()
}

function formatMs(value) {
  if (value === null || value === undefined) return "n/a"
  return `${Number.isInteger(value) ? value : value.toFixed(1)}ms`
}

function renderedComponentCount(scenario, componentName) {
  return (
    scenario.profiler?.renders?.byComponent?.find(
      (entry) => entry.name === componentName
    )?.count ?? 0
  )
}

function printStyleExperimentSummary(report) {
  const scenarioNames = new Set([
    "open-enum",
    "open-date",
    "switch-dirty-cell",
    "open-far-enum",
    "open-far-date",
    "commit-far-text",
  ])
  console.log("json-table style experiment summary")
  for (const profile of report.profiles ?? []) {
    for (const scenario of profile.scenarios ?? []) {
      if (!scenarioNames.has(scenario.name)) continue
      console.log(
        [
          `${profile.name}/${scenario.name}`,
          `elapsed=${formatMs(scenario.elapsedMs)}`,
          `style=${formatMs(scenario.browserCost?.style?.durationMs)}`,
          `layout=${formatMs(scenario.browserCost?.layout?.durationMs)}`,
          `owner=${scenario.styleAttributionHint ?? "unknown"}`,
          `surface=header:${scenario.mountedSurface?.after?.headerCells ?? "n/a"}/body:${scenario.mountedSurface?.after?.editableCells ?? "n/a"}/popup:${scenario.mountedSurface?.after?.popupNodes ?? "n/a"}`,
          `renders=${renderedComponentCount(scenario, "EditableJsonTableCell")}`,
          `commits=${scenario.profiler?.reactCommits?.count ?? 0}`,
          `rect=${scenario.rectProbe?.count ?? 0}`,
        ].join("  ")
      )
    }
  }
}

function percentile(values, percentileRank) {
  const sortedValues = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
  if (sortedValues.length === 0) return null

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(percentileRank * sortedValues.length) - 1)
  )
  return sortedValues[index]
}

function median(values) {
  const sortedValues = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
  if (sortedValues.length === 0) return null

  const middle = Math.floor(sortedValues.length / 2)
  if (sortedValues.length % 2 === 1) return sortedValues[middle]
  return (sortedValues[middle - 1] + sortedValues[middle]) / 2
}

function worst(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (finiteValues.length === 0) return null
  return Math.max(...finiteValues)
}

function repeatedMetricSummary(values) {
  return {
    median: median(values),
    p90: percentile(values, 0.9),
    worst: worst(values),
  }
}

function traceEventDurationMs(event) {
  return Number.isFinite(event.dur) ? event.dur / 1000 : 0
}

function traceEventGroupSummary(events, predicate, limit = 12) {
  const groups = new Map()
  for (const event of events) {
    if (event.ph !== "X" || !predicate(event)) continue
    const durationMs = traceEventDurationMs(event)
    const group = groups.get(event.name) ?? {
      name: event.name,
      count: 0,
      durationMs: 0,
    }
    group.count += 1
    group.durationMs += durationMs
    groups.set(event.name, group)
  }

  return [...groups.values()]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, limit)
    .map((group) => ({
      ...group,
      durationMs: Number(group.durationMs.toFixed(3)),
    }))
}

function isTraceStyleEvent(event) {
  return /recalculate|style|selector|invalidation/i.test(event.name)
}

function isTraceLayoutEvent(event) {
  return /layout|updateLayoutTree/i.test(event.name)
}

function isTraceScriptEvent(event) {
  return /function|evaluate|event|timer|script|v8/i.test(event.name)
}

function traceDurationMs(events, predicate) {
  return Number(
    events
      .filter((event) => event.ph === "X" && predicate(event))
      .reduce((total, event) => total + traceEventDurationMs(event), 0)
      .toFixed(3)
  )
}

function traceEventSummary(events) {
  const timedEvents = events.filter((event) => event.ph === "X")
  const invalidationEvents = events.filter((event) =>
    /invalidat/i.test(event.name)
  )

  return {
    eventCount: events.length,
    timedEventCount: timedEvents.length,
    totalTimedDurationMs: traceDurationMs(timedEvents, () => true),
    styleDurationMs: traceDurationMs(timedEvents, isTraceStyleEvent),
    layoutDurationMs: traceDurationMs(timedEvents, isTraceLayoutEvent),
    scriptDurationMs: traceDurationMs(timedEvents, isTraceScriptEvent),
    topEvents: traceEventGroupSummary(timedEvents, () => true),
    topStyleEvents: traceEventGroupSummary(timedEvents, isTraceStyleEvent),
    topLayoutEvents: traceEventGroupSummary(timedEvents, isTraceLayoutEvent),
    invalidationEvents: traceEventGroupSummary(
      invalidationEvents,
      () => true,
      16
    ),
  }
}

function scenarioRepeatedMetrics(scenario) {
  return {
    elapsedMs: scenario.elapsedMs,
    styleMs: scenario.browserCost?.style?.durationMs,
    layoutMs: scenario.browserCost?.layout?.durationMs,
    scriptMs: scenario.browserCost?.scriptDurationMs,
    reactCommits: scenario.profiler?.reactCommits?.count,
    editableCellRenders: renderedComponentCount(
      scenario,
      "EditableJsonTableCell"
    ),
    rectReads: scenario.rectProbe?.count,
    documentPatches: scenario.profiler?.markCounts?.["document-patch-start"],
    domNodeDelta: scenario.metricsDelta?.Nodes,
    mountedEditableCells: scenario.mountedSurface?.after?.editableCells,
    mountedHeaderCells: scenario.mountedSurface?.after?.headerCells,
    mountedPopupNodes: scenario.mountedSurface?.after?.popupNodes,
    traceStyleMs: scenario.trace?.styleDurationMs,
    traceLayoutMs: scenario.trace?.layoutDurationMs,
    traceScriptMs: scenario.trace?.scriptDurationMs,
  }
}

function buildRepeatedProfileSummary(runs) {
  const scenarioGroups = new Map()

  for (const run of runs) {
    for (const profile of run.profiles ?? []) {
      for (const scenario of profile.scenarios ?? []) {
        const key = `${profile.name}/${scenario.name}`
        const group = scenarioGroups.get(key) ?? {
          profile: profile.name,
          scenario: scenario.name,
          runs: 0,
          metrics: {},
        }
        const metrics = scenarioRepeatedMetrics(scenario)
        for (const [metricName, value] of Object.entries(metrics)) {
          group.metrics[metricName] ??= []
          group.metrics[metricName].push(value)
        }
        group.runs += 1
        scenarioGroups.set(key, group)
      }
    }
  }

  return [...scenarioGroups.values()].map((group) => ({
    profile: group.profile,
    scenario: group.scenario,
    runs: group.runs,
    metrics: Object.fromEntries(
      Object.entries(group.metrics).map(([metricName, values]) => [
        metricName,
        repeatedMetricSummary(values),
      ])
    ),
  }))
}

function printRepeatedProfileSummary(report) {
  if (!report.repeatedScenarios?.length) return

  console.log("json-table repeated profile summary")
  for (const scenario of report.repeatedScenarios) {
    const elapsed = scenario.metrics.elapsedMs
    const style = scenario.metrics.styleMs
    const layout = scenario.metrics.layoutMs
    const traceStyle = scenario.metrics.traceStyleMs
    const traceLayout = scenario.metrics.traceLayoutMs
    console.log(
      [
        `${scenario.profile}/${scenario.scenario}`,
        `runs=${scenario.runs}`,
        `elapsed median=${formatMs(elapsed?.median)} p90=${formatMs(
          elapsed?.p90
        )} worst=${formatMs(elapsed?.worst)}`,
        `style median=${formatMs(style?.median)} p90=${formatMs(
          style?.p90
        )} worst=${formatMs(style?.worst)}`,
        `layout median=${formatMs(layout?.median)} p90=${formatMs(
          layout?.p90
        )} worst=${formatMs(layout?.worst)}`,
        traceStyle
          ? `traceStyle median=${formatMs(
              traceStyle.median
            )} p90=${formatMs(traceStyle.p90)} worst=${formatMs(
              traceStyle.worst
            )}`
          : null,
        traceLayout
          ? `traceLayout median=${formatMs(
              traceLayout.median
            )} p90=${formatMs(traceLayout.p90)} worst=${formatMs(
              traceLayout.worst
            )}`
          : null,
      ]
        .filter(Boolean)
        .join("  ")
    )
  }
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

async function closeChromeTarget(chromeEndpoint, targetId) {
  if (!targetId) return

  try {
    await fetch(`${chromeEndpoint}/json/close/${encodeURIComponent(targetId)}`)
  } catch {}
}

function isProfileTarget(target) {
  if (!target?.url) return false

  try {
    const targetUrl = new URL(target.url)
    const configuredUrl = new URL(profileUrl)
    return targetUrl.pathname === configuredUrl.pathname
  } catch {
    return false
  }
}

async function closeProfileTargets(chromeEndpoint) {
  let targets = []
  try {
    targets = await fetchJson(`${chromeEndpoint}/json/list`)
  } catch {
    return
  }

  for (const target of targets) {
    if (isProfileTarget(target))
      await closeChromeTarget(chromeEndpoint, target.id)
  }
}

function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl)
  let nextId = 0
  const pending = new Map()
  const listeners = new Map()

  function emit(method, params) {
    for (const listener of listeners.get(method) ?? []) listener(params)
  }

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data)
    if (!payload.id) {
      if (payload.method) emit(payload.method, payload.params ?? {})
      return
    }
    if (!pending.has(payload.id)) return

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
        on(method, listener) {
          const methodListeners = listeners.get(method) ?? new Set()
          methodListeners.add(listener)
          listeners.set(method, methodListeners)
          return () => methodListeners.delete(listener)
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

async function startScenarioTrace(page) {
  if (!traceMode) return null

  const events = []
  const offData = page.on("Tracing.dataCollected", (params) => {
    events.push(...(params.value ?? []))
  })
  let resolveComplete
  const completed = new Promise((resolve) => {
    resolveComplete = resolve
  })
  const offComplete = page.on("Tracing.tracingComplete", resolveComplete)

  await page.send("Tracing.start", {
    categories: traceCategories,
    options: "sampling-frequency=10000",
    transferMode: "ReportEvents",
  })

  return {
    async stop() {
      await page.send("Tracing.end")
      await completed
      offData()
      offComplete()
      return traceEventSummary(events)
    },
  }
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

async function clickModeButton(send, groupLabel, buttonText) {
  const clicked = await evaluate(
    send,
    `(() => {
      const group = [...document.querySelectorAll('[role="group"]')]
        .find((element) => element.getAttribute("aria-label") === ${JSON.stringify(groupLabel)});
      const button = group
        ? [...group.querySelectorAll("button")]
            .find((item) => item.textContent?.trim() === ${JSON.stringify(buttonText)})
        : null;
      if (!button) return false;
      button.click();
      return true;
    })()`
  )
  if (!clicked)
    throw new Error(`Mode button not found: ${groupLabel}/${buttonText}`)
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

function browserCostSummary(metricsDelta, reactDurationMs) {
  const durationEntries = [
    {
      name: "react",
      durationMs: reactDurationMs,
    },
    {
      name: "style",
      durationMs: metricsDelta.RecalcStyleDurationMs,
      count: metricsDelta.RecalcStyleCount,
    },
    {
      name: "layout",
      durationMs: metricsDelta.LayoutDurationMs,
      count: metricsDelta.LayoutCount,
    },
    {
      name: "script",
      durationMs: metricsDelta.ScriptDurationMs,
    },
  ].sort((a, b) => b.durationMs - a.durationMs)

  return {
    dominantCost: durationEntries[0]?.name ?? "unknown",
    domNodeDelta: metricsDelta.Nodes,
    reactDurationMs,
    style: {
      count: metricsDelta.RecalcStyleCount,
      durationMs: metricsDelta.RecalcStyleDurationMs,
    },
    layout: {
      count: metricsDelta.LayoutCount,
      durationMs: metricsDelta.LayoutDurationMs,
    },
    scriptDurationMs: metricsDelta.ScriptDurationMs,
    taskDurationMs: metricsDelta.TaskDurationMs,
  }
}

function topEntries(record, limit = 24) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

function mountedSurfaceDelta(before, after) {
  return Object.fromEntries(
    Object.keys(after).map((key) => [key, after[key] - (before[key] ?? 0)])
  )
}

function styleAttributionHint(summary) {
  if (summary.browserCost?.dominantCost !== "style") return "not-style-bound"
  const after = summary.mountedSurface?.after ?? {}
  const delta = summary.mountedSurface?.delta ?? {}

  if ((delta.popupNodes ?? 0) > 0) return "popup-mount"
  if ((after.popupNodes ?? 0) > 0) return "popup-open-surface"
  if ((after.headerCells ?? 0) > (after.editableRows ?? 0) * 2) {
    return "eager-header-surface"
  }
  if ((after.editableCells ?? 0) > 0) return "editable-body-surface"
  return "global-document-surface"
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
    profileSurfaceTimeoutMs
  )
  if (!scrollerWait.ok) {
    const pageState = await profilePageState(send)
    throw new Error(
      `JSON table scroller did not mount: ${JSON.stringify(pageState)}`
    )
  }
  const editableButtonWait = await waitInPage(
    send,
    `[...document.querySelectorAll("button")].some((button) => button.textContent?.includes("Editable"))`,
    profileSurfaceTimeoutMs
  )
  if (!editableButtonWait.ok) {
    const buttonTexts = await profilePageState(send)
    throw new Error(
      `Editable button did not mount: ${JSON.stringify(buttonTexts)}`
    )
  }
  await activateEditableProfile(send)
  console.error("Editable table mounted")
  await sleep(500)
}

async function activateEditableProfile(send) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await clickModeButton(send, "JSON edit mode", "Editable")
    const wait = await waitInPage(
      send,
      `document.querySelectorAll('[data-json-table-editable-cell="true"]').length > 0`,
      profileSurfaceTimeoutMs
    )
    if (wait.ok) return

    const pageState = await profilePageState(send)
    const recovered = await recoverBlankEditableProfile(
      send,
      `editable profile mount attempt ${attempt}`,
      pageState
    )
    if (recovered) return
    await sleep(150)
  }

  throw new Error(
    `Editable JSON table did not mount: ${JSON.stringify(
      await profilePageState(send)
    )}`
  )
}

async function profilePageState(send) {
  return evaluate(
    send,
    `({
      href: location.href,
      readyState: document.readyState,
      title: document.title,
      text: document.body.innerText.slice(0, 1000),
      bodyTextLength: document.body.innerText.length,
      scrollers: document.querySelectorAll('[data-slot="json-table-scroll"]').length,
      editableCells: document.querySelectorAll('[data-json-table-editable-cell="true"]').length,
      buttons: [...document.querySelectorAll("button")].slice(0, 20).map((button) => button.textContent)
    })`
  )
}

function isBlankProfilePage(pageState) {
  return (
    pageState.bodyTextLength === 0 &&
    pageState.scrollers === 0 &&
    pageState.editableCells === 0
  )
}

async function recoverBlankEditableProfile(send, context, pageState) {
  if (!isBlankProfilePage(pageState)) return false

  console.error(
    `Recovering blank editable profile page during ${context}: ${JSON.stringify(
      pageState
    )}`
  )
  await send("Page.reload", { ignoreCache: true })
  await sleep(700)
  await installPage(send)
  await loadEditableProfile(send)
  return true
}

async function waitForEditableProfileSurface(send, context) {
  const wait = await waitInPage(
    send,
    `document.querySelectorAll('[data-json-table-editable-cell="true"]').length > 0`,
    profileSurfaceTimeoutMs
  )
  if (wait.ok) return

  const pageState = await profilePageState(send)
  const recovered = await recoverBlankEditableProfile(send, context, pageState)
  if (recovered) return

  throw new Error(
    `Editable profile surface did not mount during ${context}: ${JSON.stringify(
      pageState
    )}`
  )
}

async function resetProfiler(send) {
  await evaluate(
    send,
    `(() => {
      if (!window.__jsonTableProfiler) {
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
      }
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

async function resetRectProbeCounts(send) {
  await evaluate(
    send,
    `(() => {
      window.__jsonTableRectProbe.count = 0;
      window.__jsonTableRectProbe.bySlot = {};
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

async function waitForEditableCell(
  send,
  fieldPath,
  timeoutMs = editableCellTimeoutMs
) {
  const selector = `[data-field-path="${fieldPath}"]`
  const wait = await waitInPage(
    send,
    `document.querySelector(${JSON.stringify(selector)})`,
    timeoutMs
  )
  if (wait.ok) return

  const pageState = await profilePageState(send)
  const recovered = await recoverBlankEditableProfile(
    send,
    `cell lookup for ${fieldPath}`,
    pageState
  )
  if (recovered) {
    const recoveredWait = await waitInPage(
      send,
      `document.querySelector(${JSON.stringify(selector)})`,
      timeoutMs
    )
    if (recoveredWait.ok) return
  }

  const matchingCells = await evaluate(
    send,
    `document.querySelectorAll(${JSON.stringify(selector)}).length`
  )
  throw new Error(
    `Missing cell ${fieldPath}: ${JSON.stringify({
      ...pageState,
      matchingCells,
    })}`
  )
}

async function editableCellPoint(send, fieldPath) {
  await waitForEditableCell(send, fieldPath)
  return evaluate(
    send,
    `(async () => {
      const cell = document.querySelector('[data-field-path="${fieldPath}"]');
      if (!cell) throw new Error("Missing cell: ${fieldPath}");
      cell.scrollIntoView({ block: "nearest", inline: "center" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const mountedCell = document.querySelector('[data-field-path="${fieldPath}"]');
      if (!mountedCell) throw new Error("Missing cell after scroll: ${fieldPath}");
      const rect = mountedCell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function mountedEditableCellPoint(send, fieldPath) {
  await waitForEditableCell(send, fieldPath)
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

async function editableCellPointByScrolling(send, fieldPath) {
  const scrollerWait = await waitInPage(
    send,
    `document.querySelector('[data-slot="json-table-scroll"]')`,
    3_000
  )
  if (!scrollerWait.ok) {
    const pageState = await evaluate(
      send,
      `({ href: location.href, text: document.body.innerText.slice(0, 1000) })`
    )
    throw new Error(
      `JSON table scroller did not mount before horizontal scan: ${JSON.stringify(pageState)}`
    )
  }

  return evaluate(
    send,
    `(async () => {
      const scroller = document.querySelector('[data-slot="json-table-scroll"]');
      if (!(scroller instanceof HTMLElement)) {
        throw new Error("Missing JSON table scroller");
      }

      const pointForMountedCell = async () => {
        const cell = document.querySelector('[data-field-path="${fieldPath}"]');
        if (!(cell instanceof HTMLElement)) return null;
        cell.scrollIntoView({ block: "nearest", inline: "center" });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const rect = cell.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };

      const currentPoint = await pointForMountedCell();
      if (currentPoint) return currentPoint;

      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const step = Math.max(80, Math.floor(scroller.clientWidth * 0.8));
      for (let scrollLeft = 0; scrollLeft <= maxScrollLeft + step; scrollLeft += step) {
        scroller.scrollLeft = Math.min(scrollLeft, maxScrollLeft);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const point = await pointForMountedCell();
        if (point) return point;
      }

      throw new Error("Missing cell after horizontal scan: ${fieldPath}");
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

async function calendarNextMonthPoint(send) {
  return evaluate(
    send,
    `(() => {
      const button = document.querySelector('[data-slot="calendar"] .rdp-button_next');
      if (!(button instanceof HTMLElement)) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function calendarCommitDatePoint(send) {
  const buttonWait = await waitInPage(
    send,
    `document.querySelector('[data-slot="calendar"] button[data-day]')`,
    5_000
  )
  if (!buttonWait.ok) {
    const calendarState = await evaluate(
      send,
      `(() => {
        const calendar = document.querySelector('[data-slot="calendar"]');
        return {
          calendars: document.querySelectorAll('[data-slot="calendar"]').length,
          dayButtons: document.querySelectorAll('[data-slot="calendar"] button[data-day]').length,
          html: calendar?.outerHTML.slice(0, 1000) ?? null
        };
      })()`
    )
    throw new Error(
      `No date commit button mounted: ${JSON.stringify(calendarState)}`
    )
  }

  return evaluate(
    send,
    `(() => {
      const buttons = [...document.querySelectorAll('[data-slot="calendar"] button[data-day]')];
      const visibleButtons = buttons.filter((button) => {
        if (!(button instanceof HTMLButtonElement)) return false;
        if (button.disabled) return false;
        if (button.getAttribute("data-selected-single") === "true") return false;
        if (button.getAttribute("aria-selected") === "true") return false;
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const button = visibleButtons[0];
      if (!(button instanceof HTMLElement)) {
        throw new Error(
          "No date commit button found: " +
            JSON.stringify({
              dayButtons: buttons.length,
              enabledVisibleButtons: visibleButtons.length,
            })
        );
      }
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  )
}

async function clickCallbackChurnButton(send) {
  await evaluate(
    send,
    `(() => {
      const button = document.querySelector('[data-json-table-profile-callback-version]');
      if (!(button instanceof HTMLElement)) throw new Error("No callback churn button found");
      button.click();
    })()`
  )
}

async function clickOutsideTable(send) {
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 4,
    y: 4,
    button: "none",
  })
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 4,
    y: 4,
    button: "left",
    clickCount: 1,
  })
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 4,
    y: 4,
    button: "left",
    clickCount: 1,
  })
}

async function setFocusedInputValue(send, value, fieldPath) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await evaluate(
      send,
      `(() => {
      const activeElement = document.activeElement;
      const input = activeElement instanceof HTMLInputElement
        ? activeElement
        : document.querySelector('input[data-mode="edit"]');
      if (!(input instanceof HTMLInputElement)) {
        return { ok: false };
      }
      input.focus({ preventScroll: true });
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      valueSetter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${JSON.stringify(value)} }));
      return { ok: true };
    })()`
    )
    if (result?.ok) return
    if (!fieldPath) break

    await focusEditableCell(send, fieldPath)
    await pressEnter(send)
    await waitInPage(
      send,
      `document.querySelector('input[data-mode="edit"]') instanceof HTMLInputElement`,
      1_000
    ).catch(() => undefined)
    await sleep(100)
  }

  throw new Error(
    fieldPath ? `No focused input for ${fieldPath}` : "No focused input"
  )
}

async function typeFocusedInputText(send, text) {
  await send("Input.insertText", { text })
}

async function focusEditableCell(send, fieldPath) {
  await evaluate(
    send,
    `(() => {
      const cell = document.querySelector('[data-field-path="${fieldPath}"]');
      if (!(cell instanceof HTMLElement)) throw new Error("Missing cell: ${fieldPath}");
      const surface = cell.querySelector('[data-slot="data-cell"]');
      (surface instanceof HTMLElement ? surface : cell).focus({ preventScroll: true });
    })()`
  )
}

async function pressEnter(send) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  })
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  })
}

async function pressEscape(send) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  })
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  })
}

async function pressSpace(send) {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: " ",
    code: "Space",
    windowsVirtualKeyCode: 32,
  })
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: " ",
    code: "Space",
    windowsVirtualKeyCode: 32,
  })
}

async function scrollJsonTable(send, deltaY) {
  const scrollerWait = await waitInPage(
    send,
    `document.querySelector('[data-slot="json-table-scroll"]')`,
    3_000
  )
  if (!scrollerWait.ok) {
    const pageState = await evaluate(
      send,
      `({
        href: location.href,
        text: document.body.innerText.slice(0, 1000),
        scrollers: document.querySelectorAll('[data-slot="json-table-scroll"]').length
      })`
    )
    throw new Error(`Missing JSON table scroller: ${JSON.stringify(pageState)}`)
  }

  await evaluate(
    send,
    `(() => {
      const scroller = document.querySelector('[data-slot="json-table-scroll"]');
      if (!(scroller instanceof HTMLElement)) {
        throw new Error("Missing JSON table scroller");
      }
      window.__jsonTableScrollBefore = scroller.scrollTop;
      scroller.scrollTop += ${JSON.stringify(deltaY)};
    })()`
  )
}

async function scrollJsonTableToTop(send) {
  await evaluate(
    send,
    `(() => {
      const scroller = document.querySelector('[data-slot="json-table-scroll"]');
      if (!(scroller instanceof HTMLElement)) {
        throw new Error("Missing JSON table scroller");
      }
      scroller.scrollTop = 0;
    })()`
  )
  await waitInPage(
    send,
    `document.querySelector('[data-field-path="${textFieldPath}"]')`,
    3_000
  )
}

async function mountedSurfaceSnapshot(send) {
  return evaluate(
    send,
    `(() => {
      const headerTable = document.querySelector('[data-slot="table"]');
      const bodyScroller = document.querySelector('[data-slot="json-table-scroll"]');
      const bodyTable = bodyScroller?.querySelector('[data-slot="table"]');
      const popupSelectors = [
        '[data-slot="data-cell-select-popup"]',
        '[data-slot="data-cell-picker-popup"]',
        '[data-slot="calendar"]',
        '[data-slot="select-popup"]',
        '[data-slot="select-positioner"]',
        '[data-slot="select-list"]'
      ];
      const popups = popupSelectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)]
      );
      const popupNodeSet = new Set();
      for (const popup of popups) {
        popupNodeSet.add(popup);
        for (const node of popup.querySelectorAll("*")) popupNodeSet.add(node);
      }

      return {
        headerRows: headerTable?.querySelectorAll("thead tr").length ?? 0,
        headerCells: headerTable?.querySelectorAll("thead th:not([data-json-table-header-spacer='true'])").length ?? 0,
        headerSpacers: headerTable?.querySelectorAll("thead th[data-json-table-header-spacer='true']").length ?? 0,
        bodyRows: bodyTable?.querySelectorAll("tbody tr").length ?? 0,
        bodyCells: bodyTable?.querySelectorAll("tbody td").length ?? 0,
        editableRows: bodyTable?.querySelectorAll("tbody tr:has([data-json-table-editable-cell='true'])").length ?? 0,
        editableCells: bodyTable?.querySelectorAll("[data-json-table-editable-cell='true']").length ?? 0,
        activeEditableCells: bodyTable?.querySelectorAll("[data-json-table-editable-cell='true'][data-active='true']").length ?? 0,
        dataCellSurfaces: bodyTable?.querySelectorAll('[data-slot="data-cell"]').length ?? 0,
        selectPopups: document.querySelectorAll('[data-slot="data-cell-select-popup"]').length,
        pickerPopups: document.querySelectorAll('[data-slot="data-cell-picker-popup"]').length,
        calendars: document.querySelectorAll('[data-slot="calendar"]').length,
        popupNodes: popupNodeSet.size,
        documentNodes: document.querySelectorAll("*").length
      };
    })()`
  )
}

async function summarizeScenario(
  send,
  beforeMetrics,
  mountedSurfaceBefore,
  mountedSurfaceAfter,
  endedAt,
  afterMetrics,
  wait
) {
  const summary = await evaluate(
    send,
    `(() => {
      const profiler = window.__jsonTableProfiler ?? {
        events: [],
        renders: {
          total: 0,
          byComponent: {},
          byInstance: {},
          changedProps: {}
        }
      };
      const reactCommits = profiler.events.filter((event) => event.type === "react-commit");
      const marks = profiler.events.filter((event) => event.type === "mark");
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
          },
          markCounts: Object.fromEntries(
            [...new Set(marks.map((event) => event.name))]
              .sort()
              .map((name) => [name, marks.filter((event) => event.name === name).length])
          )
        }
      };
    })()`
  )
  summary.mountedSurface = {
    before: mountedSurfaceBefore,
    after: mountedSurfaceAfter,
    delta: mountedSurfaceDelta(mountedSurfaceBefore, mountedSurfaceAfter),
  }
  summary.wait = wait
  summary.elapsedMs = endedAt
  summary.metricsDelta = metricDelta(beforeMetrics, afterMetrics)
  summary.browserCost = browserCostSummary(
    summary.metricsDelta,
    summary.profiler.reactCommits.totalActualDurationMs
  )
  summary.styleAttributionHint = styleAttributionHint(summary)
  return summary
}

async function runScenario(page, name, action, waitExpression) {
  const send = page.send
  console.error(`Running scenario: ${name}`)
  await waitForEditableProfileSurface(send, `${name} preflight`)
  await resetProfiler(send)
  const beforeMetrics = performanceMetrics(await send("Performance.getMetrics"))
  const mountedSurfaceBefore = await mountedSurfaceSnapshot(send)
  const startedAt = await evaluate(send, "performance.now()")
  const trace = await startScenarioTrace(page)
  await action()
  const wait = await waitInPage(send, waitExpression, 5_000)
  const endedAt =
    (await evaluate(send, "performance.now()")) - Number(startedAt)
  const afterMetrics = performanceMetrics(await send("Performance.getMetrics"))
  const mountedSurfaceAfter = await mountedSurfaceSnapshot(send)
  const traceSummary = await trace?.stop()
  const summary = await summarizeScenario(
    send,
    beforeMetrics,
    mountedSurfaceBefore,
    mountedSurfaceAfter,
    endedAt,
    afterMetrics,
    wait
  )
  if (traceSummary) summary.trace = traceSummary
  await restoreRectProbe(send)
  console.error(`Finished scenario: ${name}`)
  return { name, ...summary }
}

async function runSelectedScenario(
  scenarios,
  page,
  name,
  action,
  waitExpression
) {
  if (shouldProfileScenario(name)) {
    scenarios.push(await runScenario(page, name, action, waitExpression))
    return
  }

  console.error(`Executing unprofiled scenario: ${name}`)
  await waitForEditableProfileSurface(page.send, `${name} unprofiled preflight`)
  await resetProfiler(page.send)
  await action()
  const wait = await waitInPage(page.send, waitExpression, 3_000)
  await restoreRectProbe(page.send)
  if (!wait.ok) {
    throw new Error(`${name} did not complete while scenario-filtered`)
  }
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
    await send("Page.navigate", { url: targetConfig.url })
    await sleep(700)
    await installPage(send)
    await loadEditableProfile(send)

    const scenarios = []
    const enumPoint = await mountedEditableCellPoint(send, enumFieldPath)

    await runSelectedScenario(
      scenarios,
      page,
      "hover-enum",
      async () => {
        await send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: enumPoint.x,
          y: enumPoint.y,
          button: "none",
        })
      },
      "true"
    )

    await runSelectedScenario(
      scenarios,
      page,
      "open-enum",
      async () => {
        await clickPoint(send, enumPoint)
      },
      `Boolean(document.querySelector('[data-slot="data-cell-select-popup"] [role="option"]'))`
    )

    await pressEscape(send)
    await sleep(200)
    await runSelectedScenario(
      scenarios,
      page,
      "close-select-with-escape",
      async () => {
        const point = await editableCellPoint(send, enumFieldPath)
        await clickPoint(send, point)
        await waitInPage(
          send,
          `Boolean(document.querySelector('[data-slot="data-cell-select-popup"] [role="option"]'))`,
          3_000
        )
        await pressEscape(send)
      },
      `!document.querySelector('[data-slot="data-cell-select-popup"]')`
    )

    const focusTextPoint = await editableCellPoint(send, textFieldPath)
    await sleep(200)
    await runSelectedScenario(
      scenarios,
      page,
      "focus-text",
      async () => {
        await clickPoint(send, focusTextPoint)
      },
      `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`
    )

    await pressEscape(send)
    await sleep(200)
    const typeTextPoint = await editableCellPoint(send, textFieldPath)
    await clickPoint(send, typeTextPoint)
    await waitInPage(
      send,
      `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
      3_000
    )
    await runSelectedScenario(
      scenarios,
      page,
      "type-first-character",
      async () => {
        await typeFocusedInputText(send, "x")
      },
      `document.activeElement instanceof HTMLInputElement && document.activeElement.value.includes("x")`
    )

    await pressEscape(send)
    await sleep(200)
    await runSelectedScenario(
      scenarios,
      page,
      "cancel-text-edit",
      async () => {
        const point = await editableCellPoint(send, textFieldPath)
        await clickPoint(send, point)
        await waitInPage(
          send,
          `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
          3_000
        )
        await setFocusedInputValue(
          send,
          "profile cancelled text",
          textFieldPath
        )
        await pressEscape(send)
      },
      `document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
    )

    const commitTextPoint = await editableCellPoint(send, textFieldPath)
    await clickPoint(send, commitTextPoint)
    await waitInPage(
      send,
      `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
      3_000
    )
    await setFocusedInputValue(send, "profile text commit", textFieldPath)
    await runSelectedScenario(
      scenarios,
      page,
      "commit-text",
      async () => {
        await pressEnter(send)
      },
      `(window.__jsonTableProfiler?.events ?? []).some((event) => event.type === "mark" && event.name === "document-patch-start") && document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
    )

    await runSelectedScenario(
      scenarios,
      page,
      "blur-commit-number",
      async () => {
        const point = await editableCellPoint(send, numberFieldPath)
        await clickPoint(send, point)
        await waitInPage(
          send,
          `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "number"`,
          3_000
        )
        await setFocusedInputValue(send, "1001.25", numberFieldPath)
        await clickOutsideTable(send)
      },
      `(window.__jsonTableProfiler?.events ?? []).some((event) => event.type === "mark" && event.name === "document-patch-start") && document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
    )

    await runSelectedScenario(
      scenarios,
      page,
      "rapid-text-commits",
      async () => {
        await focusEditableCell(send, textFieldPath)
        await pressEnter(send)
        await waitInPage(
          send,
          `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
          3_000
        )
        await setFocusedInputValue(
          send,
          "profile rapid text one",
          textFieldPath
        )
        await pressEnter(send)
        await waitInPage(
          send,
          `document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`,
          3_000
        )
        await focusEditableCell(send, textFieldPath)
        await pressEnter(send)
        await waitInPage(
          send,
          `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
          3_000
        )
        await setFocusedInputValue(
          send,
          "profile rapid text two",
          textFieldPath
        )
        await pressEnter(send)
      },
      `((window.__jsonTableProfiler?.events ?? []).filter((event) => event.type === "mark" && event.name === "document-patch-start").length === 2) && document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
    )

    const commitNumberPoint = await editableCellPoint(send, numberFieldPath)
    await clickPoint(send, commitNumberPoint)
    await waitInPage(
      send,
      `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "number"`,
      3_000
    )
    await setFocusedInputValue(send, "999.5", numberFieldPath)
    await runSelectedScenario(
      scenarios,
      page,
      "commit-number",
      async () => {
        await pressEnter(send)
      },
      `(window.__jsonTableProfiler?.events ?? []).some((event) => event.type === "mark" && event.name === "document-patch-start") && document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
    )

    await runSelectedScenario(
      scenarios,
      page,
      "close-date-with-outside-click",
      async () => {
        const point = await editableCellPointByScrolling(send, dateFieldPath)
        await clickPoint(send, point)
        await waitInPage(
          send,
          `Boolean(document.querySelector('[data-slot="calendar"]'))`,
          3_000
        )
        await clickOutsideTable(send)
      },
      `!document.querySelector('[data-slot="data-cell-picker-popup"]')`
    )

    await runSelectedScenario(
      scenarios,
      page,
      "open-and-commit-date",
      async () => {
        const point = await editableCellPointByScrolling(send, dateFieldPath)
        await clickPoint(send, point)
        await waitInPage(
          send,
          `Boolean(document.querySelector('[data-slot="calendar"]'))`,
          3_000
        )
        const dateCommitPoint = await calendarCommitDatePoint(send)
        await resetRectProbeCounts(send)
        await clickPoint(send, dateCommitPoint)
      },
      `!document.querySelector('[data-slot="data-cell-picker-popup"]')`
    )

    const booleanPoint = await editableCellPoint(send, booleanFieldPath)
    await runSelectedScenario(
      scenarios,
      page,
      "toggle-boolean",
      async () => {
        await clickPoint(send, booleanPoint)
        const patched = await waitInPage(
          send,
          `(window.__jsonTableProfiler?.events ?? []).some((event) => event.type === "mark" && event.name === "document-patch-start")`,
          250
        )
        if (!patched.ok) await pressSpace(send)
      },
      `(window.__jsonTableProfiler?.events ?? []).some((event) => event.type === "mark" && event.name === "document-patch-start")`
    )

    await runSelectedScenario(
      scenarios,
      page,
      "open-date",
      async () => {
        const datePoint = await editableCellPoint(send, dateFieldPath)
        await clickPoint(send, datePoint)
      },
      `Boolean(document.querySelector('[data-slot="calendar"]'))`
    )

    const nextMonthPoint = await calendarNextMonthPoint(send)
    if (nextMonthPoint) {
      await runSelectedScenario(
        scenarios,
        page,
        "navigate-date-month",
        async () => {
          await clickPoint(send, nextMonthPoint)
        },
        `Boolean(document.querySelector('[data-slot="calendar"]'))`
      )
    }

    await pressEscape(send)
    await sleep(200)
    await runSelectedScenario(
      scenarios,
      page,
      "scroll-idle",
      async () => {
        await scrollJsonTable(send, 48)
      },
      `(() => {
          const scroller = document.querySelector('[data-slot="json-table-scroll"]');
          return scroller instanceof HTMLElement && scroller.scrollTop !== window.__jsonTableScrollBefore;
        })()`
    )

    await sleep(200)
    await scrollJsonTableToTop(send)
    await sleep(200)
    const overlayDatePoint = await editableCellPointByScrolling(
      send,
      dateFieldPath
    )
    await clickPoint(send, overlayDatePoint)
    await waitInPage(
      send,
      `Boolean(document.querySelector('[data-slot="calendar"]'))`,
      3_000
    )
    await runSelectedScenario(
      scenarios,
      page,
      "scroll-with-overlay",
      async () => {
        await scrollJsonTable(send, 1)
      },
      `(() => {
          const scroller = document.querySelector('[data-slot="json-table-scroll"]');
          return scroller instanceof HTMLElement && scroller.scrollTop !== window.__jsonTableScrollBefore;
        })()`
    )

    await pressEscape(send)
    await sleep(200)
    await scrollJsonTableToTop(send)
    await sleep(200)
    await focusEditableCell(send, textFieldPath)
    await pressEnter(send)
    await waitInPage(
      send,
      `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
      3_000
    )
    await setFocusedInputValue(send, "profile dirty switch text", textFieldPath)
    const switchNumberPoint = await mountedEditableCellPoint(
      send,
      numberFieldPath
    )
    await runSelectedScenario(
      scenarios,
      page,
      "switch-dirty-cell",
      async () => {
        await clickPoint(send, switchNumberPoint)
      },
      `(window.__jsonTableProfiler?.events ?? []).some((event) => event.type === "mark" && event.name === "document-patch-start") && document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "number"`
    )

    await pressEscape(send)
    await sleep(200)
    await runSelectedScenario(
      scenarios,
      page,
      "parent-callback-churn",
      async () => {
        await clickCallbackChurnButton(send)
      },
      `document.querySelector('[data-json-table-profile-callback-version]')?.getAttribute('data-json-table-profile-callback-version') !== "0"`
    )

    await runSelectedScenario(
      scenarios,
      page,
      "post-churn-text-commit",
      async () => {
        await focusEditableCell(send, textFieldPath)
        await pressEnter(send)
        await waitInPage(
          send,
          `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
          3_000
        )
        await setFocusedInputValue(
          send,
          "profile post churn text",
          textFieldPath
        )
        await pressEnter(send)
      },
      `document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
    )

    if (targetConfig.name.startsWith("large")) {
      await pressEscape(send)
      await sleep(200)
      const farEnumPoint = await editableCellPointByScrolling(
        send,
        farEnumFieldPath
      )
      await runSelectedScenario(
        scenarios,
        page,
        "open-far-enum",
        async () => {
          await clickPoint(send, farEnumPoint)
        },
        `Boolean(document.querySelector('[data-slot="data-cell-select-popup"] [role="option"]'))`
      )

      await pressEscape(send)
      await sleep(200)
      const farDatePoint = await editableCellPointByScrolling(
        send,
        farDateFieldPath
      )
      await runSelectedScenario(
        scenarios,
        page,
        "open-far-date",
        async () => {
          await clickPoint(send, farDatePoint)
        },
        `Boolean(document.querySelector('[data-slot="calendar"]'))`
      )

      await pressEscape(send)
      await sleep(200)
      const farTextPoint = await editableCellPointByScrolling(
        send,
        farTextFieldPath
      )
      await runSelectedScenario(
        scenarios,
        page,
        "commit-far-text",
        async () => {
          await clickPoint(send, farTextPoint)
          await waitInPage(
            send,
            `document.activeElement instanceof HTMLInputElement && document.activeElement.getAttribute("data-kind") === "text"`,
            3_000
          )
          await setFocusedInputValue(
            send,
            "profile far text commit",
            farTextFieldPath
          )
          await pressEnter(send)
        },
        `document.querySelectorAll('[data-json-table-editable-cell="true"][data-active="true"]').length === 0`
      )
    }

    return {
      name: targetConfig.name,
      route: targetConfig.url,
      scenarios,
    }
  } finally {
    try {
      page.socket.close()
    } catch {}
    await closeChromeTarget(chromeEndpoint, target.id)
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

function assertSingleDocumentPatch(profileLabel, scenario) {
  assertDocumentPatchCount(profileLabel, scenario, 1)
}

function assertDocumentPatchCount(profileLabel, scenario, expectedCount) {
  const startCount = scenario.profiler.markCounts["document-patch-start"] ?? 0
  const endCount = scenario.profiler.markCounts["document-patch-end"] ?? 0
  assertScenario(
    startCount === expectedCount && endCount === expectedCount,
    `${profileLabel}${scenario.name}: expected ${expectedCount} document patch(es), got start=${startCount}, end=${endCount}`
  )
}

function assertScalarCommitScenario(profileLabel, scenario, fieldPath) {
  assertScenario(
    scenario?.wait.ok,
    `${profileLabel}${scenario?.name ?? fieldPath} did not complete`
  )
  assertOnlyTargetEditableCellRendered(scenario, fieldPath)
  assertNoTableOrRowRender(scenario)
  assertSingleDocumentPatch(profileLabel, scenario)
}

function assertLocalNoCommitScenario(profileLabel, scenario, fieldPath) {
  assertScenario(
    scenario?.wait.ok,
    `${profileLabel}${scenario?.name ?? fieldPath} did not complete`
  )
  assertOnlyTargetEditableCellRendered(scenario, fieldPath)
  assertNoTableOrRowRender(scenario)
  assertDocumentPatchCount(profileLabel, scenario, 0)
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
  const hover = profile.scenarios.find(
    (scenario) => scenario.name === "hover-enum"
  )
  const open = profile.scenarios.find(
    (scenario) => scenario.name === "open-enum"
  )
  const closeSelect = profile.scenarios.find(
    (scenario) => scenario.name === "close-select-with-escape"
  )
  const cancelText = profile.scenarios.find(
    (scenario) => scenario.name === "cancel-text-edit"
  )
  const focusText = profile.scenarios.find(
    (scenario) => scenario.name === "focus-text"
  )
  const typeFirstCharacter = profile.scenarios.find(
    (scenario) => scenario.name === "type-first-character"
  )
  const textCommit = profile.scenarios.find(
    (scenario) => scenario.name === "commit-text"
  )
  const numberCommit = profile.scenarios.find(
    (scenario) => scenario.name === "commit-number"
  )
  const blurNumberCommit = profile.scenarios.find(
    (scenario) => scenario.name === "blur-commit-number"
  )
  const rapidTextCommit = profile.scenarios.find(
    (scenario) => scenario.name === "rapid-text-commits"
  )
  const dateCommit = profile.scenarios.find(
    (scenario) => scenario.name === "open-and-commit-date"
  )
  const closeDate = profile.scenarios.find(
    (scenario) => scenario.name === "close-date-with-outside-click"
  )
  const checkbox = profile.scenarios.find(
    (scenario) => scenario.name === "toggle-boolean"
  )
  const date = profile.scenarios.find(
    (scenario) => scenario.name === "open-date"
  )
  const dateMonth = profile.scenarios.find(
    (scenario) => scenario.name === "navigate-date-month"
  )
  const parentCallbackChurn = profile.scenarios.find(
    (scenario) => scenario.name === "parent-callback-churn"
  )
  const postChurnTextCommit = profile.scenarios.find(
    (scenario) => scenario.name === "post-churn-text-commit"
  )
  const farEnum = profile.scenarios.find(
    (scenario) => scenario.name === "open-far-enum"
  )
  const farDate = profile.scenarios.find(
    (scenario) => scenario.name === "open-far-date"
  )
  const farTextCommit = profile.scenarios.find(
    (scenario) => scenario.name === "commit-far-text"
  )
  const scrollIdle = profile.scenarios.find(
    (scenario) => scenario.name === "scroll-idle"
  )
  const scrollWithOverlay = profile.scenarios.find(
    (scenario) => scenario.name === "scroll-with-overlay"
  )
  const switchDirtyCell = profile.scenarios.find(
    (scenario) => scenario.name === "switch-dirty-cell"
  )
  const label = `${profile.name}: `

  assertScenario(hover?.wait.ok, `${label}hover-enum did not complete`)
  assertScenario(
    hover.rectProbe.count === 0,
    `${label}hover-enum expected 0 rect reads, got ${hover.rectProbe.count}`
  )
  assertNoTableOrRowRender(hover)

  assertScenario(open?.wait.ok, `${label}open-enum did not complete`)
  assertScenario(
    open.popupMounted,
    `${label}open-enum did not mount select popup`
  )
  assertScenario(
    !open.baseUiSelectMounted,
    `${label}open-enum mounted Base UI select`
  )
  assertScenario(
    open.rectProbe.count === 1,
    `${label}open-enum expected exactly 1 rect read, got ${open.rectProbe.count}`
  )
  assertOnlyTargetEditableCellRendered(open, enumFieldPath)
  assertNoTableOrRowRender(open)

  assertScenario(
    closeSelect?.wait.ok,
    `${label}close-select-with-escape did not complete`
  )
  assertDocumentPatchCount(label, closeSelect, 0)

  assertLocalNoCommitScenario(label, focusText, textFieldPath)
  assertLocalNoCommitScenario(label, typeFirstCharacter, textFieldPath)
  assertScenario(
    cancelText?.wait.ok,
    `${label}cancel-text-edit did not complete`
  )
  assertDocumentPatchCount(label, cancelText, 0)
  assertScalarCommitScenario(label, textCommit, textFieldPath)
  assertScalarCommitScenario(label, numberCommit, numberFieldPath)
  assertScenario(
    blurNumberCommit?.wait.ok,
    `${label}blur-commit-number did not complete`
  )
  assertDocumentPatchCount(label, blurNumberCommit, 1)
  assertScenario(
    rapidTextCommit?.wait.ok,
    `${label}rapid-text-commits did not complete`
  )
  assertDocumentPatchCount(label, rapidTextCommit, 2)
  assertScenario(
    dateCommit?.wait.ok,
    `${label}open-and-commit-date did not complete`
  )
  assertDocumentPatchCount(label, dateCommit, 1)
  assertScenario(
    closeDate?.wait.ok,
    `${label}close-date-with-outside-click did not complete`
  )
  assertDocumentPatchCount(label, closeDate, 0)

  assertScenario(checkbox?.wait.ok, `${label}toggle-boolean did not complete`)
  assertOnlyTargetEditableCellRendered(checkbox, booleanFieldPath)
  assertNoTableOrRowRender(checkbox)
  assertSingleDocumentPatch(label, checkbox)

  assertScenario(date?.wait.ok, `${label}open-date did not complete`)
  assertScenario(
    date.pickerPopupMounted,
    `${label}open-date did not mount picker popup`
  )
  assertScenario(
    date.calendarMounted,
    `${label}open-date did not mount calendar`
  )
  assertScenario(
    date.rectProbe.count <= 2,
    `${label}open-date expected <= 2 rect reads, got ${date.rectProbe.count}`
  )
  assertScenario(
    (date.rectProbe.bySlot["data-cell"] ?? 0) <= 2,
    `${label}open-date expected <= 2 data-cell rect reads, got ${
      date.rectProbe.bySlot["data-cell"] ?? 0
    }`
  )
  assertOnlyTargetEditableCellRendered(date, dateFieldPath)
  assertNoTableOrRowRender(date)
  assertScenario(
    date.metricsDelta.Nodes <= maxDateOpenNodeDelta,
    `${label}open-date expected <= ${maxDateOpenNodeDelta} new nodes, got ${date.metricsDelta.Nodes}`
  )
  assertScenario(
    date.metricsDelta.LayoutDurationMs <= maxDateOpenLayoutDurationMs,
    `${label}open-date expected <= ${maxDateOpenLayoutDurationMs}ms layout, got ${date.metricsDelta.LayoutDurationMs.toFixed(
      2
    )}ms`
  )

  if (dateMonth) {
    assertScenario(
      dateMonth.wait.ok,
      `${label}navigate-date-month did not complete`
    )
    assertScenario(
      dateMonth.calendarMounted,
      `${label}navigate-date-month did not keep calendar mounted`
    )
    assertScenario(
      dateMonth.rectProbe.count === 0,
      `${label}navigate-date-month expected 0 rect reads, got ${dateMonth.rectProbe.count}`
    )
  }

  assertScenario(scrollIdle?.wait.ok, `${label}scroll-idle did not complete`)

  assertScenario(
    scrollWithOverlay?.wait.ok,
    `${label}scroll-with-overlay did not complete`
  )

  assertScenario(
    switchDirtyCell?.wait.ok,
    `${label}switch-dirty-cell did not complete`
  )
  for (const renderedCellName of editableCellRenderNames(switchDirtyCell)) {
    assertScenario(
      [
        `EditableJsonTableCell:${textFieldPath}`,
        `EditableJsonTableCell:${numberFieldPath}`,
      ].includes(renderedCellName),
      `${label}switch-dirty-cell rendered unrelated cell: ${renderedCellName}`
    )
  }
  assertNoTableOrRowRender(switchDirtyCell)
  assertSingleDocumentPatch(label, switchDirtyCell)

  assertScenario(
    parentCallbackChurn?.wait.ok,
    `${label}parent-callback-churn did not complete`
  )
  assertScenario(
    postChurnTextCommit?.wait.ok,
    `${label}post-churn-text-commit did not complete`
  )
  assertDocumentPatchCount(label, postChurnTextCommit, 1)

  if (profile.name.startsWith("large")) {
    assertScenario(farEnum?.wait.ok, `${label}open-far-enum did not complete`)
    assertScenario(
      farEnum.popupMounted,
      `${label}open-far-enum did not mount select popup`
    )
    assertOnlyTargetEditableCellRendered(farEnum, farEnumFieldPath)
    assertNoTableOrRowRender(farEnum)
    assertDocumentPatchCount(label, farEnum, 0)

    assertScenario(farDate?.wait.ok, `${label}open-far-date did not complete`)
    assertScenario(
      farDate.calendarMounted,
      `${label}open-far-date did not mount calendar`
    )
    assertOnlyTargetEditableCellRendered(farDate, farDateFieldPath)
    assertNoTableOrRowRender(farDate)
    assertDocumentPatchCount(label, farDate, 0)

    assertScalarCommitScenario(label, farTextCommit, farTextFieldPath)
  }
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
    await closeProfileTargets(chromeEndpoint)
    const runs = []
    let profiles = []

    for (let warmupIndex = 0; warmupIndex < warmupCount; warmupIndex += 1) {
      for (const target of profileTargets()) {
        await runProfileTarget(chromeEndpoint, target)
      }
    }

    for (let runIndex = 0; runIndex < repeatCount; runIndex += 1) {
      profiles = []
      for (const target of profileTargets()) {
        profiles.push(await runProfileTarget(chromeEndpoint, target))
      }

      const runReport = {
        measuredAt: new Date().toISOString(),
        profiles,
        scenarios: profiles[0]?.scenarios ?? [],
      }
      if (assertMode) assertReport(runReport)
      runs.push({
        runIndex,
        ...runReport,
      })
    }

    const report = {
      measuredAt: new Date().toISOString(),
      repeatCount,
      warmupCount,
      traceMode,
      ...(profileTargetNames ? { targetFilter: [...profileTargetNames] } : {}),
      ...(profileScenarioNames
        ? { scenarioFilter: [...profileScenarioNames] }
        : {}),
      ...(traceMode ? { traceCategories } : {}),
      profiles,
      scenarios: profiles[0]?.scenarios ?? [],
      ...(repeatCount > 1
        ? {
            runs,
            repeatedScenarios: buildRepeatedProfileSummary(runs),
          }
        : {}),
    }

    assertSelectedScenarioNamesMatched(report)
    await mkdir("tmp", { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    if (verboseOutput) console.log(JSON.stringify(report, null, 2))
    if (repeatCount > 1) printRepeatedProfileSummary(report)
    if (styleExperimentMode) printStyleExperimentSummary(report)
    console.log(`Wrote ${outputPath}`)
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
