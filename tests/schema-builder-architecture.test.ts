import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
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
  "components/schema-editor/item-type-selector.tsx",
  "components/schema-editor/draft-schema-node-field.tsx",
  "components/schema-editor/create-definition-dialog.tsx",
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
  "components/schema-editor/document-object-node-editor.tsx",
  "components/schema-editor/document-property-row.tsx",
  "components/schema-editor/document-property-add-row.tsx",
  "components/schema-editor/document-property-reorder.ts",
  "components/schema-editor/document-array-node-editor.tsx",
  "components/schema-editor/document-enum-node-editor.tsx",
  "components/schema-editor/document-node-editor-types.ts",
  "components/schema-editor/document/view-model.ts",
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
]

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

  it("uses property ids as row identity", () => {
    const content = readFileSync(
      join(repoRoot, "components/schema-editor/document-object-node-editor.tsx"),
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
    const content = readFileSync(
      join(repoRoot, "components/schema-editor/top-level-editor.tsx"),
      "utf8"
    )
    expect(content.includes("editedName")).toBe(false)
    expect(content.includes("effectiveEditedName")).toBe(false)
    expect(content.includes("handleEraseAllDescriptions")).toBe(false)
    expect(content.includes('aria-label=""')).toBe(false)
    expect(content.includes('aria-label="Open schema actions"')).toBe(true)
    expect(content.includes("draftTitle")).toBe(true)
    expect(content.includes("isTitleDirty")).toBe(true)
    expect(content.includes("draftDescription")).toBe(true)
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
})
