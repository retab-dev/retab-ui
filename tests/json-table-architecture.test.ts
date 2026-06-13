import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

const deletedRuntimeFiles = ["components/json-table/json-table-scalar-cell.tsx"]

const runtimeRoots = ["components/json-table"]

const dataCellRuntimeFiles = [
  "registry/new-york-v4/ui/data-cell.tsx",
  "registry/new-york-v4/ui/data-cell-boolean-control.tsx",
  "registry/new-york-v4/ui/data-cell-classes.ts",
  "registry/new-york-v4/ui/data-cell-display.tsx",
  "registry/new-york-v4/ui/data-cell-format.ts",
  "registry/new-york-v4/ui/data-cell-number-control.tsx",
  "registry/new-york-v4/ui/data-cell-picker-control.tsx",
  "registry/new-york-v4/ui/data-cell-picker-position.ts",
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
})
