import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

const deletedRuntimeFiles = [
  "components/json-table/json-table-scalar-cell.tsx",
  "components/json-table/json-table-primitive-command.ts",
  "components/json-table/json-table-primitive-handoff.ts",
  "components/json-table/json-table-primitive-active-cell-replacement.ts",
  "components/json-table/json-table-cell-model.ts",
  "components/json-table/json-table-data-cell.tsx",
  "components/json-table/json-table-display-cell.tsx",
  "components/json-table/use-cell-controller.ts",
  "components/json-table/use-json-table-cell-profiler.ts",
  "components/json-table/use-json-table-primitive-cell-controller.ts",
  "registry/new-york-v4/ui/data-cell-text-control.tsx",
  "registry/new-york-v4/ui/data-cell-number-control.tsx",
  "registry/new-york-v4/ui/data-cell-control-state.ts",
]

const runtimeRoots = ["components/json-table"]

const dataCellRuntimeFiles = [
  "registry/new-york-v4/ui/data-cell.tsx",
  "registry/new-york-v4/ui/data-cell-activation.ts",
  "registry/new-york-v4/ui/data-cell-boolean-control.tsx",
  "registry/new-york-v4/ui/data-cell-boolean-value.ts",
  "registry/new-york-v4/ui/data-cell-classes.ts",
  "registry/new-york-v4/ui/data-cell-control.tsx",
  "registry/new-york-v4/ui/data-cell-control-actions.ts",
  "registry/new-york-v4/ui/data-cell-control-contract.ts",
  "registry/new-york-v4/ui/data-cell-control-props.ts",
  "registry/new-york-v4/ui/data-cell-control-registry.tsx",
  "registry/new-york-v4/ui/data-cell-display.tsx",
  "registry/new-york-v4/ui/data-cell-display-model.ts",
  "registry/new-york-v4/ui/data-cell-edit-model.ts",
  "registry/new-york-v4/ui/data-cell-format.ts",
  "registry/new-york-v4/ui/data-cell-picker-control.tsx",
  "registry/new-york-v4/ui/data-cell-picker-icon.tsx",
  "registry/new-york-v4/ui/data-cell-picker-position.ts",
  "registry/new-york-v4/ui/data-cell-select-activation.ts",
  "registry/new-york-v4/ui/data-cell-select-control.tsx",
  "registry/new-york-v4/ui/data-cell-select-keyboard.ts",
  "registry/new-york-v4/ui/data-cell-select-navigation.ts",
  "registry/new-york-v4/ui/data-cell-select-popup-dismissal.ts",
  "registry/new-york-v4/ui/data-cell-select-popup-position.ts",
  "registry/new-york-v4/ui/data-cell-select-popup.tsx",
  "registry/new-york-v4/ui/data-cell-select-state.ts",
  "registry/new-york-v4/ui/data-cell-session.ts",
  "registry/new-york-v4/ui/data-cell-text-activation.ts",
  "registry/new-york-v4/ui/data-cell-input-control.tsx",
  "registry/new-york-v4/ui/data-cell-text-hit-test.ts",
  "registry/new-york-v4/ui/data-cell-types.ts",
  "components/ui/data-cell.tsx",
]

const forbiddenRuntimePatterns = [
  "JsonTableScalarCell",
  "jsonTableScalarDataCellClass",
  "InteractiveDataCell",
  'mode="auto"',
  '"auto" |',
  "openEditorPath",
  "CellIdentity",
  "CellFieldState",
  "CellTextDraft",
  "CellFocusState",
  "CellOverlayState",
  "CellEditSessionState",
  "CellCommitHandlers",
  "fieldFocusId",
  "textDraft",
  "overlays",
]

const forbiddenJsonTableRuntimePatterns = [
  "activationRequest",
  "blurActiveElement",
  "canActivatePrimitiveFromKey",
  "DataCellActivationRequest",
  "fieldPathAttributeSelector",
  "finishPrimitiveEditor",
  "getDataCellDisplayTextSelectionOffset",
  "JsonTableActiveControl",
  "keyboardActivationRequest",
  "primitiveActivationIntent",
  "shellActivationRequest",
  "setActivationRequest",
]

const forbiddenEditableRouterPatterns = [
  "flushSync",
  "canActivateDataCellFromKey",
  "DataCellEditorHandle",
  "structuredEditSessionId",
  'recordJsonTableRender("JsonTableStructuredActiveCell"',
  'event.getModifierState("AltGraph")',
  'fieldMetadata.kind === "boolean"',
  "activationRequest: {",
]

const forbiddenEditableCoordinatorPatterns = [
  "getFieldMetadata",
  "useCellController",
  "formatValueForCommit",
  "markJsonTableProfile",
  "finishPreviousPrimitiveEditor",
  "commitPrimitiveCommand",
  "pointerActivationRequest",
  "keyboardActivationRequest",
  "getSelectableCellWidthStyle",
  "getCellWidthStyle",
  "onPointerDown:",
  "onKeyDown:",
  "React.useLayoutEffect",
]

const forbiddenPrimitiveShellActivationPatterns = [
  "pointerActivationRequest",
  "select",
  "enum",
  "option",
  "@base-ui/react/select",
  "@/components/ui/select",
  "DATA_CELL_SELECT_CLOSE_DELAY",
]

const forbiddenPrimitiveShellHandlerPatterns = [
  ...forbiddenPrimitiveShellActivationPatterns,
  "clientX",
  "clientY",
]

const forbiddenDataCellShellPatterns = [
  "getDataCellDisplayTextSelectionOffset",
  "dataCellNumberKeyPattern",
  "commitBooleanDisplayValue",
  "didActivateBeforeClickRef",
  'props.kind === "boolean"',
  'props.kind === "select"',
  'props.kind === "text"',
  'props.kind === "number"',
  'props.kind === "integer"',
  'props.kind === "date"',
  'props.kind === "time"',
  'props.kind === "date-time"',
]

const forbiddenDataCellActivationPatterns = [
  "activationIntent",
  "ActivationOutcome",
  "activationOutcome",
  "programmatic",
  "eventType",
]

const forbiddenSelectOpeningPatterns = [
  "skipAutoFocus",
  "closeTimer",
  "closeDelay",
  "setTimeout",
]

const forbiddenPickerOpeningPatterns = [
  "skipAutoFocus",
  "openingPointerDown",
  "closeTimer",
  "closeDelay",
  "setTimeout",
]

const forbiddenOverlayOpeningPolicyPatterns = [
  "token.ownsEvent",
  "openingActivationRef",
  "holdDataCellActivationThroughOpeningEvent",
]

const dataCellRegistryRuntimeFiles = dataCellRuntimeFiles.filter((file) =>
  file.startsWith("registry/new-york-v4/ui/")
)

const dataCellPrimitiveControlFiles = [
  "registry/new-york-v4/ui/data-cell-boolean-control.tsx",
  "registry/new-york-v4/ui/data-cell-picker-control.tsx",
  "registry/new-york-v4/ui/data-cell-select-control.tsx",
  "registry/new-york-v4/ui/data-cell-input-control.tsx",
]

const forbiddenPrimitiveControlPatterns = [
  "DataCellProps",
  "components/json-table",
  "@/components/json-table",
  "JsonTable",
  "jsonValue",
  "schema",
  "sentinel",
  `is${"Picker"}Open`,
  `on${"Picker"}OpenChange`,
]

const forbiddenPrimitiveIgnoredPropAliases = [
  "_editable",
  "_active",
  "_mode",
  "_showPickerIcon",
  "_draftValue",
  "_onDraftValueChange",
  "_onActiveChange",
  "_onOpenChange",
  `_on${"Picker"}OpenChange`,
]

const jsonTableLineCountLimits = [
  {
    file: "components/json-table/editable-json-table-cell.tsx",
    maxLines: 80,
  },
  {
    file: "components/json-table/use-json-table-editable-cell-model.ts",
    maxLines: 180,
  },
  {
    file: "components/json-table/use-json-table-cell-field.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/use-json-table-primitive-control.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/use-json-table-structured-cell-controller.ts",
    maxLines: 160,
  },
  {
    file: "components/json-table/use-json-table-shell-handlers.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/use-json-table-focus-return.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/json-table-cell-shell.ts",
    maxLines: 220,
  },
]

const forbiddenRuntimeRegexes = [
  /\bprops\.session\b/,
  /\bprops\.commit\b/,
  /\bprops\.close\b/,
]

function sourceFilesUnder(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) return sourceFilesUnder(fullPath)
    if (!/\.(ts|tsx)$/.test(entry)) return []
    return [relative(repoRoot, fullPath)]
  })
}

function isJsonTableRuntimeFile(file: string): boolean {
  if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return false
  if (file.includes("/sample/")) return false
  if (file.includes("/read-only-")) return true
  return true
}

function lineCount(content: string): number {
  return content.trimEnd().split(/\r?\n/).length
}

function importedModuleSpecifiers(content: string): string[] {
  return Array.from(
    content.matchAll(
      /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g
    ),
    (match) => match[1]
  )
}

type FileBoundary = {
  name: string
  file: string
  required?: string[]
  forbidden?: string[]
}

function assertFileBoundary(boundary: FileBoundary) {
  const content = readFileSync(join(repoRoot, boundary.file), "utf8")

  for (const pattern of boundary.required ?? []) {
    expect(
      content.includes(pattern),
      `${boundary.name}: ${boundary.file} misses ${pattern}`
    ).toBe(true)
  }

  for (const pattern of boundary.forbidden ?? []) {
    expect(
      content.includes(pattern),
      `${boundary.name}: ${boundary.file} contains ${pattern}`
    ).toBe(false)
  }

  return content
}

