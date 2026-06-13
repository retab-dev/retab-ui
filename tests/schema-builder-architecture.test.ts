import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"
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
  "components/schema-editor/document-property-drag.ts",
  "components/schema-editor/document-property-reorder.ts",
  "components/schema-editor/property-form/fields/object-property-order-focus.ts",
  "components/schema-editor/property-form/fields/object-property-rows.tsx",
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
  "components/schema-editor/document-property-row.tsx",
  "components/schema-editor/document-property-add-row.tsx",
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
  "components/schema-editor/property-form/fields/object-properties-reorder-focus.ts",
  "components/schema-editor/property-form/fields/object-property-row.tsx",
  "components/schema-editor/property-form/fields/array-items-field.tsx",
  "components/schema-editor/property-form/fields/enum-values-field.tsx",
  "components/schema-editor/property-form/fields/property-schema-details-field.tsx",
  "components/schema-editor/property-form/model/property-schema-details.ts",
  "components/schema-editor/property-form/model/object-property-edits.ts",
  "components/schema-editor/property-form/fields/property-type-menu-model.ts",
  "components/schema-editor/property-form/fields/object-properties-drag.ts",
  "components/schema-editor/property-form/fields/object-property-row-details.ts",
  "components/schema-editor/primitives/schema-row-reorder-actions.tsx",
  "components/schema-editor/primitives/schema-row-drag.ts",
  "components/schema-editor/schema-type-menu-sections.tsx",
  "components/schema-editor/object-template-type-section.tsx",
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

