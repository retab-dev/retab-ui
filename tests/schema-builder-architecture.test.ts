import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

const deletedFiles = [
  "components/schema-editor/contexts/json-schema.tsx",
  "components/schema-editor/json-schema-builder.tsx",
  "components/schema-editor/json-schema-builder-utils.ts",
  "components/schema-editor/json-schema-node-editor.tsx",
  "components/schema-editor/json-schema-top-level-editor.tsx",
  "components/schema-editor/legacy/legacy-json-tree-replacement.ts",
  "components/schema-editor/schema-property-operations.ts",
  "components/schema-editor/object-template-menu.tsx",
  "components/schema-editor/object-template-reference.ts",
  "components/schema-editor/template-objects.ts",
  "components/schema-editor/property-form-reducer.ts",
  "components/schema-editor/property-form-types.ts",
  "components/schema-editor/property-form-validation.ts",
  "components/schema-editor/property-form.tsx",
  "components/schema-editor/property-form/index.ts",
  "components/schema-editor/item-type-selector.tsx",
  "components/schema-editor/draft-schema-node-field.tsx",
  "components/schema-editor/create-definition-dialog.tsx",
  "components/schema-editor/document/index.ts",
  "components/schema-editor/document/operations.ts",
  "components/schema-editor/document/tree.ts",
]

const executableFilesToCheck = [
  "components/schema-editor/document-schema-editor.tsx",
  "components/schema-editor/document-schema-node-editor.tsx",
  "components/schema-editor/top-level-editor.tsx",
  "components/schema-editor/document-node-header.tsx",
  "components/schema-editor/document-node-actions.tsx",
  "components/schema-editor/document-node-description-control.tsx",
  "components/schema-editor/document-node-name-control.tsx",
  "components/schema-editor/document-node-type-menu.tsx",
  "components/schema-editor/document-object-node-editor-controller.ts",
  "components/schema-editor/document-object-node-editor.tsx",
  "components/schema-editor/document-property-drag.ts",
  "components/schema-editor/document-property-row.tsx",
  "components/schema-editor/document-property-add-row.tsx",
  "components/schema-editor/document-property-reorder.ts",
  "components/schema-editor/document-array-node-editor.tsx",
  "components/schema-editor/document-enum-node-editor.tsx",
  "components/schema-editor/document-node-editor-types.ts",
  "components/schema-editor/document-node-reveal.ts",
  "components/schema-editor/document/array.ts",
  "components/schema-editor/document/definition-operations.ts",
  "components/schema-editor/document/enum-operations.ts",
  "components/schema-editor/document/json-node.ts",
  "components/schema-editor/document/node-metadata.ts",
  "components/schema-editor/document/node-selectors.ts",
  "components/schema-editor/document/node-update.ts",
  "components/schema-editor/document/property-operations.ts",
  "components/schema-editor/document/traversal.ts",
  "components/schema-editor/document/type-operations.ts",
  "components/schema-editor/document/view-model.ts",
  "components/schema-editor/document-definitions-editor.tsx",
  "components/schema-editor/document-definitions-editor-controller.ts",
  "components/schema-editor/document-node-header-controller.ts",
  "components/schema-editor/document-schema-editor-controller.ts",
  "components/schema-editor/schema-builder-types.ts",
  "components/schema-editor/schema-editor-mode.ts",
  "components/schema-editor/lib/configure-ajv.ts",
  "components/schema-editor/top-level-editor-controller.ts",
  "components/schema-editor/use-schema-builder-state.ts",
  "components/schema-editor/property-form/property-form.tsx",
  "components/schema-editor/property-form/property-form-shell.tsx",
  "components/schema-editor/property-form/fields/type-field.tsx",
  "components/schema-editor/property-form/fields/object-properties-field.tsx",
  "components/schema-editor/property-form/fields/array-items-field.tsx",
]

const forbiddenExecutablePatterns = [
  "json-schema-builder-utils",
  "SchemaBuilderProvider",
  "useJsonSchema",
  "contexts/json-schema",
  "ItemTypeSelector",
  "DraftSchemaNodeField",
  "dialogSchemaContext",
  "setJsonSchema",
  "legacy-json-tree-replacement",
  "template-objects",
  "applyDocOp",
  "replaceSchemaNodeByReference",
  "PropertyFormLegacyProps",
  "props.draft",
  "props.context",
  "onDraftChange",
  "lastExternalVersion",
]

