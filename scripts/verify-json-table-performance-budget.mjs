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

function focusedElementLabel(focusedElement) {
  if (!focusedElement) return "none"
  return [
    focusedElement.tagName,
    focusedElement.dataSlot ? `slot=${focusedElement.dataSlot}` : null,
    focusedElement.role ? `role=${focusedElement.role}` : null,
    focusedElement.fieldPath ? `field=${focusedElement.fieldPath}` : null,
    focusedElement.ariaExpanded
      ? `expanded=${focusedElement.ariaExpanded}`
      : null,
  ]
    .filter(Boolean)
    .join("/")
}

function scenarioDiagnosticContext(scenario) {
  const after = scenario.mountedSurface?.after ?? {}
  const readOnlyRowPatcher = scenario.profiler?.readOnlyRowPatcher
  return [
    `owner=${scenario.styleAttributionHint ?? "n/a"}`,
    `surface=header:${after.headerCells ?? "n/a"}/body:${
      after.editableCells ?? "n/a"
    }/popup:${after.popupNodes ?? "n/a"}`,
    `nodes=header:${after.headerNodes ?? "n/a"}/body:${
      after.bodyNodes ?? "n/a"
    }/popup:${after.popupNodes ?? "n/a"}`,
    `css=${after.styleSheets ?? "n/a"}`,
    `active=${after.activeEditableCells ?? "n/a"}`,
    `hover=${after.hoveredEditableCells ?? "n/a"}`,
    `focus=${focusedElementLabel(after.focusedElement)}`,
    readOnlyRowPatcher
      ? `rowPatch=handled:${readOnlyRowPatcher.handledCount ?? 0}/fallback:${
          readOnlyRowPatcher.fallbackCount ?? 0
        }/rows:${readOnlyRowPatcher.rowsPatched ?? 0}/reasons:${JSON.stringify(
          readOnlyRowPatcher.reasons ?? {}
        )}`
      : null,
  ]
    .filter(Boolean)
    .join(" ")
}

function assertScenarioMax(
  profileName,
  scenarioName,
  label,
  value,
  maxValue,
  scenario
) {
  if (maxValue === undefined) return
  if (value > maxValue) {
    fail(
      `${profileName}: ${scenarioName} ${label} ${formatNumber(
        value
      )} exceeds ${formatNumber(maxValue)} (${scenarioDiagnosticContext(
        scenario
      )})`
    )
  }
}

