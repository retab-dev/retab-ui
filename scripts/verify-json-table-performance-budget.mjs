import { readFile } from "node:fs/promises"

const budgetPath =
  process.env.JSON_TABLE_PERFORMANCE_BUDGET ??
  "components/json-table/json-table-performance-budget.json"
const reportPath =
  process.env.JSON_TABLE_PERFORMANCE_REPORT ??
  "tmp/json-table-primitive-interactions-profile.json"

function fail(message) {
  throw new Error(message)
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    fail(`Could not read ${path}: ${detail}`)
  }
}

function scenarioByName(profile, name) {
  return profile.scenarios?.find((scenario) => scenario.name === name)
}

function renderedComponentCount(scenario, componentName) {
  return (
    scenario.profiler?.renders?.byComponent?.find(
      (entry) => entry.name === componentName
    )?.count ?? 0
  )
}

function renderedEditableCellPaths(scenario) {
  return (scenario.profiler?.renders?.byInstance ?? [])
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("EditableJsonTableCell:"))
    .map((name) => ({
      fieldPath: name.slice("EditableJsonTableCell:".length),
      count: scenario.profiler.renders.byInstance.find(
        (entry) => entry.name === name
      )?.count,
    }))
}

function markCount(scenario, markName) {
  return scenario.profiler?.markCounts?.[markName] ?? 0
}

function assertMax(profileName, scenarioName, label, value, maxValue) {
  if (maxValue === undefined) return
  if (value > maxValue) {
    fail(
      `${profileName}: ${scenarioName} ${label} ${formatNumber(
        value
      )} exceeds ${formatNumber(maxValue)}`
    )
  }
}

