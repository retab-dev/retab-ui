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

export function printStyleExperimentSummary(report) {
  const scenarioNames = new Set([
    "open-enum",
    "open-date",
    "open-empty-portal-shell",
    "open-select-popup-shell",
    "open-picker-popup-shell",
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
          report.styleClassExperiments?.length
            ? `classExperiments=${report.styleClassExperiments.join(",")}`
            : null,
          `surface=header:${scenario.mountedSurface?.after?.headerCells ?? "n/a"}/body:${scenario.mountedSurface?.after?.editableCells ?? "n/a"}/popup:${scenario.mountedSurface?.after?.popupNodes ?? "n/a"}`,
          `renders=${renderedComponentCount(scenario, "EditableJsonTableCell")}`,
          `commits=${scenario.profiler?.reactCommits?.count ?? 0}`,
          `rect=${scenario.rectProbe?.count ?? 0}`,
        ]
          .filter(Boolean)
          .join("  ")
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

export function traceEventSummary(events) {
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
    readOnlyRowPatchFallbacks:
      scenario.profiler?.readOnlyRowPatcher?.fallbackCount,
    readOnlyRowsPatched: scenario.profiler?.readOnlyRowPatcher?.rowsPatched,
    traceStyleMs: scenario.trace?.styleDurationMs,
    traceLayoutMs: scenario.trace?.layoutDurationMs,
    traceScriptMs: scenario.trace?.scriptDurationMs,
  }
}

export function buildRepeatedProfileSummary(runs) {
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

export function printRepeatedProfileSummary(report) {
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
