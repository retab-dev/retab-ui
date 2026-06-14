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

function assertOpenEnumBudget(profileName, scenario, budget) {
  if (!scenario) fail(`${profileName}: missing open-enum scenario`)
  if (!scenario.wait?.ok) fail(`${profileName}: open-enum did not complete`)
  if (!scenario.popupMounted) fail(`${profileName}: open-enum did not mount popup`)

  const elapsedMs = scenario.elapsedMs ?? Number.POSITIVE_INFINITY
  if (elapsedMs > budget.maxElapsedMs) {
    fail(
      `${profileName}: open-enum elapsed ${elapsedMs.toFixed(
        1
      )}ms exceeds ${budget.maxElapsedMs}ms`
    )
  }

  const editableCellRenders = renderedComponentCount(
    scenario,
    "EditableJsonTableCell"
  )
  if (editableCellRenders > budget.maxEditableCellRenders) {
    fail(
      `${profileName}: open-enum rendered EditableJsonTableCell ${editableCellRenders} times, budget ${budget.maxEditableCellRenders}`
    )
  }

  const reactCommits = scenario.profiler?.reactCommits?.count ?? 0
  if (reactCommits > budget.maxReactCommits) {
    fail(
      `${profileName}: open-enum used ${reactCommits} React commits, budget ${budget.maxReactCommits}`
    )
  }

  const rectReads = scenario.rectProbe?.count ?? 0
  if (rectReads > budget.maxRectReads) {
    fail(
      `${profileName}: open-enum used ${rectReads} rect reads, budget ${budget.maxRectReads}`
    )
  }

  for (const componentName of budget.forbiddenRenderedComponents ?? []) {
    const count = renderedComponentCount(scenario, componentName)
    if (count > 0) {
      fail(
        `${profileName}: open-enum rendered ${componentName} ${count} time(s)`
      )
    }
  }

  return {
    elapsedMs,
    editableCellRenders,
    reactCommits,
    rectReads,
    styleMs: scenario.browserCost?.style?.durationMs ?? null,
  }
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

    if (profileBudget["open-enum"]) {
      summaries.push({
        profile: profileName,
        scenario: "open-enum",
        ...assertOpenEnumBudget(
          profileName,
          scenarioByName(profile, "open-enum"),
          profileBudget["open-enum"]
        ),
      })
    }
  }

  console.log(JSON.stringify({ ok: true, summaries }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
