import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

const deletedRuntimeFiles = ["components/json-table/json-table-scalar-cell.tsx"]

const runtimeRoots = ["components/json-table"]

const dataCellRuntimeFiles = [
  "registry/new-york-v4/ui/data-cell.tsx",
  "registry/new-york-v4/ui/data-cell-activation.ts",
  "registry/new-york-v4/ui/data-cell-boolean-control.tsx",
  "registry/new-york-v4/ui/data-cell-classes.ts",
  "registry/new-york-v4/ui/data-cell-control-contract.ts",
  "registry/new-york-v4/ui/data-cell-control-registry.tsx",
  "registry/new-york-v4/ui/data-cell-display.tsx",
  "registry/new-york-v4/ui/data-cell-format.ts",
  "registry/new-york-v4/ui/data-cell-number-control.tsx",
  "registry/new-york-v4/ui/data-cell-picker-control.tsx",
  "registry/new-york-v4/ui/data-cell-picker-position.ts",
  "registry/new-york-v4/ui/data-cell-select-control.tsx",
  "registry/new-york-v4/ui/data-cell-text-control.tsx",
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
  "blurActiveElement",
  "canActivatePrimitiveFromKey",
  "fieldPathAttributeSelector",
  "finishPrimitiveEditor",
  "getDataCellDisplayTextSelectionOffset",
  "JsonTableActiveControl",
  "primitiveActivationIntent",
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
  "recordJsonTableRender",
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
  "activationRequest",
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
    file: "components/json-table/use-json-table-shell-handlers.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/use-json-table-focus-return.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/use-json-table-cell-profiler.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/json-table-cell-shell.ts",
    maxLines: 220,
  },
  {
    file: "components/json-table/json-table-cell-model.ts",
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

describe("json table and DataCell architecture", () => {
  it("keeps deleted scalar and auto-edit compatibility files deleted", () => {
    for (const file of deletedRuntimeFiles) {
      expect(existsSync(join(repoRoot, file)), file).toBe(false)
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

  it("keeps useJsonTableEditableCellModel as a composition hook", () => {
    const file = "components/json-table/use-json-table-editable-cell-model.ts"
    const content = readFileSync(join(repoRoot, file), "utf8")

    for (const pattern of forbiddenEditableCoordinatorPatterns) {
      expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
        false
      )
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

  it("keeps json-table DataCell adaptation pure and outside the renderer", () => {
    const modelFile = "components/json-table/json-table-data-cell-model.ts"
    const displayFile = "components/json-table/json-table-display-cell.tsx"
    const modelContent = readFileSync(join(repoRoot, modelFile), "utf8")
    const displayContent = readFileSync(join(repoRoot, displayFile), "utf8")

    expect(existsSync(join(repoRoot, modelFile)), modelFile).toBe(true)
    expect(modelContent.includes("createJsonTableDataCellModel")).toBe(true)
    expect(modelContent.includes("JsonTableSelectDataCellModel")).toBe(true)
    expect(modelContent.includes("JsonTableBooleanDataCellModel")).toBe(true)
    expect(modelContent.includes("JsonTableNumberDataCellModel")).toBe(true)
    expect(modelContent.includes("JsonTableTextDataCellModel")).toBe(true)
    expect(modelContent.includes("JSON_TABLE_NULL_SELECT_VALUE")).toBe(true)
    expect(modelContent.includes("enumCommitValue")).toBe(true)
    expect(modelContent.includes("jsonCommitValue")).toBe(true)

    for (const pattern of [
      "JSON_TABLE_NULL_SELECT_VALUE",
      "enumCommitValue",
      "enumDataCellValue",
      "jsonCommitValue",
      "numberDataCellValue",
      "textDataCellValue",
      "as DataCellProps",
      "as never",
      "selectOptions: []",
    ]) {
      expect(
        displayContent.includes(pattern),
        `${displayFile} contains ${pattern}`
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

    const selectFile = "registry/new-york-v4/ui/data-cell-select-control.tsx"
    const selectContent = readFileSync(join(repoRoot, selectFile), "utf8")
    expect(selectContent.includes("useDataCellOpeningContext")).toBe(true)
    expect(selectContent.includes("DataCellDismissCause")).toBe(true)

    const pickerFile = "registry/new-york-v4/ui/data-cell-picker-control.tsx"
    const pickerContent = readFileSync(join(repoRoot, pickerFile), "utf8")
    expect(pickerContent.includes("useDataCellOpeningContext")).toBe(true)
    expect(pickerContent.includes("DataCellDismissCause")).toBe(true)
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