function sourceFilesUnder(path: string): string[] {
  const entries = readdirSync(path)
  return entries.flatMap((entry) => {
    const fullPath = join(path, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) return sourceFilesUnder(fullPath)
    if (!/\.(ts|tsx)$/.test(entry)) return []
    return [relative(repoRoot, fullPath)]
  })
}

const schemaEditorSourceFiles = sourceFilesUnder(
  join(repoRoot, "components/schema-editor")
)

describe("schema builder architecture", () => {
  it("keeps legacy compatibility files deleted", () => {
    for (const file of deletedFiles) {
      expect(existsSync(join(repoRoot, file)), file).toBe(false)
    }
  })

  it("keeps executable schema editor paths off legacy imports", () => {
    for (const file of executableFilesToCheck) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of forbiddenExecutablePatterns) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
    }
  })

  it("keeps schema editor source on direct document module imports", () => {
    const documentBarrelImport =
      /from\s+["']@\/components\/schema-editor\/document["']/
    const removedOperationsImport =
      /from\s+["']@\/components\/schema-editor\/document\/operations["']/
    const removedTreeImport =
      /from\s+["']@\/components\/schema-editor\/document\/tree["']/

    for (const file of schemaEditorSourceFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(
        documentBarrelImport.test(content),
        `${file} imports document barrel`
      ).toBe(false)
      expect(
        removedOperationsImport.test(content),
        `${file} imports deleted operations module`
      ).toBe(false)
      expect(
        removedTreeImport.test(content),
        `${file} imports deleted tree module`
      ).toBe(false)
    }
  })

  it("uses property ids as row identity", () => {
    const content = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/document-object-node-editor.tsx"
      ),
      "utf8"
    )
    expect(content.includes("key={propName}")).toBe(false)
    expect(content.includes("key={property.propertyId}")).toBe(true)
  })

  it("keeps property form on the final public vocabulary", () => {
    const files = [
      "components/schema-editor/property-form/types.ts",
      "components/schema-editor/property-form/property-form.tsx",
      "components/schema-editor/property-form/property-form-controller.ts",
      "components/schema-editor/node-dialog.tsx",
      "components/schema-editor/property-dialog.tsx",
      "components/property-form-demo.tsx",
      "tests/property-form.test.tsx",
    ]
    const forbiddenPatterns = [
      "draft=",
      "context=",
      "onDraftChange",
      "onCommit=",
      "PropertyFormLegacyProps",
      "props.draft",
      "props.context",
    ]

    for (const file of files) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const pattern of forbiddenPatterns) {
        expect(content.includes(pattern), `${file} contains ${pattern}`).toBe(
          false
        )
      }
    }
  })

  it("keeps top-level editor on final naming and accessible icon buttons", () => {
    const viewContent = readFileSync(
      join(repoRoot, "components/schema-editor/top-level-editor.tsx"),
      "utf8"
    )
    const controllerContent = readFileSync(
      join(repoRoot, "components/schema-editor/top-level-editor-controller.ts"),
      "utf8"
    )
    const content = `${viewContent}\n${controllerContent}`
    expect(content.includes("editedName")).toBe(false)
    expect(content.includes("effectiveEditedName")).toBe(false)
    expect(content.includes("handleEraseAllDescriptions")).toBe(false)
    expect(viewContent.includes('aria-label=""')).toBe(false)
    expect(viewContent.includes('aria-label="Open schema actions"')).toBe(true)
    expect(controllerContent.includes("draftTitle")).toBe(true)
    expect(controllerContent.includes("isTitleDirty")).toBe(true)
    expect(controllerContent.includes("draftDescription")).toBe(true)
  })

  it("keeps large editor components out of document mutation internals", () => {
    const viewOnlyFiles = [
      "components/schema-editor/document-schema-editor.tsx",
      "components/schema-editor/document-node-header.tsx",
      "components/schema-editor/document-object-node-editor.tsx",
      "components/schema-editor/document-definitions-editor.tsx",
      "components/schema-editor/top-level-editor.tsx",
    ]
    const mutationImports =
      /from\s+["']@\/components\/schema-editor\/document\/(json-node|node-metadata|definition-operations|enum-operations|property-operations|type-operations)["']/

    for (const file of viewOnlyFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(
        mutationImports.test(content),
        `${file} imports document mutations`
      ).toBe(false)
    }
  })

  it("keeps view-only editor components free of direct dispatch calls", () => {
    const viewOnlyFiles = [
      "components/schema-editor/document-schema-editor.tsx",
      "components/schema-editor/document-node-header.tsx",
      "components/schema-editor/document-object-node-editor.tsx",
      "components/schema-editor/document-definitions-editor.tsx",
      "components/schema-editor/top-level-editor.tsx",
    ]

    for (const file of viewOnlyFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(content.includes("dispatch("), `${file} calls dispatch`).toBe(
        false
      )
    }
  })

  it("keeps DOM side effects confined to named browser helpers", () => {
    const approvedDomFiles = [
      "components/schema-editor/document-node-reveal.ts",
      "components/schema-editor/document-property-drag.ts",
      "components/schema-editor/optional/import-export/import-export-menu-items.tsx",
    ]
    const domEffectPattern =
      /\b(document\.|window\.|setTimeout|requestAnimationFrame)\b/
    const domEffectFiles = schemaEditorSourceFiles
      .filter((file) => {
        const content = readFileSync(join(repoRoot, file), "utf8")
        return domEffectPattern.test(content)
      })
      .sort()

    expect(domEffectFiles).toEqual(approvedDomFiles.sort())
  })

  it("keeps high-level editor views below their line budgets", () => {
    const lineBudgets: Record<string, number> = {
      "components/schema-editor/document-schema-editor.tsx": 110,
      "components/schema-editor/document-node-header.tsx": 175,
      "components/schema-editor/document-object-node-editor.tsx": 165,
      "components/schema-editor/document-definitions-editor.tsx": 165,
      "components/schema-editor/top-level-editor.tsx": 240,
    }

    for (const [file, maxLines] of Object.entries(lineBudgets)) {
      const lineCount = readFileSync(join(repoRoot, file), "utf8").split(
        "\n"
      ).length
      expect(lineCount, file).toBeLessThanOrEqual(maxLines)
    }
  })

  it("keeps recursive editors off projected json schema render models", () => {
    const recursiveEditorFiles = [
      "components/schema-editor/document-schema-node-editor.tsx",
      "components/schema-editor/document-object-node-editor.tsx",
      "components/schema-editor/document-array-node-editor.tsx",
      "components/schema-editor/document-enum-node-editor.tsx",
    ]
    for (const file of recursiveEditorFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(content.includes("projectNode"), file).toBe(false)
      expect(content.includes("getEffectiveNode"), file).toBe(false)
      expect(content.includes("getEffectiveDocNode"), file).toBe(false)
    }
  })

  it("keeps object-template optional code off object-reference replacement", () => {
    const content = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/optional/object-templates/object-template-reference.ts"
      ),
      "utf8"
    )
    expect(content.includes("replaceSchemaNodeByReference")).toBe(false)
    expect(content.includes("targetNode")).toBe(false)
  })

  it("keeps optional registries out of the default editor path", () => {
    const defaultEditorFiles = executableFilesToCheck.filter(
      (file) => !file.includes("/optional/")
    )
    for (const file of defaultEditorFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(content.includes("template-objects"), file).toBe(false)
    }
  })

  it("loads optional feature modules only through explicit dynamic imports", () => {
    const defaultSource = schemaEditorSourceFiles
      .filter((file) => !file.includes("/optional/"))
      .map((file) => readFileSync(join(repoRoot, file), "utf8"))
      .join("\n")

    expect(
      defaultSource.includes('from "@/components/schema-editor/optional')
    ).toBe(false)
    expect(defaultSource.includes("from './optional")).toBe(false)
    expect(defaultSource.includes('from "./optional')).toBe(false)
    expect(
      defaultSource.includes(
        'import("@/components/schema-editor/optional/json-mode/json-mode-editor")'
      )
    ).toBe(true)
    expect(
      defaultSource.includes(
        'import("@/components/schema-editor/optional/import-export/import-export-menu-items")'
      )
    ).toBe(true)
    expect(
      defaultSource.includes(
        'import("./optional/object-templates/object-template-reference")'
      )
    ).toBe(true)
  })

  it("uses one shared SchemaEditorMode definition", () => {
    const definitionFiles = schemaEditorSourceFiles.filter((file) => {
      const content = readFileSync(join(repoRoot, file), "utf8")
      return content.includes(
        'type SchemaEditorMode = "descriptionOnly" | "readOnly" | "editable"'
      )
    })

    expect(definitionFiles).toEqual([
      "components/schema-editor/schema-editor-mode.ts",
    ])
  })

  it("centralizes AJV plugin compatibility casts", () => {
    const castFiles = schemaEditorSourceFiles.filter((file) => {
      const content = readFileSync(join(repoRoot, file), "utf8")
      return content.includes("as unknown as")
    })

    expect(castFiles).toEqual(["components/schema-editor/lib/configure-ajv.ts"])
  })
})