function functionFirstParameterTypeProperties({
  file,
  functionName,
}: {
  file: string
  functionName: string
}) {
  const content = readFileSync(join(repoRoot, file), "utf8")
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const propertyNames: string[] = []

  ts.forEachChild(sourceFile, function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      const typeNode = node.parameters[0]?.type
      if (typeNode && ts.isTypeLiteralNode(typeNode)) {
        for (const member of typeNode.members) {
          if (ts.isPropertySignature(member) && member.name) {
            propertyNames.push(member.name.getText(sourceFile))
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  })

  return propertyNames
}

function interfaceProperties({
  file,
  interfaceName,
}: {
  file: string
  interfaceName: string
}) {
  const content = readFileSync(join(repoRoot, file), "utf8")
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const propertyNames: string[] = []

  ts.forEachChild(sourceFile, function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) {
          propertyNames.push(member.name.getText(sourceFile))
        }
      }
    }
    ts.forEachChild(node, visit)
  })

  return propertyNames
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
      "components/schema-editor/optional/import-export/import-export-menu-items.tsx",
      "components/schema-editor/primitives/schema-row-drag.ts",
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
    expect(
      /import\(\s*["']@\/components\/schema-editor\/optional\/object-templates\/object-template-menu["']\s*\)/.test(
        defaultSource
      )
    ).toBe(true)

    const objectTemplateMenuImportFiles = schemaEditorSourceFiles.filter(
      (file) => {
        const content = readFileSync(join(repoRoot, file), "utf8")
        return content.includes(
          "@/components/schema-editor/optional/object-templates/object-template-menu"
        )
      }
    )
    expect(objectTemplateMenuImportFiles).toEqual([
      "components/schema-editor/object-template-type-section.tsx",
    ])
  })

  it("keeps schema editor primitives model and feature agnostic", () => {
    const primitiveFiles = sourceFilesUnder(
      join(repoRoot, "components/schema-editor/primitives")
    )
    const forbiddenImports = [
      "@/components/schema-editor/optional/",
      "@/components/schema-editor/property-form/",
      "@/components/schema-editor/document/",
    ]

    for (const file of primitiveFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const forbiddenImport of forbiddenImports) {
        expect(
          content.includes(forbiddenImport),
          `${file} imports ${forbiddenImport}`
        ).toBe(false)
      }
    }

    const typeMenuContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/primitives/schema-type-menu.tsx"
      ),
      "utf8"
    )
    expect(typeMenuContent.includes("React.lazy")).toBe(false)
    expect(typeMenuContent.includes("object-template")).toBe(false)
  })

  it("keeps renamed schema editor primitive files as hard cutovers", () => {
    const legacyTypeMenuModelFile = "schema-type-menu-" + "model.tsx"
    const removedPrimitiveFiles = [
      "components/schema-editor/primitives/schema-field-name.tsx",
      "components/schema-editor/primitives/schema-field-description.tsx",
      "components/schema-editor/" + legacyTypeMenuModelFile,
      "components/schema-editor/property-form/fields/" +
        legacyTypeMenuModelFile,
      "components/schema-editor/property-form/fields/schema-node-" +
        "field.tsx",
    ]

    for (const file of removedPrimitiveFiles) {
      expect(existsSync(join(repoRoot, file)), file).toBe(false)
    }

    const requiredPrimitiveFiles = [
      "components/schema-editor/primitives/schema-inline-text.tsx",
      "components/schema-editor/primitives/schema-inline-name.tsx",
      "components/schema-editor/primitives/schema-inline-description.tsx",
      "components/schema-editor/primitives/schema-order.ts",
    ]

    for (const file of requiredPrimitiveFiles) {
      expect(existsSync(join(repoRoot, file)), file).toBe(true)
    }
  })

  it("keeps schema editor editability naming layer-specific", () => {
    const adapterModeName = "edit" + "Mode"
    for (const file of schemaEditorSourceFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(content.includes("isEditable"), file).toBe(false)
      expect(content.includes(adapterModeName), file).toBe(false)
    }
  })

  it("keeps object property mechanics out of the object properties view", () => {
    const content = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-field.tsx"
      ),
      "utf8"
    )

    for (const forbidden of [
      "draftPropertyIdsByName",
      "localPropertyNamesKeyRef",
      "createObjectPropertySchema",
      "listObjectPropertyNames",
      "renameObjectProperty",
      "removeObjectProperty",
      "replaceObjectProperty",
    ]) {
      expect(content.includes(forbidden), forbidden).toBe(false)
    }
    expect(content.includes("useObjectPropertiesModel")).toBe(true)
  })

  it("keeps object property order explicit and centralized", () => {
    const orderContent = readFileSync(
      join(repoRoot, "components/schema-editor/primitives/schema-order.ts"),
      "utf8"
    )
    const editsContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/model/object-property-edits.ts"
      ),
      "utf8"
    )
    const modelContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-model.ts"
      ),
      "utf8"
    )
    const dragContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-drag.ts"
      ),
      "utf8"
    )
    const viewContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-field.tsx"
      ),
      "utf8"
    )
    const rowContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-property-row.tsx"
      ),
      "utf8"
    )
    const focusContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-reorder-focus.ts"
      ),
      "utf8"
    )
    const actionsContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/primitives/schema-row-actions.tsx"
      ),
      "utf8"
    )
    const reorderActionsContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/primitives/schema-row-reorder-actions.tsx"
      ),
      "utf8"
    )

    expect(orderContent.includes("export function moveOrderedItem")).toBe(true)
    expect(editsContent.includes("moveOrderedItem")).toBe(true)
    expect(
      modelContent.includes("reorder: ObjectPropertyRowReorderModel")
    ).toBe(true)
    expect(modelContent.includes("ObjectPropertyRowReorderModel")).toBe(true)
    expect(modelContent.includes("ObjectPropertyRowOrderModel")).toBe(false)
    expect(modelContent.includes("moveOrderedItem")).toBe(true)
    expect(modelContent.includes("move: (targetIndex: number)")).toBe(true)
    expect(modelContent.includes("moveTo: (targetIndex: number)")).toBe(false)
    expect(dragContent.includes("sourceRow?.reorder.move")).toBe(true)
    expect(dragContent.includes("sourceRow?.order.moveTo")).toBe(false)
    expect(dragContent.includes("useObjectPropertiesRowDrag")).toBe(true)
    expect(dragContent.includes("moveObjectProperty")).toBe(false)
    expect(rowContent.includes("row.reorder.moveUp")).toBe(true)
    expect(rowContent.includes("row.reorder.moveDown")).toBe(true)
    expect(rowContent.includes("export function ObjectPropertyRows")).toBe(
      true
    )
    expect(rowContent.includes("useObjectPropertiesRowDrag")).toBe(true)
    expect(
      modelContent.includes("rowSchemaDetails: PropertySchemaDetailsModel")
    ).toBe(true)
    expect(rowContent.includes("renderSchemaDetails(row.rowSchemaDetails)")).toBe(
      true
    )
    expect(rowContent.includes("row." + "row" + "Details")).toBe(false)
    expect(modelContent.includes("row" + "Details")).toBe(false)
    expect(rowContent.includes("row." + "details")).toBe(false)
    expect(rowContent.includes("data-schema-row-order-row-id")).toBe(false)
    expect(viewContent.includes("useLayoutEffect")).toBe(false)
    expect(viewContent.includes("useObjectPropertiesRowDrag")).toBe(false)
    expect(viewContent.includes("ObjectPropertyRow")).toBe(true)
    expect(viewContent.includes("ObjectPropertyRows")).toBe(true)
    expect(viewContent.includes("SchemaInlineName")).toBe(false)
    expect(
      existsSync(
        join(
          repoRoot,
          "components/schema-editor/property-form/fields/object-property-rows.tsx"
        )
      )
    ).toBe(false)
    expect(
      existsSync(
        join(
          repoRoot,
          "components/schema-editor/property-form/fields/object-property-order-focus.ts"
        )
      )
    ).toBe(false)
    expect(actionsContent.includes("reorder?:")).toBe(false)
    expect(actionsContent.includes("moveUpLabel")).toBe(false)
    expect(reorderActionsContent.includes("SchemaRowReorderActions")).toBe(true)
    expect(focusContent.includes("aria-label")).toBe(false)
    expect(focusContent.includes("data-schema-row-reorder-row-id")).toBe(true)
    expect(focusContent.includes("data-schema-row-order-row-id")).toBe(false)
  })

  it("keeps property type field model-driven", () => {
    const content = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/type-field.tsx"
      ),
      "utf8"
    )

    for (const forbidden of [
      "React.lazy",
      "updateType",
      "updateEffectiveNode",
      "definitionRef",
      "withReplacementMetadata",
      "schemaTypeOptions.map",
    ]) {
      expect(content.includes(forbidden), forbidden).toBe(false)
    }
    expect(content.includes("createPropertyTypeMenu")).toBe(true)
  })

  it("keeps primitive type menu section builders shared by adapters", () => {
    const sharedContent = readFileSync(
      join(repoRoot, "components/schema-editor/schema-type-menu-sections.tsx"),
      "utf8"
    )
    const adapterFiles = [
      "components/schema-editor/document-node-type-menu.tsx",
      "components/schema-editor/property-form/fields/property-type-menu-model.ts",
    ]

    expect(sharedContent.includes("schemaTypeOptions.map")).toBe(true)
    expect(sharedContent.includes("createDefinitionTypeSubmenu")).toBe(true)

    for (const file of adapterFiles) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      for (const forbidden of [
        "schemaTypeOptions.map",
        "getTemplateIcon",
        "getTypeIcon",
        "PlusIcon",
      ]) {
        expect(
          content.includes(forbidden),
          `${file} includes ${forbidden}`
        ).toBe(false)
      }
      expect(content.includes("createPrimitiveTypeItems"), file).toBe(true)
      expect(content.includes("createDefinitionTypeSubmenu"), file).toBe(true)
    }
  })

  it("keeps SchemaTypeMenu free of optional feature knowledge", () => {
    const primitiveContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/primitives/schema-type-menu.tsx"
      ),
      "utf8"
    )
    const objectTemplateTrailingContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/object-template-type-section.tsx"
      ),
      "utf8"
    )

    expect(primitiveContent.includes(["kind: ", '"custom"'].join(""))).toBe(
      false
    )
    expect(
      primitiveContent.includes(["section.kind === ", '"custom"'].join(""))
    ).toBe(false)
    expect(primitiveContent.includes("object-template")).toBe(false)
    expect(primitiveContent.includes("React.lazy")).toBe(false)
    expect(primitiveContent.includes("SchemaTypeMenuTrailingContent")).toBe(
      true
    )
    expect(primitiveContent.includes("trailingContent")).toBe(true)
    expect(primitiveContent.includes("access" + "ory")).toBe(false)
    expect(objectTemplateTrailingContent.includes("React.lazy")).toBe(true)
    expect(objectTemplateTrailingContent.includes("object-template-menu")).toBe(
      true
    )
  })

  it("keeps property schema details split by concrete field model", () => {
    const legacyDetailsName = ["schema", "NodeDetails"].join("")
    const files = [
      "components/schema-editor/property-form/types.ts",
      "components/schema-editor/property-form/property-form-controller.ts",
      "components/schema-editor/property-form/property-form-shell.tsx",
      "components/schema-editor/property-form/fields/property-schema-details-field.tsx",
      "components/schema-editor/property-form/model/property-schema-details.ts",
    ]

    for (const file of files) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(content.includes(legacyDetailsName), file).toBe(false)
    }

    const typeContent = readFileSync(
      join(repoRoot, "components/schema-editor/property-form/types.ts"),
      "utf8"
    )
    const shellContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/property-form-shell.tsx"
      ),
      "utf8"
    )
    const detailsFieldContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/property-schema-details-field.tsx"
      ),
      "utf8"
    )
    const objectPropertiesModelContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-model.ts"
      ),
      "utf8"
    )

    expect(
      typeContent.includes("enumValues?: PropertyEnumValuesFieldModel")
    ).toBe(true)
    expect(
      typeContent.includes(
        "objectProperties?: PropertyObjectPropertiesFieldModel"
      )
    ).toBe(true)
    expect(
      typeContent.includes("arrayItems?: PropertyArrayItemsFieldModel")
    ).toBe(true)
    expect(shellContent.includes("PropertySchemaDetailsField")).toBe(true)
    expect(shellContent.includes("SchemaNode" + "Field")).toBe(false)
    expect(detailsFieldContent.includes("createPropertySchemaDetails")).toBe(
      false
    )
    expect(
      objectPropertiesModelContent.includes("createObjectPropertyRowDetails")
    ).toBe(true)
  })

  it("keeps property schema detail access single-sourced", () => {
    const duplicateTypeCapability = "canEdit" + "PropertyType"
    const duplicateDetailsCapabilities =
      "PropertySchema" + "DetailsCapabilities"
    const files = [
      "components/schema-editor/property-form/types.ts",
      "components/schema-editor/property-form/model/property-schema-details.ts",
      "components/schema-editor/property-form/fields/object-properties-field.tsx",
      "components/schema-editor/property-form/fields/property-schema-details-field.tsx",
      "components/schema-editor/property-form/fields/object-properties-model.ts",
    ]

    for (const file of files) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(content.includes(duplicateTypeCapability), file).toBe(false)
      expect(content.includes(duplicateDetailsCapabilities), file).toBe(false)
    }

    const typeContent = readFileSync(
      join(repoRoot, "components/schema-editor/property-form/types.ts"),
      "utf8"
    )

    expect(typeContent.includes("PropertySchemaDetailAccess")).toBe(true)
    expect(typeContent.includes("access: PropertySchemaDetailAccess")).toBe(
      true
    )
  })

  it("keeps type menu variants unified across adapters and primitives", () => {
    const files = [
      "components/schema-editor/property-form/fields/type-field.tsx",
      "components/schema-editor/property-form/fields/object-properties-field.tsx",
      "components/schema-editor/primitives/schema-type-menu.tsx",
    ]

    for (const file of files) {
      const content = readFileSync(join(repoRoot, file), "utf8")
      expect(content.includes(["variant=", '"compact"'].join("")), file).toBe(
        false
      )
      expect(content.includes(["variant=", '"outline"'].join("")), file).toBe(
        false
      )
    }

    const typeFieldContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/type-field.tsx"
      ),
      "utf8"
    )

    expect(typeFieldContent.includes('variant = "form"')).toBe(true)
    expect(typeFieldContent.includes("variant={variant}")).toBe(true)
  })

  it("keeps TypeField editability pre-reduced by callers", () => {
    expect(
      functionFirstParameterTypeProperties({
        file: "components/schema-editor/property-form/fields/type-field.tsx",
        functionName: "TypeField",
      })
    ).toEqual(["field", "variant"])

    const typeFieldContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/type-field.tsx"
      ),
      "utf8"
    )

    expect(typeFieldContent.includes("mode:")).toBe(false)
    expect(typeFieldContent.includes("mode ===")).toBe(false)
    expect(typeFieldContent.includes("object-template")).toBe(false)
    expect(typeFieldContent.includes("ObjectTemplate")).toBe(false)
    expect(typeFieldContent.includes("trailingContent={field.trailingContent}")).toBe(
      true
    )
  })

  it("keeps schema chips item-model driven", () => {
    expect(
      interfaceProperties({
        file: "components/schema-editor/primitives/schema-chip-list.tsx",
        interfaceName: "SchemaChipListProps",
      })
    ).toEqual(["addRow", "editable", "items", "onRemove", "onReplace"])

    const chipContent = readFileSync(
      join(repoRoot, "components/schema-editor/primitives/schema-chip-list.tsx"),
      "utf8"
    )

    for (const forbidden of [
      "getKey",
      "showSubmit" + "Input",
      "focusInput" + "AfterSubmit",
      "values: string[]",
      "onRemoveValue",
      "onReplaceValue",
    ]) {
      expect(chipContent.includes(forbidden), forbidden).toBe(false)
    }
    expect(chipContent.includes("export interface SchemaChipItem")).toBe(true)
    expect(chipContent.includes("export interface SchemaChipAddRow")).toBe(true)
  })

  it("keeps imported schema document ids deterministic across hydration", () => {
    const convertContent = readFileSync(
      join(repoRoot, "components/schema-editor/document/convert.ts"),
      "utf8"
    )

    expect(convertContent.includes("createDeterministicImportIdFactory")).toBe(
      true
    )
    expect(convertContent.includes("const createImportId")).toBe(true)
    expect(convertContent.includes('id: createId("prop")')).toBe(false)
    expect(convertContent.includes('id: createDocumentId("prop")')).toBe(true)
  })

  it("keeps object row type editability in the object properties model", () => {
    expect(
      functionFirstParameterTypeProperties({
        file: "components/schema-editor/property-form/fields/object-properties-field.tsx",
        functionName: "ObjectPropertiesField",
      })
    ).toEqual(["details", "renderSchemaDetails"])

    const fieldContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-field.tsx"
      ),
      "utf8"
    )
    const rowContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-property-row.tsx"
      ),
      "utf8"
    )
    const modelContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-model.ts"
      ),
      "utf8"
    )

    expect(fieldContent.includes("capabilities")).toBe(false)
    expect(fieldContent.includes("schemaNode:")).toBe(false)
    expect(fieldContent.includes("row.typeField")).toBe(false)
    expect(rowContent.includes("TypeField field={row.typeField}")).toBe(true)
    expect(modelContent.includes("typeField: createPropertyTypeField")).toBe(
      true
    )
    expect(modelContent.includes("disabled: !editable || !access.type")).toBe(
      true
    )
  })

  it("keeps object row recursive details behind one named helper", () => {
    const modelContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-properties-model.ts"
      ),
      "utf8"
    )
    const rowSchemaDetailsContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/fields/object-property-row-details.ts"
      ),
      "utf8"
    )

    expect(modelContent.includes("createPropertySchemaDetails")).toBe(false)
    expect(modelContent.includes("createObjectPropertyRowDetails")).toBe(true)
    expect(rowSchemaDetailsContent.includes("createPropertySchemaDetails")).toBe(
      true
    )
  })

  it("keeps property form validation and submit lifecycle outside the controller", () => {
    const controllerContent = readFileSync(
      join(
        repoRoot,
        "components/schema-editor/property-form/property-form-controller.ts"
      ),
      "utf8"
    )

    for (const forbidden of [
      "buildCommittedDraft",
      "isSubmittingRef",
      "setIsSubmitting",
      "function normalizeValidationForCapabilities",
    ]) {
      expect(controllerContent.includes(forbidden), forbidden).toBe(false)
    }

    expect(controllerContent.includes("usePropertyFormSubmit")).toBe(true)
    expect(
      controllerContent.includes("normalizeValidationForCapabilities")
    ).toBe(true)
    expect(
      existsSync(
        join(
          repoRoot,
          "components/schema-editor/property-form/property-form-submit.ts"
        )
      )
    ).toBe(true)
    expect(
      existsSync(
        join(
          repoRoot,
          "components/schema-editor/property-form/model/property-validation.ts"
        )
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