function assertBoolean(profileName, scenarioName, label, value, expected) {
  if (expected === undefined) return
  if (Boolean(value) !== expected) {
    fail(`${profileName}: ${scenarioName} expected ${label}=${expected}`)
  }
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function scenarioBudgetCategory(budget, categoryName) {
  return budget[categoryName] && typeof budget[categoryName] === "object"
    ? budget[categoryName]
    : {}
}

function scenarioFlatBudget(budget) {
  const { diagnostic, hard, latency, ...flatBudget } = budget
  return flatBudget
}

function normalizedScenarioBudget(budget) {
  return {
    ...scenarioFlatBudget(budget),
    ...scenarioBudgetCategory(budget, "latency"),
    ...scenarioBudgetCategory(budget, "hard"),
    ...scenarioBudgetCategory(budget, "diagnostic"),
  }
}

function assertScenarioBudget(profileName, scenarioName, scenario, budget) {
  if (!scenario) fail(`${profileName}: missing ${scenarioName} scenario`)
  if (!scenario.wait?.ok)
    fail(`${profileName}: ${scenarioName} did not complete`)
  const normalizedBudget = normalizedScenarioBudget(budget)

  const elapsedMs = scenario.elapsedMs ?? Number.POSITIVE_INFINITY
  assertMax(
    profileName,
    scenarioName,
    "elapsed ms",
    elapsedMs,
    normalizedBudget.maxElapsedMs
  )

  const editableCellRenders = renderedComponentCount(
    scenario,
    "EditableJsonTableCell"
  )
  assertMax(
    profileName,
    scenarioName,
    "EditableJsonTableCell renders",
    editableCellRenders,
    normalizedBudget.maxEditableCellRenders
  )

  const reactCommits = scenario.profiler?.reactCommits?.count ?? 0
  assertMax(
    profileName,
    scenarioName,
    "React commits",
    reactCommits,
    normalizedBudget.maxReactCommits
  )

  const rectReads = scenario.rectProbe?.count ?? 0
  assertMax(
    profileName,
    scenarioName,
    "rect reads",
    rectReads,
    normalizedBudget.maxRectReads
  )

  for (const componentName of normalizedBudget.forbiddenRenderedComponents ??
    []) {
    const count = renderedComponentCount(scenario, componentName)
    if (count > 0) {
      fail(
        `${profileName}: ${scenarioName} rendered ${componentName} ${count} time(s)`
      )
    }
  }

  for (const [componentName, maxCount] of Object.entries(
    normalizedBudget.maxRenderedComponentCounts ?? {}
  )) {
    assertMax(
      profileName,
      scenarioName,
      `${componentName} renders`,
      renderedComponentCount(scenario, componentName),
      maxCount
    )
  }

  const allowedEditableCellRenderFieldPaths =
    normalizedBudget.allowedEditableCellRenderFieldPaths
  if (allowedEditableCellRenderFieldPaths) {
    const unexpected = renderedEditableCellPaths(scenario).filter(
      (entry) => !allowedEditableCellRenderFieldPaths.includes(entry.fieldPath)
    )
    if (unexpected.length > 0) {
      fail(
        `${profileName}: ${scenarioName} rendered sibling editable cell(s): ${unexpected
          .map((entry) => `${entry.fieldPath}=${entry.count}`)
          .join(", ")}`
      )
    }
  }

  assertBoolean(
    profileName,
    scenarioName,
    "popupMounted",
    scenario.popupMounted,
    normalizedBudget.expectPopupMounted
  )
  assertBoolean(
    profileName,
    scenarioName,
    "pickerPopupMounted",
    scenario.pickerPopupMounted,
    normalizedBudget.expectPickerPopupMounted
  )
  assertBoolean(
    profileName,
    scenarioName,
    "calendarMounted",
    scenario.calendarMounted,
    normalizedBudget.expectCalendarMounted
  )

  const documentPatchStarts = markCount(scenario, "document-patch-start")
  const documentPatchEnds = markCount(scenario, "document-patch-end")
  if (normalizedBudget.documentPatchCount !== undefined) {
    if (
      documentPatchStarts !== normalizedBudget.documentPatchCount ||
      documentPatchEnds !== normalizedBudget.documentPatchCount
    ) {
      fail(
        `${profileName}: ${scenarioName} expected ${normalizedBudget.documentPatchCount} document patch(es), got start=${documentPatchStarts}, end=${documentPatchEnds}`
      )
    }
  }

  assertMax(
    profileName,
    scenarioName,
    "DOM node delta",
    scenario.metricsDelta?.Nodes ?? 0,
    normalizedBudget.maxDomNodeDelta
  )
  assertMax(
    profileName,
    scenarioName,
    "layout ms",
    scenario.browserCost?.layout?.durationMs ?? 0,
    normalizedBudget.maxLayoutDurationMs
  )
  assertMax(
    profileName,
    scenarioName,
    "style ms",
    scenario.browserCost?.style?.durationMs ?? 0,
    normalizedBudget.maxStyleDurationMs
  )
  assertMax(
    profileName,
    scenarioName,
    "script ms",
    scenario.browserCost?.scriptDurationMs ?? 0,
    normalizedBudget.maxScriptDurationMs
  )

  return {
    elapsedMs,
    editableCellRenders,
    reactCommits,
    rectReads,
    documentPatches: documentPatchStarts,
    domNodeDelta: scenario.metricsDelta?.Nodes ?? null,
    styleMs: scenario.browserCost?.style?.durationMs ?? null,
    layoutMs: scenario.browserCost?.layout?.durationMs ?? null,
    traceStyleMs: scenario.trace?.styleDurationMs ?? null,
    traceLayoutMs: scenario.trace?.layoutDurationMs ?? null,
    traceScriptMs: scenario.trace?.scriptDurationMs ?? null,
    mountedHeaderCells: scenario.mountedSurface?.after?.headerCells ?? null,
    mountedEditableCells: scenario.mountedSurface?.after?.editableCells ?? null,
    mountedPopupNodes: scenario.mountedSurface?.after?.popupNodes ?? null,
    styleAttributionHint: scenario.styleAttributionHint ?? null,
  }
}

function printSummary(summary) {
  console.log(
    [
      `${summary.profile}/${summary.scenario}`,
      `elapsed=${formatNumber(summary.elapsedMs)}ms`,
      `renders=${summary.editableCellRenders}`,
      `commits=${summary.reactCommits}`,
      `rect=${summary.rectReads}`,
      `patches=${summary.documentPatches}`,
      `nodes=${summary.domNodeDelta ?? "n/a"}`,
      `surface=header:${summary.mountedHeaderCells ?? "n/a"}/body:${summary.mountedEditableCells ?? "n/a"}/popup:${summary.mountedPopupNodes ?? "n/a"}`,
      `owner=${summary.styleAttributionHint ?? "n/a"}`,
      `style=${summary.styleMs === null ? "n/a" : `${formatNumber(summary.styleMs)}ms`}`,
      `layout=${
        summary.layoutMs === null
          ? "n/a"
          : `${formatNumber(summary.layoutMs)}ms`
      }`,
      summary.traceStyleMs === null
        ? null
        : `traceStyle=${formatNumber(summary.traceStyleMs)}ms`,
      summary.traceLayoutMs === null
        ? null
        : `traceLayout=${formatNumber(summary.traceLayoutMs)}ms`,
      summary.traceScriptMs === null
        ? null
        : `traceScript=${formatNumber(summary.traceScriptMs)}ms`,
    ]
      .filter(Boolean)
      .join("  ")
  )
}

async function main() {
  const [budget, report] = await Promise.all([
    readJson(budgetPath),
    readJson(reportPath),
  ])
  const profiles = report.profiles ?? [
    { name: "default", scenarios: report.scenarios ?? [] },
  ]
  const summaries = []

  for (const [profileName, profileBudget] of Object.entries(
    budget.profiles ?? {}
  )) {
    const profile = profiles.find((item) => item.name === profileName)
    if (!profile) fail(`Missing performance profile: ${profileName}`)

    for (const [scenarioName, scenarioBudget] of Object.entries(
      profileBudget
    )) {
      summaries.push({
        profile: profileName,
        scenario: scenarioName,
        ...assertScenarioBudget(
          profileName,
          scenarioName,
          scenarioByName(profile, scenarioName),
          scenarioBudget
        ),
      })
    }
  }

  for (const summary of summaries) printSummary(summary)
  console.log(`ok ${summaries.length} json-table performance scenario(s)`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
