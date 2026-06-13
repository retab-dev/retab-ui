"use client"

import type { JSONSchema7Definition } from "json-schema"

import type { SchemaEditorType } from "@/components/schema-editor/document/type-operations"
import { createObjectTemplateTypeAccessory } from "@/components/schema-editor/object-template-type-section"
import {
  SchemaTypeMenu,
  type SchemaTypeMenuSection,
} from "@/components/schema-editor/primitives/schema-type-menu"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"
import {
  createDefinitionTypeSubmenu,
  createPrimitiveTypeItems,
  createTypeMenuValue,
} from "@/components/schema-editor/schema-type-menu-sections"

interface DocumentNodeTypeMenuProps {
  defs: Record<string, JSONSchema7Definition>
  editable: boolean
  features: ResolvedSchemaBuilderFeatures
  localType: string
  refName?: string
  onCreateDefinition: () => void
  onSelectDefinition: (definitionName: string) => void
  onSelectObjectTemplate: (templateName: string) => void
  onSelectType: (type: SchemaEditorType | "enum") => void
}

export function DocumentNodeTypeMenu({
  defs,
  editable,
  features,
  localType,
  refName,
  onCreateDefinition,
  onSelectDefinition,
  onSelectObjectTemplate,
  onSelectType,
}: DocumentNodeTypeMenuProps) {
  const definitionNames = Object.keys(defs)
  const sections: SchemaTypeMenuSection[] = [
    {
      id: "types",
      kind: "items",
      items: createPrimitiveTypeItems({
        onSelectType: (type) => onSelectType(type as SchemaEditorType | "enum"),
      }),
    },
  ]

  if (features.definitions) {
    sections.push(
      createDefinitionTypeSubmenu({
        createDefinitionLabel: "Create a new definition to get started",
        definitionNames,
        onCreateDefinition,
        onSelectDefinition,
      })
    )
  }

  const accessory = features.objectTemplates
    ? createObjectTemplateTypeAccessory({
        onSelectTemplate: onSelectObjectTemplate,
      })
    : undefined

  return (
    <SchemaTypeMenu
      accessory={accessory}
      variant="row"
      editable={editable}
      sections={sections}
      value={createTypeMenuValue({ type: localType, refName })}
    />
  )
}