describe("json table and DataCell architecture", () => {
  it("keeps deleted scalar and auto-edit compatibility files deleted", () => {
    for (const file of deletedRuntimeFiles) {
      expect(existsSync(join(repoRoot, file)), file).toBe(false)
    }

    const registryManifestContent = readFileSync(
      join(repoRoot, "registry.json"),
      "utf8"
    )
    const dataCellRegistryContent = readFileSync(
      join(repoRoot, "public/r/data-cell.json"),
      "utf8"
    )

    for (const deletedRegistryFile of [
      "registry/new-york-v4/ui/data-cell-text-control.tsx",
      "@ui/data-cell-text-control.tsx",
      "registry/new-york-v4/ui/data-cell-number-control.tsx",
      "@ui/data-cell-number-control.tsx",
    ]) {
      expect(registryManifestContent.includes(deletedRegistryFile)).toBe(false)
      expect(dataCellRegistryContent.includes(deletedRegistryFile)).toBe(false)
    }
  })

  it("keeps runtime source off legacy edit architecture names", () => {
    const jsonTableRuntimeFiles = runtimeRoots.flatMap((root) =>
      sourceFilesUnder(join(repoRoot, root)).filter(isJsonTableRuntimeFile)
    )
    const runtimeFiles = [...jsonTableRuntimeFiles, ...dataCellRuntimeFiles]

    for (const file of runtimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of forbiddenRuntimePatterns) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
      for (const pattern of forbiddenRuntimeRegexes) {
        expect(pattern.test(content), `${file} matches ${pattern}`).toBe(false)
      }
    }

    for (const file of jsonTableRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of forbiddenJsonTableRuntimePatterns) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
      for (const pattern of [
        "createDataCellPointerActivationSource",
        "createDataCellKeyboardActivationSource",
        "createDataCellShellActivationSource",
        "DataCellActivationSource",
      ]) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
    }
  })

  it("keeps DataCell registry runtime import graph independent from JSON table internals", () => {
    for (const file of dataCellRegistryRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      const imports = importedModuleSpecifiers(content)

      for (const importedModule of imports) {
        expect(
          importedModule.startsWith("@/components/json-table"),
          `${file} imports JSON-table internals through ${importedModule}`
        ).toBe(false)
        expect(
          importedModule.startsWith("@/components/ui/data-cell"),
          `${file} imports the public DataCell barrel instead of its local runtime through ${importedModule}`
        ).toBe(false)
      }
    }
  })

  it("keeps JSON-table runtime importing DataCell only through the public barrel", () => {
    const jsonTableRuntimeFiles = runtimeRoots.flatMap((root) =>
      sourceFilesUnder(join(repoRoot, root)).filter(isJsonTableRuntimeFile)
    )

    for (const file of jsonTableRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      const imports = importedModuleSpecifiers(content)

      for (const importedModule of imports) {
        expect(
          importedModule.startsWith("@/registry/new-york-v4/ui/data-cell") ||
            importedModule.includes("/registry/new-york-v4/ui/data-cell"),
          `${file} imports DataCell registry internals through ${importedModule}; use "@/components/ui/data-cell"`
        ).toBe(false)
      }
    }
  })

  it("keeps EditableJsonTableCell as a pure router", () => {
    const file = "components/json-table/editable-json-table-cell.tsx"
    const content = readFileSync(join(repoRoot, file), "utf8")

    for (const pattern of forbiddenEditableRouterPatterns) {
      expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
        false
      )
    }
  })

  it("keeps primitive active-cell store as the only flushSync boundary", () => {
    const allowedFile =
      "components/json-table/json-table-primitive-active-cell-store.ts"
    const jsonTableRuntimeFiles = runtimeRoots.flatMap((root) =>
      sourceFilesUnder(join(repoRoot, root)).filter(isJsonTableRuntimeFile)
    )

    for (const file of jsonTableRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(
        content.includes("flushSync"),
        `${file} contains flushSync outside ${allowedFile}`
      ).toBe(file === allowedFile)
    }

    const replacementContent = readFileSync(join(repoRoot, allowedFile), "utf8")
    expect(
      replacementContent.includes("replaceJsonTablePrimitiveActiveCell")
    ).toBe(true)
    expect(
      replacementContent.includes("Same-event switching must let the previous")
    ).toBe(true)
  })

  it("keeps DataCell activation source as the only DataCell flushSync boundary", () => {
    const allowedFile = "registry/new-york-v4/ui/data-cell.tsx"
    const architectureFile = "components/json-table/ARCHITECTURE.md"
    const architectureContent = readFileSync(
      join(repoRoot, architectureFile),
      "utf8"
    )

    for (const file of dataCellRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(
        content.includes("flushSync"),
        `${file} contains flushSync outside ${allowedFile}`
      ).toBe(file === allowedFile)
    }

    const shellContent = readFileSync(join(repoRoot, allowedFile), "utf8")
    expect(shellContent.includes("storeDataCellActivationSource")).toBe(true)
    expect(shellContent.includes("Activation source must be visible")).toBe(
      true
    )

    for (const documentedPolicy of [
      "### DataCell Activation State Machine",
      "stateDiagram-v2",
      "boolean pointer/key command",
      "pointer coordinates or key",
      "opening event cannot dismiss",
      "Modifier-key keyboard events do not activate editing.",
      "storeDataCellActivationSource()",
      "only DataCell `flushSync` boundary",
      "Select and picker controls use `useDataCellOpeningContext()`",
    ]) {
      expect(
        architectureContent.includes(documentedPolicy),
        `${architectureFile} misses DataCell activation policy ${documentedPolicy}`
      ).toBe(true)
    }
  })

  it("keeps the JSON-table verification command stable and documented", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8")
    ) as { scripts?: Record<string, string> }
    const architectureContent = readFileSync(
      join(repoRoot, "components/json-table/ARCHITECTURE.md"),
      "utf8"
    )
    const dataCellParityVerifier = readFileSync(
      join(repoRoot, "scripts/verify-data-cell-parity.mjs"),
      "utf8"
    )
    const dataCellParityRoute = readFileSync(
      join(repoRoot, "app/(view)/data-cell-parity/page.tsx"),
      "utf8"
    )

    expect(packageJson.scripts?.["test:json-table"]).toContain(
      "tests/json-table-session-interactions.test.tsx"
    )
    expect(packageJson.scripts?.["test:json-table"]).toContain(
      "tests/json-table-enum-accessibility-interactions.test.tsx"
    )
    expect(packageJson.scripts?.["test:json-table"]).toContain(
      "tests/read-only-json-row-patcher.test.tsx"
    )
    expect(packageJson.scripts?.["test:json-table"]).toContain(
      "tests/json-table-structured-cell.test.tsx"
    )
    expect(packageJson.scripts?.["verify:json-table"]).toContain(
      "pnpm test:json-table"
    )
    expect(packageJson.scripts?.["verify:json-table"]).toContain(
      "PROFILE_SERVER_MODE=auto"
    )
    expect(packageJson.scripts?.["verify:json-table"]).toContain(
      "JSON_TABLE_PROFILE_WARMUP=1"
    )
    expect(packageJson.scripts?.["verify:json-table"]).toContain(
      "pnpm verify:json-table-performance:fresh"
    )
    expect(packageJson.scripts?.["verify:json-table"]).toContain(
      "pnpm verify:json-table-accessibility:fresh"
    )
    expect(packageJson.scripts?.["verify:data-cell"]).toContain(
      "verify-data-cell-parity.mjs"
    )
    expect(dataCellParityVerifier).toContain(
      "http://127.0.0.1:3100/data-cell-parity"
    )
    expect(dataCellParityVerifier).not.toContain(
      "http://localhost:3100/docs/components/data-cell"
    )
    expect(dataCellParityRoute).toContain(
      'import { DataCellDemo } from "@/components/data-cell-demo"'
    )
    expect(dataCellParityRoute).not.toContain("@/components/json-table")
    expect(dataCellParityRoute).not.toContain("@/components/docs")
    expect(packageJson.scripts?.["verify:data-cell-registry"]).toContain(
      "verify-data-cell-registry-determinism.mjs"
    )
    expect(architectureContent.includes("pnpm verify:json-table")).toBe(true)
    expect(architectureContent.includes("pnpm test:json-table")).toBe(true)
    expect(architectureContent.includes("JSON_TABLE_PROFILE_WARMUP=1")).toBe(
      true
    )
    expect(architectureContent.includes("JSON_TABLE_PROFILE_TARGETS")).toBe(
      true
    )
    expect(architectureContent.includes("JSON_TABLE_PROFILE_SCENARIOS")).toBe(
      true
    )
    expect(
      architectureContent.includes("scenario filters are diagnostic-only")
    ).toBe(true)
    expect(
      architectureContent.includes("use p90 for latency/style budgets")
    ).toBe(true)
    expect(architectureContent.includes("pnpm typecheck")).toBe(true)
    expect(architectureContent.includes("pnpm verify:data-cell")).toBe(true)
    expect(architectureContent.includes("pnpm verify:data-cell-registry")).toBe(
      true
    )
    expect(architectureContent.includes("components/ui/data-cell")).toBe(true)
    expect(
      architectureContent.includes("registry/new-york-v4/ui/data-cell*")
    ).toBe(true)
    expect(
      architectureContent.includes("pnpm test tests/json-table-*.test")
    ).toBe(false)
  })

  it("keeps large JSON-table performance budgets tied to repeated evidence", () => {
    const budgetFile =
      "components/json-table/json-table-performance-budget.json"
    const budget = JSON.parse(readFileSync(join(repoRoot, budgetFile), "utf8"))
    const largeBudget = budget.profiles.large

    for (const scenarioName of [
      "open-enum",
      "open-date",
      "switch-dirty-cell",
      "open-far-enum",
      "open-far-date",
      "commit-far-text",
    ]) {
      expect(
        largeBudget[scenarioName],
        `${budgetFile} budgets ${scenarioName}`
      ).toBeTruthy()
      expect(
        largeBudget[scenarioName].maxStyleDurationMs,
        `${budgetFile} keeps ${scenarioName} style budget tight`
      ).toBeLessThanOrEqual(120)
    }

    expect(largeBudget["open-enum"].maxElapsedMs).toBeLessThanOrEqual(250)
    expect(largeBudget["open-date"].maxElapsedMs).toBeLessThanOrEqual(350)
    expect(largeBudget["switch-dirty-cell"].maxElapsedMs).toBeLessThanOrEqual(
      250
    )
    expect(
      largeBudget["open-far-enum"].allowedEditableCellRenderFieldPaths
    ).toContain("transactions.0.profile_far_status")
    expect(
      largeBudget["open-far-date"].allowedEditableCellRenderFieldPaths
    ).toContain("transactions.0.profile_far_date")
    expect(
      largeBudget["commit-far-text"].allowedEditableCellRenderFieldPaths
    ).toContain("transactions.0.profile_far_note")
  })

  it("keeps the current JSON-table architecture documents indexed", () => {
    const architectureFile = "components/json-table/ARCHITECTURE.md"
    const architectureContent = readFileSync(
      join(repoRoot, architectureFile),
      "utf8"
    )

    for (const requiredDocument of [
      "## Current Documents",
      "design/data-cell-json-table-platonic-issues-blueprint.md",
      "design/data-cell-json-table-style-invalidation-findings.md",
      "components/json-table/json-table-performance-budget.json",
      "scripts/profile-json-table-primitive-interactions.mjs",
      "scripts/verify-json-table-performance-budget.mjs",
      "scripts/verify-json-table-performance-budget-fresh.mjs",
      "Older JSON-table blueprints are historical",
    ]) {
      expect(
        architectureContent.includes(requiredDocument),
        `${architectureFile} misses current architecture document ${requiredDocument}`
      ).toBe(true)
    }
  })

  it("keeps primitive interaction tests on the shared row harness", () => {
    const interactionUtilityFile = "tests/json-table-interaction-test-utils.tsx"
    const interactionUtilityContent = readFileSync(
      join(repoRoot, interactionUtilityFile),
      "utf8"
    )

    expect(interactionUtilityContent.includes("renderInteractionRow")).toBe(
      true
    )
    expect(interactionUtilityContent.includes("SingleFileFormRowHarness")).toBe(
      true
    )

    for (const testFile of [
      "tests/json-table-text-number-interactions.test.tsx",
      "tests/json-table-boolean-enum-interactions.test.tsx",
    ]) {
      const content = readFileSync(join(repoRoot, testFile), "utf8")
      expect(content.includes("renderInteractionRow")).toBe(true)
      for (const duplicatedHarnessToken of [
        "SingleFileFormRowHarness",
        "createJsonTablePrimitiveActiveCellStore",
        "createJsonTablePrimitiveEditStore",
        "jsonTableFullRenderedColumnWindow",
        "startStructuredEditSession",
      ]) {
        expect(
          content.includes(duplicatedHarnessToken),
          `${testFile} keeps duplicated row harness token ${duplicatedHarnessToken}`
        ).toBe(false)
      }
    }
  })

  it("keeps useJsonTableEditableCellModel as the editable-cell model boundary", () => {
    const file = "components/json-table/use-json-table-editable-cell-model.ts"
    const content = readFileSync(join(repoRoot, file), "utf8")

    for (const pattern of forbiddenEditableCoordinatorPatterns) {
      expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
        false
      )
    }
    expect(content.includes("buildJsonTableEditableCellModel")).toBe(false)
    expect(content.includes("json-table-cell-model")).toBe(false)
    expect(content.includes("disabledJsonTableCellShellProps")).toBe(true)
    expect(content.includes("editableJsonTableCellShellProps")).toBe(true)
    expect(content.includes("type JsonTableEditableCellModel")).toBe(false)
    for (const removedLocalModel of [
      "DisabledJsonTableCellModel",
      "PrimitiveJsonTableCellModel",
      "StructuredActiveJsonTableCellModel",
      "DisplayJsonTableCellModel",
      "JsonTableEditableCellModel",
    ]) {
      expect(
        content.includes(`type ${removedLocalModel}`),
        `${file} keeps removed local model ${removedLocalModel}`
      ).toBe(false)
    }
  })

  it("keeps primitive and structured commit controllers separated", () => {
    const primitiveFile =
      "components/json-table/use-json-table-primitive-control.ts"
    const structuredFile =
      "components/json-table/use-json-table-structured-cell-controller.ts"
    const primitiveContent = readFileSync(join(repoRoot, primitiveFile), "utf8")
    const structuredContent = readFileSync(
      join(repoRoot, structuredFile),
      "utf8"
    )
    const primitiveCommitControllerContent = primitiveContent.slice(
      primitiveContent.indexOf(
        "export function useJsonTablePrimitiveCommitController"
      ),
      primitiveContent.indexOf("export function useJsonTablePrimitiveControl")
    )

    expect(primitiveCommitControllerContent).toContain(
      "useJsonTablePrimitiveCommitController"
    )
    expect(
      primitiveCommitControllerContent.includes(`on${"Document"}DataChange`)
    ).toBe(false)
    expect(primitiveCommitControllerContent.includes("docId")).toBe(false)
    expect(primitiveCommitControllerContent.includes("onCellCommit")).toBe(true)
    expect(
      primitiveCommitControllerContent.includes(
        "primitiveEditStore.commitValue"
      )
    ).toBe(true)
    expect(
      primitiveCommitControllerContent.includes(
        'visibleThrough: "primitivePendingValue"'
      )
    ).toBe(true)

    expect(structuredContent.includes("JsonTablePrimitiveEditStore")).toBe(
      false
    )
    expect(structuredContent.includes(`on${"Primitive"}Commit`)).toBe(false)
    expect(structuredContent.includes(`on${"Document"}DataChange`)).toBe(false)
    expect(structuredContent.includes("onCellCommit")).toBe(true)
    expect(
      structuredContent.includes('visibleThrough: "projectedDocumentValue"')
    ).toBe(true)
    expect(structuredContent.includes("StructuredPendingValue")).toBe(true)
    expect(structuredContent.includes("structuredPendingValue")).toBe(true)
    expect(structuredContent.includes("projectedValueAtCommit")).toBe(true)
    expect(structuredContent.includes("areStructuredValuesEqual")).toBe(true)
    expect(structuredContent.includes("StructuredLocalCommit")).toBe(false)
    expect(structuredContent.includes("localCommit")).toBe(false)
    expect(structuredContent.includes("commitValue(")).toBe(false)
  })

  it("documents the structured pending visibility policy", () => {
    const architectureFile = "components/json-table/ARCHITECTURE.md"
    const architectureContent = readFileSync(
      join(repoRoot, architectureFile),
      "utf8"
    )

    for (const documentedPolicy of [
      "### Structured Pending Policy",
      "useJsonTableStructuredCellController",
      "projectedValueAtCommit",
      "not echoed the structured commit yet",
      "cloned object/array",
      "The parent value wins and pending state is cleared.",
      "Horizontal virtualization does not cancel a structured session.",
      "popover DOM unmounts",
      "reopens with the same active session",
    ]) {
      expect(
        architectureContent.includes(documentedPolicy),
        `${architectureFile} misses structured pending policy ${documentedPolicy}`
      ).toBe(true)
    }
  })

  it("keeps primitive echo ownership out of the virtualized table", () => {
    const file = "components/json-table/single-file-virtualized-table.tsx"
    const content = readFileSync(join(repoRoot, file), "utf8")

    for (const pattern of [
      "primitivePersistenceBridge",
      "recordDocumentEcho",
      "reconcileDocumentData",
      "setValueAtMaterializedPath",
      "onUpdateDocument",
      `on${"Document"}DataChange`,
      `on${"Primitive"}Commit`,
    ]) {
      expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
        false
      )
    }

    expect(content.includes("onCellCommit")).toBe(true)
  })

  it("keeps document patching and primitive echo marking in the document model", () => {
    const documentModelFile =
      "components/json-table/use-single-file-table-document-model.ts"
    const patchModuleFile = "components/json-table/lib/document-patches.ts"
    const editStoreFile =
      "components/json-table/json-table-primitive-edit-store.ts"
    const jsonTableRuntimeFiles = runtimeRoots.flatMap((root) =>
      sourceFilesUnder(join(repoRoot, root)).filter(isJsonTableRuntimeFile)
    )

    for (const file of jsonTableRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      if (file !== documentModelFile && file !== patchModuleFile) {
        expect(
          content.includes("setValueAtMaterializedPath"),
          `${file} patches document data`
        ).toBe(false)
      }
      if (file !== documentModelFile && file !== editStoreFile) {
        expect(
          content.includes("recordDocumentEcho"),
          `${file} marks primitive document echoes`
        ).toBe(false)
      }
    }

    const documentModelContent = readFileSync(
      join(repoRoot, documentModelFile),
      "utf8"
    )
    expect(documentModelContent.includes("setValueAtMaterializedPath")).toBe(
      true
    )
    expect(documentModelContent.includes("recordDocumentEcho")).toBe(true)
  })

  it("keeps primitive echo recognition narrow and non-serializing", () => {
    const editStoreFile =
      "components/json-table/json-table-primitive-edit-store.ts"
    const editStoreContent = readFileSync(join(repoRoot, editStoreFile), "utf8")

    expect(editStoreContent.includes("JsonTablePrimitiveDocumentEcho")).toBe(
      true
    )
    expect(editStoreContent.includes("fieldPath")).toBe(true)
    expect(editStoreContent.includes("value")).toBe(true)
    expect(editStoreContent.includes("JSON.stringify")).toBe(false)
    expect(editStoreContent.includes("documentEchoKey")).toBe(false)
    expect(editStoreContent.includes("primitiveDocumentEchoKeys")).toBe(false)
  })

  it("keeps the document lifecycle owned by useSingleFileTableDocumentModel", () => {
    const documentModelFile =
      "components/json-table/use-single-file-table-document-model.ts"
    const documentModelContent = assertFileBoundary({
      name: "document lifecycle owner",
      file: documentModelFile,
      required: [
        "type SingleFileTableDocumentState",
        "documentStateRef",
        "projectionDocumentForRender",
        "resetForSourceDocument",
        "reconcileSourceDocument",
        "commitCellValue",
        "createJsonTablePrimitiveEditStore",
        "setValueAtMaterializedPath",
        "recordDocumentEcho",
        "reconcileDocumentData",
        "onUpdateDocument",
      ],
    })

    const sourceReconciliationEffectIndex = documentModelContent.indexOf(
      "React.useLayoutEffect(() => {\n    if (isNewSourceDocument"
    )
    const sourceReconciliationCallIndex = documentModelContent.indexOf(
      "reconcileSourceDocument(sourceDocument)"
    )
    expect(
      sourceReconciliationEffectIndex,
      `${documentModelFile} keeps source reconciliation in a layout effect`
    ).toBeGreaterThanOrEqual(0)
    expect(
      sourceReconciliationCallIndex,
      `${documentModelFile} calls reconcileSourceDocument for source updates`
    ).toBeGreaterThan(sourceReconciliationEffectIndex)

    const nonOwners: FileBoundary[] = [
      {
        name: "public adapter is not a document state machine",
        file: "components/json-table/single-file-table-view.tsx",
        required: ["useSingleFileTableDocumentModel"],
      },
      {
        name: "runtime composition is not a document state machine",
        file: "components/json-table/single-file-table-runtime.tsx",
        required: ["projectionDocument"],
      },
      {
        name: "virtualized table is not a document state machine",
        file: "components/json-table/single-file-virtualized-table.tsx",
        required: ["onCellCommit"],
      },
      {
        name: "primitive controller reports commits only",
        file: "components/json-table/use-json-table-primitive-control.ts",
        required: ['visibleThrough: "primitivePendingValue"'],
      },
      {
        name: "structured controller reports commits only",
        file: "components/json-table/use-json-table-structured-cell-controller.ts",
        required: ['visibleThrough: "projectedDocumentValue"'],
      },
    ]

    for (const boundary of nonOwners) {
      assertFileBoundary({
        ...boundary,
        forbidden: [
          "documentStateRef",
          "confirmedDocumentData",
          "setProjectionDocument",
          "resetForSourceDocument",
          "reconcileSourceDocument",
          "projectionDocumentForRender",
          "setValueAtMaterializedPath",
          "recordDocumentEcho",
          "reconcileDocumentData",
          ...(boundary.forbidden ?? []),
        ],
      })
    }
  })

  it("keeps SingleFileTableView as the public adapter", () => {
    const file = "components/json-table/single-file-table-view.tsx"
    const content = readFileSync(join(repoRoot, file), "utf8")

    for (const pattern of [
      "buildHeaderNodesFromSchema",
      "createJsonTablePrimitiveEditStore",
      "projectDocumentRows",
      "recordJsonTableRender",
      "SingleFileVirtualizedTable",
      "useJsonTablePrimitivePersistenceBridge",
      "useSheetOptionsStore",
      "React.useLayoutEffect",
      "React.useMemo",
      "React.useState",
    ]) {
      expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
        false
      )
    }

    expect(content.includes("useSingleFileTableDocumentModel")).toBe(true)
    expect(content.includes("SingleFileTableRuntime")).toBe(true)
  })

  it("keeps the table runtime as schema, projection, and virtualization composition", () => {
    const file = "components/json-table/single-file-table-runtime.tsx"
    const content = readFileSync(join(repoRoot, file), "utf8")

    for (const pattern of [
      "useSingleFileTableSchemaModel",
      "useSingleFileTableProjectionModel",
      "SingleFileVirtualizedTable",
    ]) {
      expect(content.includes(pattern), `${file} misses ${pattern}`).toBe(true)
    }

    for (const pattern of [
      "setValueAtMaterializedPath",
      "recordDocumentEcho",
      "reconcileDocumentData",
      "createJsonTablePrimitiveEditStore",
    ]) {
      expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
        false
      )
    }
  })

  it("keeps JSON table module boundaries explicit", () => {
    const moduleBoundaries = [
      {
        file: "components/json-table/single-file-table-view.tsx",
        required: ["useSingleFileTableDocumentModel", "SingleFileTableRuntime"],
        forbidden: [
          "setValueAtMaterializedPath",
          "projectDocumentRows",
          "createJsonTablePrimitiveEditStore",
          "SingleFileVirtualizedTable",
        ],
      },
      {
        file: "components/json-table/single-file-table-runtime.tsx",
        required: [
          "useSingleFileTableSchemaModel",
          "useSingleFileTableProjectionModel",
          "SingleFileVirtualizedTable",
        ],
        forbidden: [
          "setValueAtMaterializedPath",
          "buildDocumentDataPatch",
          "recordDocumentEcho",
          "createJsonTablePrimitiveEditStore",
        ],
      },
      {
        file: "components/json-table/single-file-form-row.tsx",
        required: ["EditableJsonTableCell", "ReadOnlyJsonTableCell"],
        forbidden: [
          "setValueAtMaterializedPath",
          "buildDocumentDataPatch",
          "recordDocumentEcho",
          "reconcileDocumentData",
        ],
      },
      {
        file: "components/json-table/editable-json-table-cell.tsx",
        required: ["createJsonTableDataCellProps", "<DataCell"],
        forbidden: [
          "useJsonTablePrimitiveCommitController",
          "useJsonTableStructuredCellController",
          "onCellCommit",
        ],
      },
      {
        file: "components/json-table/use-json-table-primitive-control.ts",
        required: ["primitiveEditStore.commitValue", "onCellCommit"],
        forbidden: [
          "setValueAtMaterializedPath",
          "buildDocumentDataPatch",
          "onUpdateDocument",
        ],
      },
      {
        file: "components/json-table/use-json-table-structured-cell-controller.ts",
        required: ["onCellCommit"],
        forbidden: [
          "JsonTablePrimitiveEditStore",
          "createJsonTablePrimitiveEditStore",
          "recordDocumentEcho",
        ],
      },
      {
        file: "components/json-table/single-file-virtualized-table.tsx",
        required: ["SingleFileFormRow", "onCellCommit"],
        forbidden: [
          "setValueAtMaterializedPath",
          "buildDocumentDataPatch",
          "recordDocumentEcho",
          "reconcileDocumentData",
          "onUpdateDocument",
        ],
      },
    ]

    for (const boundary of moduleBoundaries) {
      const content = readFileSync(join(repoRoot, boundary.file), "utf8")
      for (const pattern of boundary.required) {
        expect(
          content.includes(pattern),
          `${boundary.file} misses ${pattern}`
        ).toBe(true)
      }
      for (const pattern of boundary.forbidden) {
        expect(
          content.includes(pattern),
          `${boundary.file} contains ${pattern}`
        ).toBe(false)
      }
    }
  })

  it("keeps commit visibleThrough vocabulary semantic", () => {
    const commitFile = "components/json-table/json-table-cell-commit.ts"
    const commitContent = readFileSync(join(repoRoot, commitFile), "utf8")

    expect(commitContent.includes("JsonTableCommitVisibleThrough")).toBe(true)
    expect(commitContent.includes("visibleThrough")).toBe(true)
    expect(commitContent.includes("primitivePendingValue")).toBe(true)
    expect(commitContent.includes("projectedDocumentValue")).toBe(true)

    for (const file of [
      commitFile,
      "components/json-table/use-json-table-primitive-control.ts",
      "components/json-table/use-json-table-structured-cell-controller.ts",
      "components/json-table/use-single-file-table-document-model.ts",
      "components/json-table/ARCHITECTURE.md",
    ]) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      const oldCommitFieldName = `local${"Projection"}`
      const oldSemanticFieldName = `visib${"ility"}`
      const oldVisibilityFieldName = `visibleValue${"Source"}`
      expect(
        content.includes(oldCommitFieldName),
        `${file} leaks old name`
      ).toBe(false)
      expect(
        content.includes(oldSemanticFieldName),
        `${file} leaks old semantic field name`
      ).toBe(false)
      expect(
        content.includes(oldVisibilityFieldName),
        `${file} leaks old visibleThrough field name`
      ).toBe(false)
    }
  })

  it("keeps primitive adapter names local and exact", () => {
    const primitiveControlFile =
      "components/json-table/use-json-table-primitive-control.ts"
    const dataCellModelFile =
      "components/json-table/json-table-data-cell-model.ts"
    const elevatedRowFile = "components/json-table/use-elevated-virtual-row.ts"
    const primitiveControlContent = readFileSync(
      join(repoRoot, primitiveControlFile),
      "utf8"
    )
    const dataCellModelContent = readFileSync(
      join(repoRoot, dataCellModelFile),
      "utf8"
    )
    const elevatedRowContent = readFileSync(
      join(repoRoot, elevatedRowFile),
      "utf8"
    )

    expect(primitiveControlContent.includes("effectiveValue")).toBe(true)
    expect(primitiveControlContent.includes("commitValidatedValue")).toBe(true)
    expect(primitiveControlContent.includes("setActive")).toBe(true)
    expect(
      primitiveControlContent.includes("export type JsonTablePrimitiveControl")
    ).toBe(false)
    expect(
      primitiveControlContent.includes("type JsonTablePrimitiveControl")
    ).toBe(false)
    for (const oldName of [
      "primitiveEffectiveValue",
      "commitPrimitiveValueChange",
      "commitPrimitiveValue",
    ]) {
      expect(
        primitiveControlContent.includes(oldName),
        `${primitiveControlFile} leaks ${oldName}`
      ).toBe(false)
    }
    expect(primitiveControlContent.includes("setPrimitiveActive:")).toBe(false)

    expect(dataCellModelContent.includes("toJsonValue")).toBe(true)
    expect(
      dataCellModelContent.includes("function jsonTableDataCellCommitHandler")
    ).toBe(true)
    expect(
      dataCellModelContent.includes(
        "function jsonTableDataCellJsonCommitHandler"
      )
    ).toBe(true)
    expect(dataCellModelContent.includes("model.commitValue")).toBe(false)
    expect(dataCellModelContent.includes("commitValue: (commitValue")).toBe(
      false
    )
    expect(
      dataCellModelContent.includes("model.toJsonValue(commitValue)")
    ).toBe(false)

    expect(elevatedRowContent.includes("isElevated")).toBe(true)
    expect(elevatedRowContent.includes("isInputFocused")).toBe(false)
    expect(elevatedRowContent.includes("isSelectOpen")).toBe(false)
  })

  it("keeps JSON table test cell commits object-shaped", () => {
    const jsonTableTestFiles = sourceFilesUnder(join(repoRoot, "tests")).filter(
      (file) =>
        file.startsWith("tests/json-table-") &&
        file !== "tests/json-table-architecture.test.ts" &&
        (file.endsWith(".ts") || file.endsWith(".tsx"))
    )

    for (const file of jsonTableTestFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(
        content.includes(`type Test${"Cell"}Commit = (`),
        `${file} defines a tuple-shaped TestCellCommit`
      ).toBe(false)
      expect(
        /onCellCommit[\s\S]*toHaveBeenCalledWith\(\s*["']doc_1["'],/.test(
          content
        ),
        `${file} may assert tuple-shaped onCellCommit payloads`
      ).toBe(false)
    }
  })

  it("keeps primitive shell activation generic and select-blind", () => {
    const handlerFile = "components/json-table/use-json-table-shell-handlers.ts"
    const handlerContent = readFileSync(join(repoRoot, handlerFile), "utf8")

    for (const pattern of forbiddenPrimitiveShellHandlerPatterns) {
      expect(
        handlerContent.includes(pattern),
        `${handlerFile} contains ${pattern}`
      ).toBe(false)
    }

    const activationFile =
      "components/json-table/json-table-primitive-activation.ts"
    const activationContent = readFileSync(
      join(repoRoot, activationFile),
      "utf8"
    )

    for (const pattern of forbiddenPrimitiveShellActivationPatterns) {
      expect(
        activationContent.includes(pattern),
        `${activationFile} contains ${pattern}`
      ).toBe(false)
    }
  })

  it("keeps DataCell as a control-contract shell", () => {
    const shellFile = "registry/new-york-v4/ui/data-cell.tsx"
    const shellContent = readFileSync(join(repoRoot, shellFile), "utf8")

    for (const pattern of forbiddenDataCellShellPatterns) {
      expect(
        shellContent.includes(pattern),
        `${shellFile} contains ${pattern}`
      ).toBe(false)
    }

    const contractFile = "registry/new-york-v4/ui/data-cell-control-contract.ts"
    const registryFile =
      "registry/new-york-v4/ui/data-cell-control-registry.tsx"

    expect(existsSync(join(repoRoot, contractFile)), contractFile).toBe(true)
    expect(existsSync(join(repoRoot, registryFile)), registryFile).toBe(true)
  })

  it("keeps DataCell independent from json-table", () => {
    const selectControlFile =
      "registry/new-york-v4/ui/data-cell-select-control.tsx"
    const selectActivationFile =
      "registry/new-york-v4/ui/data-cell-select-activation.ts"
    const selectKeyboardFile =
      "registry/new-york-v4/ui/data-cell-select-keyboard.ts"
    const selectNavigationFile =
      "registry/new-york-v4/ui/data-cell-select-navigation.ts"
    const selectPopupFile = "registry/new-york-v4/ui/data-cell-select-popup.tsx"
    const selectPopupDismissalFile =
      "registry/new-york-v4/ui/data-cell-select-popup-dismissal.ts"
    const selectPopupPositionFile =
      "registry/new-york-v4/ui/data-cell-select-popup-position.ts"
    const selectStateFile = "registry/new-york-v4/ui/data-cell-select-state.ts"
    const deletedJsonTablePopupFile =
      "components/json-table/json-table-enum-popup.tsx"

    expect(
      existsSync(join(repoRoot, deletedJsonTablePopupFile)),
      deletedJsonTablePopupFile
    ).toBe(false)

    for (const file of dataCellRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(
        content.includes("@/components/json-table"),
        `${file} imports json-table`
      ).toBe(false)
      expect(
        content.includes("components/json-table"),
        `${file} imports json-table`
      ).toBe(false)
      expect(
        content.includes("JsonTable"),
        `${file} contains table-specific naming`
      ).toBe(false)
      for (const pattern of ["jsonValue", "fieldMetadata", "sentinel"]) {
        expect(
          content.includes(pattern),
          `${file} contains table identity detail ${pattern}`
        ).toBe(false)
      }
    }

    const dataCellSelectFiles = [
      selectControlFile,
      selectActivationFile,
      selectKeyboardFile,
      selectNavigationFile,
      selectPopupFile,
      selectPopupDismissalFile,
      selectPopupPositionFile,
      selectStateFile,
    ]

    for (const file of dataCellSelectFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of ["Enum", "enum", "schema"]) {
        expect(
          content.includes(pattern),
          `${file} contains table/select identity detail ${pattern}`
        ).toBe(false)
      }
    }

    const selectPopupContent = readFileSync(
      join(repoRoot, selectPopupFile),
      "utf8"
    )
    const selectControlContent = readFileSync(
      join(repoRoot, selectControlFile),
      "utf8"
    )
    for (const pattern of [
      "_editable",
      "_active",
      "_mode",
      "_name",
      "_dateTimeZone",
      "_showPickerIcon",
      "_draftValue",
      "_onDraftValueChange",
      "_onFocus",
      "_onBlur",
      "_onKeyDown",
      "_onClick",
      "_onDoubleClick",
      "cancelDismissDuringOpening",
      "firstEnabledDataCellSelectOptionIndex",
      "lastEnabledDataCellSelectOptionIndex",
      "nextEnabledDataCellSelectOptionIndex",
      "selectedDataCellSelectOptionIndex",
    ]) {
      expect(
        selectControlContent.includes(pattern),
        `${selectControlFile} contains uncompressed select control detail ${pattern}`
      ).toBe(false)
    }

    for (const pattern of [
      "getBoundingClientRect",
      "window.addEventListener",
      "document.addEventListener",
      "nextEnabledDataCellSelectOptionIndex",
      "getDataCellSelectPopupPosition",
    ]) {
      expect(
        selectPopupContent.includes(pattern),
        `${selectPopupFile} owns delegated select policy ${pattern}`
      ).toBe(false)
    }

    for (const file of [selectNavigationFile, selectPopupPositionFile]) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of ["React", "document", "window"]) {
        expect(
          content.includes(pattern),
          `${file} contains impure primitive dependency ${pattern}`
        ).toBe(false)
      }
    }

    const selectKeyboardContent = readFileSync(
      join(repoRoot, selectKeyboardFile),
      "utf8"
    )
    for (const pattern of ["document", "window", "getBoundingClientRect"]) {
      expect(
        selectKeyboardContent.includes(pattern),
        `${selectKeyboardFile} contains browser or popup policy ${pattern}`
      ).toBe(false)
    }
  })

  it("keeps primitive controls on exact kind-specific props", () => {
    for (const file of dataCellPrimitiveControlFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")

      for (const pattern of forbiddenPrimitiveControlPatterns) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }

      for (const pattern of forbiddenPrimitiveIgnoredPropAliases) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
    }

    const contractFile = "registry/new-york-v4/ui/data-cell-control-contract.ts"
    const displayFile = "registry/new-york-v4/ui/data-cell-display.tsx"
    const displayModelFile =
      "registry/new-york-v4/ui/data-cell-display-model.ts"
    const shellFile = "registry/new-york-v4/ui/data-cell.tsx"
    const typesFile = "registry/new-york-v4/ui/data-cell-types.ts"
    const registryFile =
      "registry/new-york-v4/ui/data-cell-control-registry.tsx"
    const controlFile = "registry/new-york-v4/ui/data-cell-control.tsx"
    const actionsFile = "registry/new-york-v4/ui/data-cell-control-actions.ts"
    const propsFile = "registry/new-york-v4/ui/data-cell-control-props.ts"
    const publicBarrelFile = "components/ui/data-cell.tsx"
    const contractContent = readFileSync(join(repoRoot, contractFile), "utf8")
    const actionsContent = readFileSync(join(repoRoot, actionsFile), "utf8")
    const propsContent = readFileSync(join(repoRoot, propsFile), "utf8")
    const displayContent = readFileSync(join(repoRoot, displayFile), "utf8")
    const displayModelContent = readFileSync(
      join(repoRoot, displayModelFile),
      "utf8"
    )
    const pickerIconFile = "registry/new-york-v4/ui/data-cell-picker-icon.tsx"
    const pickerIconContent = readFileSync(
      join(repoRoot, pickerIconFile),
      "utf8"
    )
    const booleanControlFile =
      "registry/new-york-v4/ui/data-cell-boolean-control.tsx"
    const booleanControlContent = readFileSync(
      join(repoRoot, booleanControlFile),
      "utf8"
    )
    const pickerControlFile =
      "registry/new-york-v4/ui/data-cell-picker-control.tsx"
    const pickerControlContent = readFileSync(
      join(repoRoot, pickerControlFile),
      "utf8"
    )
    const selectControlFile =
      "registry/new-york-v4/ui/data-cell-select-control.tsx"
    const selectControlContent = readFileSync(
      join(repoRoot, selectControlFile),
      "utf8"
    )
    const selectStateFile = "registry/new-york-v4/ui/data-cell-select-state.ts"
    const selectStateContent = readFileSync(
      join(repoRoot, selectStateFile),
      "utf8"
    )
    const shellContent = readFileSync(join(repoRoot, shellFile), "utf8")
    const publicBarrelContent = readFileSync(
      join(repoRoot, publicBarrelFile),
      "utf8"
    )
    const typesContent = readFileSync(join(repoRoot, typesFile), "utf8")
    const registryContent = readFileSync(join(repoRoot, registryFile), "utf8")
    const controlContent = readFileSync(join(repoRoot, controlFile), "utf8")
    const editModelFile = "registry/new-york-v4/ui/data-cell-edit-model.ts"
    const editModelContent = readFileSync(join(repoRoot, editModelFile), "utf8")
    const sessionFile = "registry/new-york-v4/ui/data-cell-session.ts"
    const sessionContent = readFileSync(join(repoRoot, sessionFile), "utf8")
    const inputControlFile =
      "registry/new-york-v4/ui/data-cell-input-control.tsx"
    const inputControlContent = readFileSync(
      join(repoRoot, inputControlFile),
      "utf8"
    )

    expect(contractContent.includes("DataCellControlPropsByKind")).toBe(true)
    expect(contractContent.includes("DataCellPublicPropsByKind")).toBe(false)
    expect(contractContent.includes("controlProps")).toBe(false)
    expect(contractContent.includes("DataCellControlAdapter")).toBe(false)
    expect(contractContent.includes("DataCellProps &")).toBe(false)
    expect(contractContent.includes("props: DataCellProps")).toBe(false)
    expect(contractContent.includes("DataCellProps")).toBe(false)
    expect(contractContent.includes("React.InputHTMLAttributes")).toBe(false)
    expect(contractContent.includes("React.ButtonHTMLAttributes")).toBe(false)
    expect(
      contractContent.includes("React.HTMLAttributes<HTMLDivElement>")
    ).toBe(false)
    expect(contractContent.includes("DataCellInputNativeProps")).toBe(false)
    expect(contractContent.includes("DataCellSelectNativeProps")).toBe(false)
    expect(contractContent.includes("DataCellPickerNativeProps")).toBe(false)
    expect(contractContent.includes("DataCellBooleanRootProps")).toBe(false)
    expect(contractContent.includes("DataCellEditorProps &")).toBe(true)
    expect(contractContent.includes(`is${"Picker"}Open`)).toBe(false)
    expect(contractContent.includes(`on${"Picker"}OpenChange`)).toBe(false)
    expect(contractContent.includes("DataCellTextInputControlProps")).toBe(true)
    expect(contractContent.includes("DataCellNumberInputControlProps")).toBe(
      true
    )
    expect(contractContent.includes("DataCellTextControlProps")).toBe(false)
    expect(contractContent.includes("DataCellNumberControlProps")).toBe(false)
    expect(registryContent.includes("DataCellProps")).toBe(false)
    expect(registryContent.includes("DataCellPublicPropsByKind")).toBe(false)
    expect(registryContent.includes("DataCellControlPropsByKind")).toBe(true)
    expect(registryContent.includes("DataCellPrimitiveSession")).toBe(false)
    expect(registryContent.includes("dataCellControlByKind")).toBe(true)
    expect(controlContent.includes("DataCellControlPropsByKind")).toBe(false)
    expect(controlContent.includes("useDataCellPrimitiveSession")).toBe(true)
    expect(controlContent.includes("useDataCellEditModelSession")).toBe(true)
    expect(controlContent.includes("dataCellControlByKind")).toBe(true)
    expect(registryContent.includes("getDataCellPointerControlAction")).toBe(
      false
    )
    expect(
      registryContent.includes("createDataCellPointerActivationSource")
    ).toBe(false)
    expect(
      registryContent.includes("getDataCellTextPointerActivationSource")
    ).toBe(false)
    expect(registryContent.includes("commitDataCellBooleanToggle")).toBe(false)
    expect(registryContent.includes("dataCellInputControlProps")).toBe(false)
    expect(registryContent.includes("dataCellTextControlProps")).toBe(false)
    expect(registryContent.includes("dataCellNumberControlProps")).toBe(false)
    expect(controlContent.includes("dataCellInputControlProps")).toBe(true)
    expect(controlContent.includes("dataCellTextControlProps")).toBe(false)
    expect(controlContent.includes("dataCellNumberControlProps")).toBe(false)
    expect(actionsContent.includes("getDataCellPointerControlAction")).toBe(
      true
    )
    expect(actionsContent.includes("getDataCellClickControlAction")).toBe(true)
    expect(actionsContent.includes("getDataCellKeyControlAction")).toBe(true)
    expect(actionsContent.includes("createDataCellControlState")).toBe(true)
    expect(
      actionsContent.includes("createDataCellNonBooleanControlState")
    ).toBe(true)
    expect(actionsContent.includes('props.kind === "boolean"')).toBe(true)
    for (const duplicatedControlStateBranch of [
      'props.kind === "text"',
      'props.kind === "number"',
      'props.kind === "integer"',
      'props.kind === "select"',
      'props.kind === "date"',
      'props.kind === "time"',
      'props.kind === "date-time"',
    ]) {
      expect(
        actionsContent.includes(duplicatedControlStateBranch),
        `${actionsFile} repeats non-boolean state branch ${duplicatedControlStateBranch}`
      ).toBe(false)
    }
    expect(actionsContent.includes("commitDataCellBooleanToggle")).toBe(true)
    expect(actionsContent.includes("DataCellProps")).toBe(false)
    expect(actionsContent.includes("DataCellTextControl")).toBe(false)
    expect(actionsContent.includes("DataCellPickerControl")).toBe(false)
    expect(actionsContent.includes("data-cell-input-control")).toBe(false)
    expect(actionsContent.includes("data-cell-text-control")).toBe(false)
    expect(actionsContent.includes("data-cell-number-control")).toBe(false)
    expect(actionsContent.includes("data-cell-boolean-control")).toBe(false)
    expect(actionsContent.includes("data-cell-text-activation")).toBe(true)
    expect(actionsContent.includes("data-cell-boolean-value")).toBe(true)
    expect(propsContent.includes("dataCellInputControlProps")).toBe(true)
    expect(propsContent.includes("dataCellTextControlProps")).toBe(false)
    expect(propsContent.includes("dataCellNumberControlProps")).toBe(false)
    expect(propsContent.includes("as DataCellControlStaticPropsByKind")).toBe(
      false
    )
    expect(propsContent.includes("dataCellPickerControlProps")).toBe(true)
    expect(propsContent.includes("useDataCellPrimitiveSession")).toBe(false)
    expect(propsContent.includes("createDataCellPointerActivationSource")).toBe(
      false
    )
    expect(shellContent.includes("type DataCellDisplayProps")).toBe(false)
    expect(shellContent.includes("props.kind")).toBe(false)
    expect(displayModelContent.includes("createDataCellDisplayProps")).toBe(
      true
    )
    expect(displayModelContent.includes("DataCellDisplayProps")).toBe(true)
    for (const controlName of [
      "DataCellBooleanControl",
      "DataCellNumberControl",
      "DataCellPickerControl",
      "DataCellSelectControl",
      "DataCellTextControl",
    ]) {
      expect(
        shellContent.includes(`import { ${controlName} }`),
        `${shellFile} imports ${controlName} only to re-export it`
      ).toBe(false)
      expect(
        shellContent.includes(`export { ${controlName} }`),
        `${shellFile} publicly exports ${controlName}`
      ).toBe(false)
      expect(
        publicBarrelContent.includes(controlName),
        `${publicBarrelFile} publicly exports ${controlName}`
      ).toBe(false)
    }
    expect(publicBarrelContent.includes("DataCellControl")).toBe(false)
    for (const publicInternalName of [
      "createDataCellPointerActivationSource",
      "createDataCellKeyboardActivationSource",
      "createDataCellShellActivationSource",
      "DataCellActivationSource",
      "DataCellActivationToken",
      "canActivateDataCellFromKey",
    ]) {
      expect(
        publicBarrelContent.includes(publicInternalName),
        `${publicBarrelFile} publicly exports ${publicInternalName}`
      ).toBe(false)
    }
    expect(publicBarrelContent.includes("DataCellActivationRequest")).toBe(
      false
    )
    expect(publicBarrelContent.includes("DataCellMode")).toBe(false)
    expect(publicBarrelContent.includes("DataCellEditorHandle")).toBe(false)
    expect(typesContent.includes("DataCellMode")).toBe(false)
    expect(typesContent.includes("DataCellEditorHandle")).toBe(false)
    expect(typesContent.includes("mode?:")).toBe(false)
    expect(
      registryContent.includes("export function DataCellControl(props")
    ).toBe(false)
    expect(registryContent.includes("model: DataCellEditModel")).toBe(false)
    expect(controlContent.includes("model: DataCellEditModel")).toBe(true)
    expect(displayContent.includes("DataCellProps")).toBe(false)
    expect(displayContent.includes("DataCellDisplayProps")).toBe(true)
    expect(displayContent.includes("data-cell-picker-control")).toBe(false)
    expect(displayContent.includes("data-cell-picker-icon")).toBe(true)
    expect(pickerIconContent.includes("DataCellPickerIcon")).toBe(true)
    expect(pickerIconContent.includes("CalendarIcon")).toBe(true)
    expect(
      typesContent.includes(`DataCellBaseProps<"number" | "integer"`)
    ).toBe(false)
    expect(
      typesContent.includes(`DataCellBaseProps<"date" | "time" | "date-time"`)
    ).toBe(false)
    const basePropsMatch = typesContent.match(
      /type DataCellBaseProps[\s\S]*?^\s*}/m
    )
    expect(basePropsMatch, "DataCellBaseProps exists").not.toBeNull()
    const basePropsContent = basePropsMatch?.[0] ?? ""
    for (const propName of [
      "placeholder?:",
      "selectOptions?:",
      "dateTimeZone?:",
      "showPickerIcon?:",
      "open?:",
      "formatValue?:",
      "draftValue?:",
      "onDraftValueChange?:",
      "onOpenChange?:",
    ]) {
      expect(
        basePropsContent.includes(propName),
        `DataCellBaseProps contains kind-specific ${propName}`
      ).toBe(false)
    }
    expect(typesContent.includes("type DataCellSelectProps")).toBe(true)
    expect(typesContent.includes("selectOptions: DataCellSelectOption[]")).toBe(
      true
    )
    expect(typesContent.includes("type DataCellPickerProps")).toBe(true)
    expect(typesContent.includes("dateTimeZone?: DataCellDateTimeZone")).toBe(
      true
    )
    expect(typesContent.includes("showPickerIcon?: boolean")).toBe(true)
    expect(
      displayContent.includes(`DataCellDisplayBaseProps<"number" | "integer"`)
    ).toBe(false)
    expect(
      displayContent.includes(
        `DataCellDisplayBaseProps<"date" | "time" | "date-time"`
      )
    ).toBe(false)
    const displayBasePropsMatch = displayContent.match(
      /type DataCellDisplayBaseProps[\s\S]*?^\s*}/m
    )
    expect(
      displayBasePropsMatch,
      "DataCellDisplayBaseProps exists"
    ).not.toBeNull()
    const displayBasePropsContent = displayBasePropsMatch?.[0] ?? ""
    for (const propName of [
      "placeholder?:",
      "showPickerIcon?:",
      "formatValue?:",
    ]) {
      expect(
        displayBasePropsContent.includes(propName),
        `DataCellDisplayBaseProps contains kind-specific ${propName}`
      ).toBe(false)
    }
    expect(displayContent.includes("DataCellDisplayPlaceholderProps")).toBe(
      true
    )
    expect(displayContent.includes("DataCellDisplayPickerProps")).toBe(true)
    expect(displayContent.includes("DataCellDisplayFormatProps")).toBe(true)
    expect(editModelContent.includes("createDataCellEditModel")).toBe(true)
    expect(editModelContent.includes("createDataCellControlState")).toBe(false)
    expect(editModelContent.includes("DataCellControlState")).toBe(false)
    expect(editModelContent.includes("controlState:")).toBe(false)
    expect(shellContent.includes("createDataCellControlState")).toBe(true)
    expect(
      shellContent.includes("data-cell-control-state"),
      `${shellFile} imports deleted control-state adapter`
    ).toBe(false)
    expect(shellContent.includes("editModel.controlState")).toBe(false)
    expect(editModelContent.includes("DataCellEditorProps")).toBe(true)
    expect(editModelContent.includes("DataCellNativePropsForKind")).toBe(false)
    expect(editModelContent.includes("DataCellEditSource")).toBe(false)
    expect(editModelContent.includes("nativeProps")).toBe(false)
    expect(sessionContent.includes("useDataCellPrimitiveSession")).toBe(true)
    expect(sessionContent.includes("didFinishEditingRef")).toBe(false)
    expect(sessionContent.includes("DataCellPrimitiveSession<")).toBe(false)
    expect(sessionContent.includes("useDataCellPrimitiveSession<")).toBe(false)
    expect(sessionContent.includes("DataCellCommitValue")).toBe(true)
    expect(registryContent.includes("useDataCellPrimitiveSession")).toBe(false)
    expect(registryContent.includes("useDataCellEditModelSession")).toBe(false)
    expect(registryContent.includes("useDataCellPrimitiveSession<")).toBe(false)
    expect(controlContent.includes("useDataCellPrimitiveSession<")).toBe(false)
    expect(registryContent.includes("model.onCommit as")).toBe(false)
    expect(controlContent.includes("model.onCommit as")).toBe(false)
    expect(editModelContent.includes("dataCellCommitHandler")).toBe(true)
    expect(editModelContent.includes("dataCellEditModelBase")).toBe(true)
    expect(editModelContent.includes("DataCellTypedPropsForKind")).toBe(true)
    expect(editModelContent.includes("props.kind,\n      props")).toBe(false)
    expect(editModelContent.includes("props.onCommit,\n      shellState")).toBe(
      false
    )
    expect(
      editModelContent.match(/const editState = dataCellEditShellState/g)
        ?.length ?? 0
    ).toBe(1)
    expect(
      editModelContent.match(/editorProps: dataCellEditorProps\(props\)/g)
        ?.length ?? 0
    ).toBe(1)
    expect(
      editModelContent.match(/onEditingEnd: editState\.onEditingEnd/g)
        ?.length ?? 0
    ).toBe(1)
    expect(editModelContent.includes("isDataCellStringCommitValue")).toBe(true)
    expect(editModelContent.includes("isDataCellNumberCommitValue")).toBe(true)
    expect(editModelContent.includes("isDataCellBooleanCommitValue")).toBe(true)
    expect(contractContent.includes("session: DataCellPrimitiveSession")).toBe(
      true
    )
    expect(contractContent.includes("DataCellPrimitiveSession<")).toBe(false)
    expect(contractContent.includes("onCommit?:")).toBe(false)
    expect(contractContent.includes("onEditingEnd?:")).toBe(false)
    expect(contractContent.includes("type DataCellDraftControl")).toBe(true)
    expect(contractContent.includes("type DataCellOpenControl")).toBe(true)
    expect(contractContent.includes("draft?: DataCellDraftControl")).toBe(true)
    expect(contractContent.includes("openState?: DataCellOpenControl")).toBe(
      true
    )
    expect(contractContent.includes("draftValue?: string")).toBe(false)
    expect(contractContent.includes("onDraftValueChange?:")).toBe(false)
    expect(contractContent.includes("open?: boolean")).toBe(false)
    expect(contractContent.includes("onOpenChange?:")).toBe(false)
    expect(editModelContent.includes("draft?: DataCellDraftEditState")).toBe(
      true
    )
    expect(editModelContent.includes("openState?: DataCellOpenEditState")).toBe(
      true
    )
    expect(editModelContent.includes("draftValue?: string")).toBe(false)
    expect(editModelContent.includes("onDraftValueChange?:")).toBe(false)
    expect(editModelContent.includes("open?: boolean")).toBe(false)
    expect(editModelContent.includes("onOpenChange?:")).toBe(false)
    expect(propsContent.includes("draft: model.draft")).toBe(true)
    expect(propsContent.includes("openState: model.openState")).toBe(true)
    for (const internalPublicStateLeak of [
      "model.draftValue",
      "model.onDraftValueChange",
      "model.open,",
      "model.open\n",
      "model.onOpenChange",
    ]) {
      expect(
        registryContent.includes(internalPublicStateLeak),
        `${registryFile} leaks ${internalPublicStateLeak}`
      ).toBe(false)
      expect(
        controlContent.includes(internalPublicStateLeak),
        `${controlFile} leaks ${internalPublicStateLeak}`
      ).toBe(false)
      expect(
        propsContent.includes(internalPublicStateLeak),
        `${propsFile} leaks ${internalPublicStateLeak}`
      ).toBe(false)
    }
    expect(inputControlContent.includes("draftValue")).toBe(false)
    expect(inputControlContent.includes("onDraftValueChange")).toBe(false)
    expect(pickerControlContent.includes("draftValue")).toBe(false)
    expect(pickerControlContent.includes("onDraftValueChange")).toBe(false)
    expect(pickerControlContent.includes("openState")).toBe(true)
    expect(selectControlContent.includes("openState")).toBe(true)
    expect(selectStateContent.includes("openState")).toBe(true)
    expect(inputControlContent.includes("useDataCellPrimitiveSession")).toBe(
      false
    )
    expect(inputControlContent.includes("useDataCellOpeningContext")).toBe(true)
    expect(inputControlContent.includes("releaseAfterMicrotask: true")).toBe(
      true
    )
    expect(inputControlContent.includes("isOpeningPointerBlurRef")).toBe(false)
    expect(inputControlContent.includes("setTimeout")).toBe(false)
    expect(inputControlContent.includes("document.addEventListener")).toBe(
      false
    )
    expect(booleanControlContent.includes("useDataCellPrimitiveSession")).toBe(
      false
    )
    expect(pickerControlContent.includes("useDataCellPrimitiveSession")).toBe(
      false
    )
    expect(selectStateContent.includes("useDataCellPrimitiveSession")).toBe(
      false
    )
    expect(
      inputControlContent.includes("export function DataCellInputControl")
    ).toBe(true)
    expect(
      inputControlContent.includes("export function DataCellTextControl")
    ).toBe(false)
    expect(inputControlContent.includes("DataCellTextControlProps")).toBe(false)
    expect(inputControlContent.includes("as string | number | null")).toBe(
      false
    )
    expect(pickerControlContent.includes("as string | null")).toBe(false)
    expect(pickerControlContent.includes("previousValue: value as")).toBe(false)
    expect(inputControlContent.includes("didFinishEditingRef")).toBe(false)
    for (const lifecycleFileContent of [
      booleanControlContent,
      pickerControlContent,
      selectStateContent,
      inputControlContent,
    ]) {
      expect(lifecycleFileContent.includes("didFinishEditingRef")).toBe(false)
      expect(lifecycleFileContent.includes("onEditingEnd")).toBe(false)
      expect(lifecycleFileContent.includes("onEditingEnd?.()")).toBe(false)
    }
    expect(
      editModelContent.includes(
        "export type DataCellIntegerEditModel = DataCellNumberEditModel"
      )
    ).toBe(false)
    expect(editModelContent.includes("DataCellNumberCommitHandler")).toBe(false)
    expect(editModelContent.includes("DataCellPickerCommitHandler")).toBe(false)
    expect(editModelContent.includes("DataCellDateEditModel")).toBe(true)
    expect(editModelContent.includes("DataCellTimeEditModel")).toBe(true)
    expect(editModelContent.includes("DataCellDateTimeEditModel")).toBe(true)
    expect(editModelContent.includes("{ ...props, kind:")).toBe(false)
    expect(editModelContent.includes("as Record<string, unknown>")).toBe(false)
    expect(editModelContent.includes("propName as keyof")).toBe(false)
    expect(editModelContent.includes("assignDataCellAriaAttribute")).toBe(true)
    expect(editModelContent.includes("assignDataCellDataAttribute")).toBe(true)
    expect(registryContent.includes("model.nativeProps")).toBe(false)
    expect(registryContent.includes("model.editorProps")).toBe(false)
    expect(controlContent.includes("model.nativeProps")).toBe(false)
    expect(controlContent.includes("model.editorProps")).toBe(false)
    expect(propsContent.includes("model.editorProps")).toBe(true)
    expect(registryContent.includes("renderDataCellControl(")).toBe(false)
    expect(registryContent.includes("const Control = adapter.Control")).toBe(
      false
    )
    expect(registryContent.includes("createKeyboardEditAction")).toBe(false)
    expect(actionsContent.includes("createDefaultPointerEditAction")).toBe(true)
    expect(actionsContent.includes("createDefaultClickEditAction")).toBe(true)
    expect(registryContent.includes("createKeyboardInputEditAction")).toBe(
      false
    )
    expect(registryContent.includes("createKeyboardOpenAction")).toBe(false)
    expect(registryContent.includes("DataCellPointerActionHandlers")).toBe(
      false
    )
    expect(registryContent.includes("DataCellKeyActionHandlers")).toBe(false)
    expect(registryContent.includes("dataCellKeyActionWithAdapter")).toBe(false)
    expect(registryContent.includes("textControlAdapter[actionName]")).toBe(
      false
    )
    expect(registryContent.includes("dataCellControlAdapterByKind")).toBe(false)
    expect(registryContent.includes("canActivateDataCellFromKey")).toBe(false)
    expect(registryContent.includes("isDataCellPickerEditModel")).toBe(false)
    expect(registryContent.includes("DataCellProps &")).toBe(false)
    for (const pattern of forbiddenPrimitiveIgnoredPropAliases) {
      expect(
        registryContent.includes(pattern),
        `${registryFile} contains ${pattern}`
      ).toBe(false)
      expect(
        displayContent.includes(pattern),
        `${displayFile} contains ${pattern}`
      ).toBe(false)
    }
    expect(registryContent.includes("<DataCellTextControl {...props}")).toBe(
      false
    )
    expect(registryContent.includes("<DataCellNumberControl {...props}")).toBe(
      false
    )
    expect(registryContent.includes("<DataCellBooleanControl {...props}")).toBe(
      false
    )
    expect(registryContent.includes("<DataCellSelectControl {...props}")).toBe(
      false
    )
    expect(registryContent.includes("<DataCellPickerControl {...props}")).toBe(
      false
    )
    expect(registryContent.includes("DataCellInputControl")).toBe(true)
    expect(registryContent.includes("DataCellTextControl")).toBe(false)
    expect(registryContent.includes("DataCellNumberControl")).toBe(false)
    expect(registryContent.includes("data-cell-number-control")).toBe(false)
    expect(registryContent.includes("text: DataCellInputControl")).toBe(true)
    expect(registryContent.includes("number: DataCellInputControl")).toBe(true)
    expect(registryContent.includes("integer: DataCellInputControl")).toBe(true)
    expect(registryContent.match(/\bcontrolProps:/g)?.length ?? 0).toBe(0)
  })

  it("keeps json-table DataCell adaptation pure and outside the renderer", () => {
    const modelFile = "components/json-table/json-table-data-cell-model.ts"
    const editableCellFile =
      "components/json-table/editable-json-table-cell.tsx"
    const deletedDisplayFile =
      "components/json-table/json-table-display-cell.tsx"
    const primitiveFile = "components/json-table/json-table-primitive-cell.tsx"
    const structuredActiveFile =
      "components/json-table/json-table-structured-active-cell.tsx"
    const readOnlyDisplayFile =
      "components/json-table/json-table-read-only-primitive-cell.tsx"
    const primitiveKindFile =
      "components/json-table/json-table-primitive-kind.ts"
    const displayValueFile = "components/json-table/json-table-display-value.ts"
    const dataCellValueFile =
      "components/json-table/json-table-data-cell-value.ts"
    const selectOptionsFile =
      "components/json-table/json-table-select-options.ts"
    const commitValueFile = "components/json-table/json-table-commit-value.ts"
    const modelContent = readFileSync(join(repoRoot, modelFile), "utf8")
    const editableCellContent = readFileSync(
      join(repoRoot, editableCellFile),
      "utf8"
    )
    const primitiveContent = readFileSync(join(repoRoot, primitiveFile), "utf8")
    const structuredActiveContent = readFileSync(
      join(repoRoot, structuredActiveFile),
      "utf8"
    )
    const readOnlyDisplayContent = readFileSync(
      join(repoRoot, readOnlyDisplayFile),
      "utf8"
    )
    const primitiveKindContent = readFileSync(
      join(repoRoot, primitiveKindFile),
      "utf8"
    )
    const displayValueContent = readFileSync(
      join(repoRoot, displayValueFile),
      "utf8"
    )
    const dataCellValueContent = readFileSync(
      join(repoRoot, dataCellValueFile),
      "utf8"
    )
    const selectOptionsContent = readFileSync(
      join(repoRoot, selectOptionsFile),
      "utf8"
    )
    const commitValueContent = readFileSync(
      join(repoRoot, commitValueFile),
      "utf8"
    )

    expect(existsSync(join(repoRoot, modelFile)), modelFile).toBe(true)
    expect(existsSync(join(repoRoot, deletedDisplayFile))).toBe(false)
    expect(
      existsSync(join(repoRoot, primitiveKindFile)),
      primitiveKindFile
    ).toBe(true)
    expect(existsSync(join(repoRoot, displayValueFile)), displayValueFile).toBe(
      true
    )
    expect(
      existsSync(join(repoRoot, dataCellValueFile)),
      dataCellValueFile
    ).toBe(true)
    expect(
      existsSync(join(repoRoot, selectOptionsFile)),
      selectOptionsFile
    ).toBe(true)
    expect(existsSync(join(repoRoot, commitValueFile)), commitValueFile).toBe(
      true
    )
    expect(modelContent.includes("createJsonTableDataCellModel")).toBe(false)
    for (const internalType of [
      "JsonTableSelectDataCellModel",
      "JsonTableBooleanDataCellModel",
      "JsonTableNumberDataCellModel",
      "JsonTableTextDataCellModel",
      "JsonTableDataCellModel",
      "JsonTableDataCellSharedProps",
      "JsonTableDataCellCommitHandler",
      "JsonTableTextDataCellKind",
      "JsonTableDataCellJsonCommitValue",
    ]) {
      expect(
        modelContent.includes(`export type ${internalType}`),
        `${modelFile} exports internal ${internalType}`
      ).toBe(false)
      expect(
        modelContent.includes(`type ${internalType}`),
        `${modelFile} keeps overqualified local ${internalType}`
      ).toBe(false)
    }
    expect(primitiveContent.includes("JsonTablePrimitiveCellProps")).toBe(false)
    expect(
      structuredActiveContent.includes("JsonTableStructuredActiveCellProps")
    ).toBe(false)
    expect(modelContent.includes("selectDataCellProps")).toBe(true)
    expect(modelContent.includes("numberDataCellProps")).toBe(true)
    expect(modelContent.includes("booleanDataCellProps")).toBe(true)
    expect(modelContent.includes("textDataCellProps")).toBe(true)
    expect(modelContent.includes("fallbackTextDataCellProps")).toBe(true)
    expect(modelContent.includes("type ShellProps")).toBe(true)
    expect(modelContent.includes("SharedDataCellProps")).toBe(false)
    expect(modelContent.includes("sharedProps")).toBe(false)
    expect(modelContent.includes("selectDataCellModel")).toBe(false)
    expect(modelContent.includes("numberDataCellModel")).toBe(false)
    expect(modelContent.includes("booleanDataCellModel")).toBe(false)
    expect(modelContent.includes("textDataCellModel")).toBe(false)
    expect(modelContent.includes("fallbackTextDataCellModel")).toBe(false)
    expect(modelContent.includes("jsonTableDataCellPropsForModel")).toBe(false)
    expect(primitiveKindContent.includes("jsonTablePrimitiveKind")).toBe(true)
    expect(displayValueContent.includes("jsonTableDisplayText")).toBe(true)
    expect(dataCellValueContent.includes("jsonTableDataCellValue")).toBe(true)
    expect(selectOptionsContent.includes("nullSelectOptionValue")).toBe(true)
    expect(selectOptionsContent.includes("jsonValuesEqual")).toBe(true)
    expect(selectOptionsContent.includes("jsonTableSelectCommitValue")).toBe(
      true
    )
    for (const pattern of [
      "document.",
      "window.",
      "PointerEvent",
      "KeyboardEvent",
    ]) {
      expect(
        selectOptionsContent.includes(pattern),
        `${selectOptionsFile} owns DOM behavior ${pattern}`
      ).toBe(false)
    }
    expect(commitValueContent.includes("dateStringToFormat")).toBe(true)
    expect(commitValueContent.includes("jsonTableCommitValue")).toBe(true)
    expect(modelContent.includes("createJsonTableDataCellProps")).toBe(true)
    expect(editableCellContent.includes("createJsonTableDataCellProps")).toBe(
      true
    )
    expect(primitiveContent.includes("createJsonTableDataCellProps")).toBe(true)
    expect(primitiveContent.includes("<DataCell {...dataCellProps} />")).toBe(
      true
    )
    expect(primitiveContent.includes("import { JsonTableDataCell")).toBe(false)
    expect(primitiveContent.includes("<JsonTableDataCell")).toBe(false)
    expect(editableCellContent.includes("<JsonTableDisplayCell")).toBe(false)
    expect(editableCellContent.includes("<DataCell")).toBe(true)
    expect(
      editableCellContent.includes("export function JsonTableDataCell")
    ).toBe(false)
    for (const pattern of [
      "export function JsonTableDataCell",
      "export function JsonTableDisplayCell",
      "function JsonTableSelectDataCell",
      "function JsonTableBooleanDataCell",
      "function JsonTableNumberDataCell",
      "function JsonTableTextDataCell",
    ]) {
      expect(
        editableCellContent.includes(pattern),
        `${editableCellFile} renders through wrapper ${pattern}`
      ).toBe(false)
    }

    for (const pattern of [
      "nullSelectOptionValue",
      "JSON_TABLE_",
      "dateStringToFormat",
      "parseDateStringAsLocal",
      "jsonValuesEqual",
      "jsonSelectCommitValue",
      "jsonTableSelectCommitValue",
      "jsonCommitValue",
      "jsonTableNumberDataCellValue(",
      "jsonTableTextDataCellValue(",
      "primitiveKindForField",
      "as DataCellProps",
      "as never",
      "selectOptions: []",
    ]) {
      expect(
        editableCellContent.includes(pattern),
        `${editableCellFile} contains ${pattern}`
      ).toBe(false)
    }

    for (const pattern of [
      "nullSelectOptionValue",
      "dateStringToFormat",
      "parseDateStringAsLocal",
      "jsonValuesEqual",
      "jsonTableSelectCommitValue",
      "jsonTablePrimitiveKind",
      "as DataCellProps",
      "as never",
    ]) {
      expect(
        readOnlyDisplayContent.includes(pattern),
        `${readOnlyDisplayFile} contains ${pattern}`
      ).toBe(false)
    }

    for (const pattern of [
      "nullSelectOptionValue",
      "dateStringToFormat",
      "parseDateStringAsLocal",
      "jsonValuesEqual",
      "jsonTableSelectCommitValue",
      "selectOptionValue",
    ]) {
      expect(
        modelContent.includes(pattern),
        `${modelFile} owns projection detail ${pattern}`
      ).toBe(false)
    }

    for (const pattern of [
      "jsonTableDataCellClass",
      "jsonTableSelectDataCellClass",
    ]) {
      expect(
        selectOptionsContent.includes(pattern),
        `${selectOptionsFile} imports rendering detail ${pattern}`
      ).toBe(false)
      expect(
        commitValueContent.includes(pattern),
        `${commitValueFile} imports rendering detail ${pattern}`
      ).toBe(false)
    }

    for (const pattern of [
      "enumModel",
      "numberModel",
      "booleanModel",
      "stringModel",
      "fallbackTextModel",
      "enumOptionValue",
      "dateDisplayValue",
      "primitiveJsonValue",
    ]) {
      expect(
        modelContent.includes(pattern),
        `${modelFile} contains compatibility alias ${pattern}`
      ).toBe(false)
    }
  })

  it("keeps primitive DataCell activation on the source/action vocabulary", () => {
    for (const file of dataCellRuntimeFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of forbiddenDataCellActivationPatterns) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
    }

    const selectFile = "registry/new-york-v4/ui/data-cell-select-control.tsx"
    const selectContent = readFileSync(join(repoRoot, selectFile), "utf8")
    for (const pattern of forbiddenSelectOpeningPatterns) {
      expect(
        selectContent.includes(pattern),
        `${selectFile} contains ${pattern}`
      ).toBe(false)
    }

    const pickerFile = "registry/new-york-v4/ui/data-cell-picker-control.tsx"
    const pickerContent = readFileSync(join(repoRoot, pickerFile), "utf8")
    for (const pattern of forbiddenPickerOpeningPatterns) {
      expect(
        pickerContent.includes(pattern),
        `${pickerFile} contains ${pattern}`
      ).toBe(false)
    }
  })

  it("keeps overlay opening policy centralized in data-cell-activation", () => {
    const activationFile = "registry/new-york-v4/ui/data-cell-activation.ts"

    for (const file of dataCellRuntimeFiles) {
      if (file === activationFile) continue
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of forbiddenOverlayOpeningPolicyPatterns) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
    }

    const selectActivationFile =
      "registry/new-york-v4/ui/data-cell-select-activation.ts"
    const selectActivationContent = readFileSync(
      join(repoRoot, selectActivationFile),
      "utf8"
    )
    expect(selectActivationContent.includes("useDataCellOpeningContext")).toBe(
      true
    )
    expect(selectActivationContent.includes("DataCellDismissCause")).toBe(true)

    const pickerFile = "registry/new-york-v4/ui/data-cell-picker-control.tsx"
    const pickerContent = readFileSync(join(repoRoot, pickerFile), "utf8")
    expect(pickerContent.includes("useDataCellOpeningContext")).toBe(true)
    expect(pickerContent.includes("DataCellDismissCause")).toBe(true)
    expect(pickerContent.includes("getBoundingClientRect")).toBe(false)
    expect(
      pickerContent.includes("getDataCellPickerPopupStyleFromAnchor")
    ).toBe(true)

    const pickerPositionFile =
      "registry/new-york-v4/ui/data-cell-picker-position.ts"
    const pickerPositionContent = readFileSync(
      join(repoRoot, pickerPositionFile),
      "utf8"
    )
    expect(
      pickerPositionContent.includes("getDataCellPickerPopupStyleFromAnchor")
    ).toBe(true)
    expect(pickerPositionContent.includes("getBoundingClientRect")).toBe(true)
  })

  it("keeps primitive table-to-row callback boundaries stable", () => {
    const tableFile = "components/json-table/single-file-virtualized-table.tsx"
    const rowFile = "components/json-table/single-file-form-row.tsx"
    const editSessionFile =
      "components/json-table/use-json-table-edit-session-coordinator.ts"
    const cellShellFile = "components/json-table/json-table-cell-shell.ts"
    const readOnlyCellFile =
      "components/json-table/read-only-json-table-cell.tsx"
    const columnWindowHookFile =
      "components/json-table/use-json-table-rendered-column-window.ts"
    const columnWindowFile =
      "components/json-table/json-table-rendered-column-window.ts"
    const tableContent = readFileSync(join(repoRoot, tableFile), "utf8")
    const rowContent = readFileSync(join(repoRoot, rowFile), "utf8")
    const editSessionContent = readFileSync(
      join(repoRoot, editSessionFile),
      "utf8"
    )
    const cellShellContent = readFileSync(join(repoRoot, cellShellFile), "utf8")
    const readOnlyCellContent = readFileSync(
      join(repoRoot, readOnlyCellFile),
      "utf8"
    )
    const columnWindowHookContent = readFileSync(
      join(repoRoot, columnWindowHookFile),
      "utf8"
    )
    const columnWindowContent = readFileSync(
      join(repoRoot, columnWindowFile),
      "utf8"
    )

    expect(tableContent.includes("useJsonTableEditSessionCoordinator")).toBe(
      true
    )
    expect(tableContent.includes("primitiveActiveCellStoreRef")).toBe(false)
    expect(editSessionContent.includes("primitiveActiveCellStoreRef")).toBe(
      true
    )
    expect(editSessionContent.includes("setPrimitiveActiveCell")).toBe(true)
    expect(editSessionContent.includes("startStructuredEditSession")).toBe(true)
    for (const callbackName of ["handleBodyScroll"]) {
      expect(
        tableContent.includes(`const ${callbackName} = React.useCallback`),
        `${tableFile} keeps ${callbackName} stable`
      ).toBe(true)
    }
    expect(columnWindowContent.includes("JsonTableRenderedColumnWindow")).toBe(
      true
    )
    expect(
      columnWindowContent.includes("jsonTableFullRenderedColumnWindow")
    ).toBe(true)
    expect(
      columnWindowContent.includes("jsonTableVirtualRenderedColumnWindow")
    ).toBe(true)
    expect(tableContent.includes("useJsonTableRenderedColumnWindow")).toBe(true)
    expect(
      columnWindowHookContent.includes("jsonTableFullRenderedColumnWindow")
    ).toBe(true)
    expect(
      columnWindowHookContent.includes("jsonTableVirtualRenderedColumnWindow")
    ).toBe(true)
    expect(
      rowContent.includes("export type JsonTableRenderedColumnWindow")
    ).toBe(false)
    expect(rowContent.includes("jsonTableFullRenderedColumnWindow")).toBe(false)
    expect(tableContent.includes("jsonTableFullRenderedColumnWindow")).toBe(
      false
    )
    expect(tableContent.includes("jsonTableVirtualRenderedColumnWindow")).toBe(
      false
    )
    expect(tableContent.includes("schemaVisibleColumns")).toBe(true)
    expect(tableContent.includes("renderedBodyColumnItems")).toBe(true)
    expect(tableContent.includes("leftPadWidthPx")).toBe(true)
    expect(tableContent.includes("rightPadWidthPx")).toBe(true)
    expect(tableContent.includes("columnItems: renderedBodyColumnItems")).toBe(
      true
    )
    expect(tableContent.includes("leftPad: leftPadWidthPx")).toBe(true)
    expect(tableContent.includes("rightPad: rightPadWidthPx")).toBe(true)
    for (const ambiguousColumnWindowName of [
      "const { columnItems",
      " leftPad,",
      " rightPad,",
    ]) {
      expect(
        tableContent.includes(ambiguousColumnWindowName),
        `${tableFile} contains ambiguous virtualizer boundary name ${ambiguousColumnWindowName}`
      ).toBe(false)
    }
    expect(columnWindowHookContent.includes("isJsonEditable")).toBe(true)
    expect(columnWindowHookContent.includes("renderedBodyColumnItems")).toBe(
      true
    )
    expect(columnWindowHookContent.includes("schemaVisibleColumns")).toBe(true)
    expect(
      tableContent.includes("renderedColumnWindow={renderedColumnWindow}")
    ).toBe(true)
    expect(tableContent.includes("data-json-table-header-spacer")).toBe(true)
    expect(
      tableContent.includes("renderedColumnWindow.projectedCellIndexes")
    ).toBe(true)
    expect(
      tableContent.includes("aria-colcount={schemaVisibleColumns.length}")
    ).toBe(true)
    expect(tableContent.includes("aria-rowcount={rowCount}")).toBe(true)
    expect(tableContent.includes('aria-hidden="true"')).toBe(true)
    expect(rowContent.includes("aria-rowindex={rowIdx + 1}")).toBe(true)
    expect(rowContent.includes("ariaColumnIndex:")).toBe(true)
    expect(cellShellContent.includes('"aria-colindex"')).toBe(true)
    expect(readOnlyCellContent.includes("aria-colindex")).toBe(true)
    for (const obsoleteColumnWindowProp of [
      "visibleColumnIndexes",
      "leftPadWidthPx?:",
      "rightPadWidthPx?:",
    ]) {
      expect(
        rowContent.includes(obsoleteColumnWindowProp),
        `${rowFile} contains obsolete split column-window prop ${obsoleteColumnWindowProp}`
      ).toBe(false)
    }
    expect(
      rowContent.includes("prev.onCellCommit !== next.onCellCommit"),
      `${rowFile} compares the cell commit callback by identity`
    ).toBe(true)
    expect(
      rowContent.includes(
        "prev.primitiveActiveCellStore !== next.primitiveActiveCellStore"
      ),
      `${rowFile} compares the primitive active store by identity`
    ).toBe(true)
  })

  it("keeps read-only row patching policy explicit and diagnosed", () => {
    const architectureFile = "components/json-table/ARCHITECTURE.md"
    const patcherFile = "components/json-table/read-only-json-row-patcher.ts"
    const patcherTestFile = "tests/read-only-json-row-patcher.test.tsx"
    const architectureContent = readFileSync(
      join(repoRoot, architectureFile),
      "utf8"
    )
    const patcherContent = readFileSync(join(repoRoot, patcherFile), "utf8")
    const patcherTestContent = readFileSync(
      join(repoRoot, patcherTestFile),
      "utf8"
    )

    for (const documentedPolicy of [
      "### Editable And Read-Only Row Policies",
      "Editable tables use the React row policy",
      "Read-only tables use the DOM row patch policy",
      "active controls and local edit state",
      "`read-only-row-patcher` profiler mark",
    ]) {
      expect(
        architectureContent.includes(documentedPolicy),
        `${architectureFile} misses row policy ${documentedPolicy}`
      ).toBe(true)
    }

    for (const diagnosticToken of [
      "ReadOnlyJsonRowPatchDiagnostic",
      "rowsPatched",
      "shape-mismatch",
      "unsupported-viewport",
      'markJsonTableProfile("read-only-row-patcher"',
    ]) {
      expect(
        patcherContent.includes(diagnosticToken),
        `${patcherFile} misses row patch diagnostic ${diagnosticToken}`
      ).toBe(true)
    }

    for (const diagnosticTestToken of [
      "onDiagnostic",
      "rowsPatched",
      "shape-mismatch",
      "unsupported-viewport",
    ]) {
      expect(
        patcherTestContent.includes(diagnosticTestToken),
        `${patcherTestFile} misses row patch diagnostic coverage ${diagnosticTestToken}`
      ).toBe(true)
    }
  })

  it("keeps JsonTableCellProps grouped by ownership", () => {
    const typesFile = "components/json-table/json-table-cell-types.ts"
    const rowFile = "components/json-table/single-file-form-row.tsx"
    const memoFile = "components/json-table/json-table-cell-memo.ts"
    const architectureFile = "components/json-table/ARCHITECTURE.md"
    const typesContent = readFileSync(join(repoRoot, typesFile), "utf8")
    const rowContent = readFileSync(join(repoRoot, rowFile), "utf8")
    const memoContent = readFileSync(join(repoRoot, memoFile), "utf8")
    const architectureContent = readFileSync(
      join(repoRoot, architectureFile),
      "utf8"
    )

    for (const requiredType of [
      "JsonTableCellProjectionProps",
      "JsonTablePrimitiveEditingProps",
      "JsonTableStructuredEditingProps",
      "JsonTableCellCommitProps",
      "JsonTableCellHoverProps",
    ]) {
      expect(
        typesContent.includes(`interface ${requiredType}`),
        `${typesFile} misses ${requiredType}`
      ).toBe(true)
    }

    for (const requiredPropGroup of [
      "cellProjection: JsonTableCellProjectionProps",
      "primitiveEditing: JsonTablePrimitiveEditingProps",
      "structuredEditing: JsonTableStructuredEditingProps",
      "commit: JsonTableCellCommitProps",
      "hover: JsonTableCellHoverProps",
    ]) {
      expect(
        typesContent.includes(requiredPropGroup),
        `${typesFile} misses grouped prop ${requiredPropGroup}`
      ).toBe(true)
    }

    for (const obsoleteFlatProp of [
      "primitiveActiveCellStore:",
      "primitiveEditStore:",
      "setPrimitiveActiveCell:",
      "structuredEditSession:",
      "startStructuredEditSession:",
      "setStructuredEditSessionOverlayOpen:",
      "closeStructuredEditSession:",
      "onCellCommit:",
      "onCellHoverStart",
      "onCellHoverEnd",
    ]) {
      expect(
        typesContent.includes(obsoleteFlatProp),
        `${typesFile} keeps obsolete flat JsonTableCellProps field ${obsoleteFlatProp}`
      ).toBe(false)
    }

    for (const requiredRowToken of [
      "const primitiveEditing = React.useMemo<JsonTablePrimitiveEditingProps>",
      "const structuredEditing = React.useMemo<JsonTableStructuredEditingProps>",
      "const commit = React.useMemo<JsonTableCellCommitProps>",
      "const hover = React.useMemo<JsonTableCellHoverProps>",
      "cellProjection: {",
    ]) {
      expect(
        rowContent.includes(requiredRowToken),
        `${rowFile} misses grouped cell prop construction ${requiredRowToken}`
      ).toBe(true)
    }

    for (const requiredMemoToken of [
      "cellProjection",
      "primitiveEditing",
      "structuredEditing",
      "commit",
      "hover",
      "structuredEditSessionId",
      "projectedCell.arrayIndexes",
    ]) {
      expect(
        memoContent.includes(requiredMemoToken),
        `${memoFile} misses grouped memo token ${requiredMemoToken}`
      ).toBe(true)
    }

    for (const documentedGroup of [
      "## Cell Prop Ownership",
      "`cellProjection` carries the logical cell",
      "`primitiveEditing` carries primitive active identity",
      "`structuredEditing` carries the structured object/array session lifecycle",
      "`commit` carries the single cell commit boundary",
      "`hover` carries optional hover measurement callbacks",
    ]) {
      expect(
        architectureContent.includes(documentedGroup),
        `${architectureFile} misses ${documentedGroup}`
      ).toBe(true)
    }
  })

  it("creates structured edit sessions open without a layout-effect opener", () => {
    const editSessionFile =
      "components/json-table/use-json-table-edit-session-coordinator.ts"
    const structuredCellFile =
      "components/json-table/json-table-structured-cell.tsx"
    const editSessionContent = readFileSync(
      join(repoRoot, editSessionFile),
      "utf8"
    )
    const structuredCellContent = readFileSync(
      join(repoRoot, structuredCellFile),
      "utf8"
    )

    expect(editSessionContent.includes("isOverlayOpen: true")).toBe(true)
    expect(editSessionContent.includes("isOverlayOpen: false")).toBe(false)
    expect(
      structuredCellContent.includes(
        "setStructuredEditSessionOverlayOpen(true)"
      )
    ).toBe(false)
    expect(structuredCellContent.includes("useLayoutEffect")).toBe(false)
  })

  it("keeps fresh performance verification self-diagnosing", () => {
    const verifierFile =
      "scripts/verify-json-table-performance-budget-fresh.mjs"
    const content = readFileSync(join(repoRoot, verifierFile), "utf8")

    for (const requiredToken of [
      "PROFILE_SERVER_MODE",
      '"auto"',
      '"existing"',
      '"managed"',
      "startManagedDevServer",
      "findAvailablePort",
      "Response body preview",
      "PROFILE_URL: profileUrl",
    ]) {
      expect(
        content.includes(requiredToken),
        `${verifierFile} keeps ${requiredToken}`
      ).toBe(true)
    }

    expect(content.includes("Start it with: pnpm dev")).toBe(false)
  })

  it("keeps browser accessibility verification checking virtualized column behavior", () => {
    const verifierFile = "scripts/verify-json-table-accessibility.mjs"
    const content = readFileSync(join(repoRoot, verifierFile), "utf8")

    for (const requiredToken of [
      "assertHeaderBodyAlignment",
      "assertKeyboardEnumFlow",
      "assertKeyboardDateFlow",
      "assertKeyboardTextCommit",
      "assertOpenStructuredObject",
      "assertStructuredHorizontalRemount",
      "assertKeyboardStructuredObjectFlow",
      "assertStructuredObjectControls",
      "focusCellSurface",
      "focusTableCell",
      "assertFocusWithinCell",
      "alignmentTolerancePx",
      "large left columns",
      "large middle columns",
      "large far columns",
      "large keyboard far enum",
      "large keyboard far date",
      "large keyboard far text",
      "large far structured object",
      "large far structured object remount",
      "large keyboard far structured object",
      "farTextFieldPath",
      "farStructuredObjectFieldPath",
      "header/body column",
      'page.keyboard.press("Enter")',
      'page.keyboard.press("Escape")',
      'thead th[aria-colindex]:not([aria-hidden="true"])',
      "tbody tr:first-child td[data-field-path]",
    ]) {
      expect(
        content.includes(requiredToken),
        `${verifierFile} keeps ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps the large browser profile exposing a dynamic structured object cell", () => {
    const demoFile = "components/json-table/json-table-demo.tsx"
    const content = readFileSync(join(repoRoot, demoFile), "utf8")

    for (const requiredToken of [
      "profile_far_details",
      "Profile Far Details",
      "patternProperties",
      '"^priority$"',
      'additionalProperties: { type: "string" }',
      "reviewer:",
      "priority:",
    ]) {
      expect(
        content.includes(requiredToken),
        `${demoFile} keeps ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps structured object editors preserving explicit dynamic schemas", () => {
    const structuredCellFile =
      "components/json-table/json-table-structured-cell.tsx"
    const structuredCellContent = readFileSync(
      join(repoRoot, structuredCellFile),
      "utf8"
    )
    const structuredTestFile = "tests/json-table-structured-cell.test.tsx"
    const structuredTestContent = readFileSync(
      join(repoRoot, structuredTestFile),
      "utf8"
    )

    expect(
      structuredCellContent.includes("additionalProperties: true") &&
        structuredCellContent.indexOf("additionalProperties: true") <
          structuredCellContent.indexOf("...schemaWithContext")
    ).toBe(true)

    for (const requiredToken of [
      "preserves typed dynamic object properties in the editor schema",
      'additionalProperties: { type: "string" }',
      "patternProperties",
      "reviewer-0",
      "priority.type",
    ]) {
      expect(
        structuredTestContent.includes(requiredToken),
        `${structuredTestFile} keeps ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps horizontal virtualization proof covering structured cells", () => {
    const stressFile =
      "tests/json-table-virtualization-stress-hardening.test.tsx"
    const content = readFileSync(join(repoRoot, stressFile), "utf8")

    for (const requiredToken of [
      "far_details",
      "preserves a far structured session across horizontal unmount and remount",
      'pointerDownCell(view.container, "lines.0.far_details")',
      'expect(queryCell(view.container, "lines.0.far_details")).toBeNull()',
      'expect(await view.findByRole("dialog")).toBeTruthy()',
      '"data-active"',
    ]) {
      expect(
        content.includes(requiredToken),
        `${stressFile} keeps ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps primitive interaction profiling repeatable", () => {
    const profilerFile = "scripts/profile-json-table-primitive-interactions.mjs"
    const content = readFileSync(join(repoRoot, profilerFile), "utf8")

    for (const requiredToken of [
      "JSON_TABLE_PROFILE_REPEAT",
      "JSON_TABLE_PROFILE_WARMUP",
      "JSON_TABLE_PROFILE_TRACE",
      "JSON_TABLE_PROFILE_TARGETS",
      "JSON_TABLE_PROFILE_SCENARIOS",
      '"--repeat"',
      '"--warmup"',
      '"--trace"',
      '"--targets"',
      '"--scenarios"',
      "buildRepeatedProfileSummary",
      "repeatedScenarios",
      "targetFilter",
      "scenarioFilter",
      "assertSelectedScenarioNamesMatched",
      "diagnostic-only",
      "warmupCount",
      "traceMode",
      "traceCategories",
      "traceStyleMs",
      "median",
      "p90",
      "worst",
    ]) {
      expect(
        content.includes(requiredToken),
        `${profilerFile} keeps ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps primitive interaction profiling surface-attributed", () => {
    const profilerFile = "scripts/profile-json-table-primitive-interactions.mjs"
    const verifierFile = "scripts/verify-json-table-performance-budget.mjs"
    const profilerContent = readFileSync(join(repoRoot, profilerFile), "utf8")
    const verifierContent = readFileSync(join(repoRoot, verifierFile), "utf8")

    for (const requiredToken of [
      "mountedSurfaceSnapshot",
      "mountedSurfaceDelta",
      "mountedSurface",
      "headerCells",
      "editableCells",
      "popupNodes",
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
      "mountedEditableCells",
      "mountedPopupNodes",
      "styleAttributionHint",
      "surface=header",
      "owner=",
      "traceStyle=",
      "traceLayout=",
    ]) {
      expect(
        verifierContent.includes(requiredToken),
        `${verifierFile} keeps ${requiredToken}`
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
    const content = readFileSync(join(repoRoot, profilerFile), "utf8")

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
        content.includes(requiredToken),
        `${profilerFile} keeps ${requiredToken}`
      ).toBe(true)
    }
  })

  it("keeps the generated DataCell registry artifact complete and clean", () => {
    const artifactFile = "public/r/data-cell.json"
    const content = readFileSync(join(repoRoot, artifactFile), "utf8")

    for (const file of dataCellRegistryRuntimeFiles) {
      expect(content.includes(file), `${artifactFile} includes ${file}`).toBe(
        true
      )
    }

    for (const pattern of forbiddenDataCellActivationPatterns) {
      expect(
        content.includes(pattern),
        `${artifactFile} contains ${pattern}`
      ).toBe(false)
    }
  })

  it("keeps json table cell modules below gravity-well size", () => {
    for (const { file, maxLines } of jsonTableLineCountLimits) {
      const content = readFileSync(join(repoRoot, file), "utf8")

      expect(lineCount(content), `${file} line count`).toBeLessThanOrEqual(
        maxLines
      )
    }
  })
})