function assertScenarioMin(
  profileName,
  scenarioName,
  label,
  value,
  minValue,
  scenario
) {
  if (minValue === undefined) return
  if (value < minValue) {
    fail(
      `${profileName}: ${scenarioName} ${label} ${formatNumber(
        value
      )} is below ${formatNumber(minValue)} (${scenarioDiagnosticContext(
        scenario
      )})`
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
  assertScenarioMax(
    profileName,
    scenarioName,
    "elapsed ms",
    elapsedMs,
    normalizedBudget.maxElapsedMs,
    scenario
  )

  const editableCellRenders = renderedComponentCount(
    scenario,
    "EditableJsonTableCell"
  )
  assertScenarioMax(
    profileName,
    scenarioName,
    "EditableJsonTableCell renders",
    editableCellRenders,
    normalizedBudget.maxEditableCellRenders,
    scenario
  )

  const reactCommits = scenario.profiler?.reactCommits?.count ?? 0
  assertScenarioMax(
    profileName,
    scenarioName,
    "React commits",
    reactCommits,
    normalizedBudget.maxReactCommits,
    scenario
  )

  const rectReads = scenario.rectProbe?.count ?? 0
  assertScenarioMax(
    profileName,
    scenarioName,
    "rect reads",
    rectReads,
    normalizedBudget.maxRectReads,
    scenario
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
    assertScenarioMax(
      profileName,
      scenarioName,
      `${componentName} renders`,
      renderedComponentCount(scenario, componentName),
      maxCount,
      scenario
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

  assertScenarioMax(
    profileName,
    scenarioName,
    "DOM node delta",
    scenario.metricsDelta?.Nodes ?? 0,
    normalizedBudget.maxDomNodeDelta,
    scenario
  )
  assertScenarioMax(
    profileName,
    scenarioName,
    "layout ms",
    scenario.browserCost?.layout?.durationMs ?? 0,
    normalizedBudget.maxLayoutDurationMs,
    scenario
  )
  assertScenarioMax(
    profileName,
    scenarioName,
    "style ms",
    scenario.browserCost?.style?.durationMs ?? 0,
    normalizedBudget.maxStyleDurationMs,
    scenario
  )
  assertScenarioMax(
    profileName,
    scenarioName,
    "script ms",
    scenario.browserCost?.scriptDurationMs ?? 0,
    normalizedBudget.maxScriptDurationMs,
    scenario
  )

  const readOnlyRowPatcher = scenario.profiler?.readOnlyRowPatcher ?? {}
  assertScenarioMin(
    profileName,
    scenarioName,
    "read-only row patch handled count",
    readOnlyRowPatcher.handledCount ?? 0,
    normalizedBudget.minReadOnlyRowPatchHandledCount,
    scenario
  )
  assertScenarioMax(
    profileName,
    scenarioName,
    "read-only row patch fallback count",
    readOnlyRowPatcher.fallbackCount ?? 0,
    normalizedBudget.maxReadOnlyRowPatchFallbackCount,
    scenario
  )
  assertScenarioMin(
    profileName,
    scenarioName,
    "read-only row patch fallback count",
    readOnlyRowPatcher.fallbackCount ?? 0,
    normalizedBudget.minReadOnlyRowPatchFallbackCount,
    scenario
  )
  assertScenarioMin(
    profileName,
    scenarioName,
    "read-only rows patched",
    readOnlyRowPatcher.rowsPatched ?? 0,
    normalizedBudget.minReadOnlyRowsPatched,
    scenario
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
    mountedHeaderNodes: scenario.mountedSurface?.after?.headerNodes ?? null,
    mountedEditableCells: scenario.mountedSurface?.after?.editableCells ?? null,
    mountedBodyNodes: scenario.mountedSurface?.after?.bodyNodes ?? null,
    mountedPopupRoots: scenario.mountedSurface?.after?.popupRoots ?? null,
    mountedPopupNodes: scenario.mountedSurface?.after?.popupNodes ?? null,
    styleSheets: scenario.mountedSurface?.after?.styleSheets ?? null,
    styleElements: scenario.mountedSurface?.after?.styleElements ?? null,
    linkedStyleSheets:
      scenario.mountedSurface?.after?.linkedStyleSheets ?? null,
    activeEditableCells:
      scenario.mountedSurface?.after?.activeEditableCells ?? null,
    hoveredEditableCells:
      scenario.mountedSurface?.after?.hoveredEditableCells ?? null,
    focusedElement: scenario.mountedSurface?.after?.focusedElement ?? null,
    readOnlyRowPatchHandledCount:
      scenario.profiler?.readOnlyRowPatcher?.handledCount ?? null,
    readOnlyRowPatchFallbackCount:
      scenario.profiler?.readOnlyRowPatcher?.fallbackCount ?? null,
    readOnlyRowsPatched:
      scenario.profiler?.readOnlyRowPatcher?.rowsPatched ?? null,
    readOnlyRowPatchReasons:
      scenario.profiler?.readOnlyRowPatcher?.reasons ?? null,
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
      summary.mountedHeaderNodes === null && summary.mountedBodyNodes === null
        ? null
        : `nodes=header:${summary.mountedHeaderNodes ?? "n/a"}/body:${
            summary.mountedBodyNodes ?? "n/a"
          }/popup:${summary.mountedPopupNodes ?? "n/a"}`,
      summary.styleSheets === null
        ? null
        : `css=${summary.styleSheets}/style:${
            summary.styleElements ?? "n/a"
          }/link:${summary.linkedStyleSheets ?? "n/a"}`,
      summary.activeEditableCells === null
        ? null
        : `active=${summary.activeEditableCells}`,
      summary.hoveredEditableCells === null
        ? null
        : `hover=${summary.hoveredEditableCells}`,
      summary.focusedElement === null
        ? null
        : `focus=${focusedElementLabel(summary.focusedElement)}`,
      summary.readOnlyRowPatchHandledCount === null
        ? null
        : `rowPatch=handled:${summary.readOnlyRowPatchHandledCount}/fallback:${summary.readOnlyRowPatchFallbackCount}/rows:${summary.readOnlyRowsPatched}/reasons:${JSON.stringify(
            summary.readOnlyRowPatchReasons ?? {}
          )}`,
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

function selectedBudgetProfileEntries(budget, report) {
  const budgetProfiles = budget.profiles ?? {}
  const targetFilter = report.targetFilter

  if (!Array.isArray(targetFilter) || targetFilter.length === 0) {
    return Object.entries(budgetProfiles)
  }

  return targetFilter.map((profileName) => {
    const profileBudget = budgetProfiles[profileName]
    if (!profileBudget) fail(`Missing performance budget profile: ${profileName}`)
    return [profileName, profileBudget]
  })
}

function selectedScenarioBudgetEntries(profileBudget, report) {
  const scenarioFilter = report.scenarioFilter

  if (!Array.isArray(scenarioFilter) || scenarioFilter.length === 0) {
    return Object.entries(profileBudget)
  }

  return scenarioFilter.map((scenarioName) => {
    const scenarioBudget = profileBudget[scenarioName]
    if (!scenarioBudget) {
      fail(`Missing performance budget scenario: ${scenarioName}`)
    }
    return [scenarioName, scenarioBudget]
  })
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

  for (const [profileName, profileBudget] of selectedBudgetProfileEntries(
    budget,
    report
  )) {
    const profile = profiles.find((item) => item.name === profileName)
    if (!profile) fail(`Missing performance profile: ${profileName}`)

    for (const [scenarioName, scenarioBudget] of selectedScenarioBudgetEntries(
      profileBudget,
      report
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
