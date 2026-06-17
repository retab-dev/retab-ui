import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

describe("JSON-table profiler architecture", () => {
  it("keeps primitive interaction profiling repeatable", () => {
    const profilerFile = "scripts/profile-json-table-primitive-interactions.mjs"
    const reportSummaryFile = "scripts/json-table-profiler/report-summary.mjs"
    const verifierFile = "scripts/verify-json-table-performance-budget.mjs"
    const content = readFileSync(join(repoRoot, profilerFile), "utf8")
    const reportSummaryContent = readFileSync(
      join(repoRoot, reportSummaryFile),
      "utf8"
    )
    const profilerContractContent = `${content}\n${reportSummaryContent}`
    const verifierContent = readFileSync(join(repoRoot, verifierFile), "utf8")

    for (const requiredToken of [
      "JSON_TABLE_PROFILE_REPEAT",
      "JSON_TABLE_PROFILE_WARMUP",
      "JSON_TABLE_PROFILE_TRACE",
      "JSON_TABLE_PROFILE_TARGETS",
      "JSON_TABLE_PROFILE_SCENARIOS",
      "JSON_TABLE_STYLE_CLASS_EXPERIMENTS",
      '"--repeat"',
      '"--warmup"',
      '"--trace"',
      '"--targets"',
      '"--scenarios"',
      '"--style-class-experiments"',
      "buildRepeatedProfileSummary",
      "repeatedScenarios",
      "targetFilter",
      "scenarioFilter",
      "styleClassExperiments",
      "assertSelectedScenarioNamesMatched",
      "assertFilteredProfile",
      "warmupCount",
      "traceMode",
      "traceCategories",
      "traceStyleMs",
      "median",
      "p90",
      "worst",
    ]) {
      expect(
        profilerContractContent.includes(requiredToken),
        `${profilerFile} and ${reportSummaryFile} keep ${requiredToken}`
      ).toBe(true)
    }

    for (const helperToken of [
      "export function buildRepeatedProfileSummary",
      "export function printRepeatedProfileSummary",
      "export function printStyleExperimentSummary",
      "export function traceEventSummary",
      "readOnlyRowPatchFallbacks",
      "readOnlyRowsPatched",
    ]) {
      expect(
        reportSummaryContent.includes(helperToken),
        `${reportSummaryFile} keeps profiler summary helper ${helperToken}`
      ).toBe(true)
    }

    for (const requiredToken of [
      "selectedBudgetProfileEntries",
      "selectedScenarioBudgetEntries",
      "report.targetFilter",
      "report.scenarioFilter",
      "Missing performance budget profile",
      "Missing performance budget scenario",
    ]) {
      expect(
        verifierContent.includes(requiredToken),
        `${verifierFile} keeps target-filtered repeated profile support ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps primitive interaction profiling surface-attributed", () => {
    const profilerFile = "scripts/profile-json-table-primitive-interactions.mjs"
    const verifierFile = "scripts/verify-json-table-performance-budget.mjs"
    const profileRouteFile = "app/(app)/json-table-profile/page.tsx"
    const profileProbeFile = "components/json-table/json-table-style-probe.tsx"
    const profilerContent = readFileSync(join(repoRoot, profilerFile), "utf8")
    const verifierContent = readFileSync(join(repoRoot, verifierFile), "utf8")
    const profileRouteContent = readFileSync(
      join(repoRoot, profileRouteFile),
      "utf8"
    )
    const profileProbeContent = readFileSync(
      join(repoRoot, profileProbeFile),
      "utf8"
    )

    for (const requiredToken of [
      "mountedSurfaceSnapshot",
      "mountedSurfaceDelta",
      "mountedSurface",
      "shouldRunStyleProbeScenarios",
      "installStyleClassExperiments",
      "styleClassExperimentRules",
      "disable-row-hover",
      "disable-active-cell-overlay",
      "disable-focus-visible-ring",
      "disable-portal-shadow",
      "clickStyleProbeButton",
      "open-empty-portal-shell",
      "open-select-popup-shell",
      "open-picker-popup-shell",
      "headerCells",
      "headerNodes",
      "editableCells",
      "bodyNodes",
      "popupNodes",
      "popupRoots",
      "json-table-inert-popup",
      "data-json-table-style-probe",
      "styleSheets",
      "styleElements",
      "linkedStyleSheets",
      "focusedElement",
      "hoveredEditableCells",
      "styleAttributionHint",
      "Tracing.start",
      "Tracing.dataCollected",
      "traceEventSummary",
    ]) {
      expect(
        profilerContent.includes(requiredToken),
        `${profilerFile} keeps ${requiredToken}`
      ).toBe(true)
    }

    for (const requiredToken of [
      "mountedHeaderCells",
      "mountedHeaderNodes",
      "mountedEditableCells",
      "mountedBodyNodes",
      "mountedPopupRoots",
      "mountedPopupNodes",
      "styleSheets",
      "focusedElementLabel",
      "styleAttributionHint",
      "surface=header",
      "nodes=header",
      "focus=",
      "owner=",
      "traceStyle=",
      "traceLayout=",
    ]) {
      expect(
        verifierContent.includes(requiredToken),
        `${verifierFile} keeps ${requiredToken}`
      ).toBe(true)
    }

    for (const requiredToken of ["JsonTableStyleProbe"]) {
      expect(
        profileRouteContent.includes(requiredToken),
        `${profileRouteFile} keeps ${requiredToken}`
      ).toBe(true)
    }

    for (const requiredToken of [
      "json-table-style-probe",
      "json-table-inert-popup",
      "data-cell-select-popup",
      "data-cell-picker-popup",
    ]) {
      expect(
        profileProbeContent.includes(requiredToken),
        `${profileProbeFile} keeps ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps primitive interaction profiling date commits stable", () => {
    const profilerFile = "scripts/profile-json-table-primitive-interactions.mjs"
    const content = readFileSync(join(repoRoot, profilerFile), "utf8")

    for (const requiredToken of [
      "calendarCommitDatePoint",
      "button[data-day]",
      "data-selected-single",
      "enabledVisibleButtons",
      "No date commit button found:",
    ]) {
      expect(
        content.includes(requiredToken),
        `${profilerFile} keeps ${requiredToken}`
      ).toBe(true)
    }

    expect(content.includes('className.includes("outside")')).toBe(false)
  })

  it("keeps primitive interaction profiling lifecycle stable", () => {
    const profilerFile = "scripts/profile-json-table-primitive-interactions.mjs"
    const browserSessionFile = "scripts/json-table-profiler/browser-session.mjs"
    const content = readFileSync(join(repoRoot, profilerFile), "utf8")
    const browserSessionContent = readFileSync(
      join(repoRoot, browserSessionFile),
      "utf8"
    )
    const profilerContractContent = `${content}\n${browserSessionContent}`

    for (const requiredToken of [
      "activateEditableProfile",
      "profilePageState",
      "recoverBlankEditableProfile",
      "closeChromeTarget",
      "closeProfileTargets",
      "profileSurfaceTimeoutMs",
      "editableCellTimeoutMs",
      "/json/close/",
      "Editable JSON table did not mount:",
    ]) {
      expect(
        profilerContractContent.includes(requiredToken),
        `${profilerFile} and ${browserSessionFile} keep ${requiredToken}`
      ).toBe(true)
    }

    for (const helperToken of [
      "export async function waitForDevToolsEndpoint",
      "export async function closeProfileTargets",
      "export function connectCdp",
      "export async function waitInPage",
    ]) {
      expect(
        browserSessionContent.includes(helperToken),
        `${browserSessionFile} keeps browser session helper ${helperToken}`
      ).toBe(true)
    }
  })
})
