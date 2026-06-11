import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = process.cwd()

const deletedFiles = [
  "components/schema-editor/contexts/json-schema.tsx",
  "components/schema-editor/json-schema-builder.tsx",
  "components/schema-editor/json-schema-builder-utils.ts",
  "components/schema-editor/json-schema-node-editor.tsx",
  "components/schema-editor/legacy/legacy-json-tree-replacement.ts",
  "components/schema-editor/object-template-menu.tsx",
  "components/schema-editor/object-template-reference.ts",
  "components/schema-editor/template-objects.ts",
  "components/schema-editor/item-type-selector.tsx",
  "components/schema-editor/draft-schema-node-field.tsx",
  "components/schema-editor/create-definition-dialog.tsx",
]

const executableFilesToCheck = [
  "components/schema-editor/document-schema-editor.tsx",
  "components/schema-editor/document-schema-node-editor.tsx",
  "components/schema-editor/document-node-header.tsx",
  "components/schema-editor/document-object-node-editor.tsx",
  "components/schema-editor/document-array-node-editor.tsx",
  "components/schema-editor/document-enum-node-editor.tsx",
  "components/schema-editor/document-node-editor-types.ts",
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
})
