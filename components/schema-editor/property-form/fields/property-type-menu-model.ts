"use client"

import {
  definitionNameFromRef,
  definitionRef,
} from "@/components/schema-editor/document/json-pointer"
import {
  getEffectiveType,
  updateEffectiveNode,
  updateType,
} from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { createObjectTemplateTypeTrailingContent } from "@/components/schema-editor/object-template-type-section"
import type {
  SchemaTypeMenuSection,
  SchemaTypeMenuValue,
} from "@/components/schema-editor/primitives/schema-type-menu"
import type { SchemaTypeOptionId } from "@/components/schema-editor/primitives/schema-type-options"
import type {
  PropertyFormSchemaContext,
  PropertyTypeFieldModel,
} from "@/components/schema-editor/property-form/types"
import {
  createDefinitionTypeSubmenu,
  createPrimitiveTypeItems,
  createTypeMenuValue,
} from "@/components/schema-editor/schema-type-menu-sections"

interface PropertyTypeMenuModelInput {
  disabled: boolean
  schemaContext: PropertyFormSchemaContext
  schemaNode: ExtendedJSONSchema7
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export interface PropertyTypeMenu {
  sections: SchemaTypeMenuSection[]
  value: SchemaTypeMenuValue
  selectObjectTemplate: (templateName: string) => void
}

export function createPropertyTypeField({
  disabled,
  schemaContext,
  schemaNode,
  onChange,
}: PropertyTypeMenuModelInput): PropertyTypeFieldModel {
  const selectObjectTemplate = createObjectTemplateSelector({
    disabled,
    schemaContext,
    schemaNode,
    onChange,
  })

  return {
    schemaNode,
    schemaContext,
    fieldPath: schemaContext.fieldPath,
    editable: !disabled,
    trailingContent: schemaContext.objectTemplatesEnabled
      ? createObjectTemplateTypeTrailingContent({
          onSelectTemplate: selectObjectTemplate,
        })
      : undefined,
    onChange,
  }
}

export function createPropertyTypeMenu({
  disabled,
  schemaContext,
  schemaNode,
  onChange,
}: PropertyTypeMenuModelInput): PropertyTypeMenu {
  const effectiveType = getEffectiveType(schemaNode)
  const effectiveSchemaNode = getEffectiveNode(schemaNode)

  const selectType = (type: SchemaTypeOptionId) => {
    if (disabled) return
    onChange(updateType(type, effectiveType.isNullable, schemaNode))
  }

  const selectDefinition = (definitionName: string) => {
    if (disabled) return
    void schemaContext.onCommand?.({
      type: "selectDefinition",
      definitionName,
    })
    replaceEffectiveSchemaNode({
      schemaNode,
      replacement: { $ref: definitionRef("$defs", definitionName) },
      onChange,
    })
  }

  const selectObjectTemplate = createObjectTemplateSelector({
    disabled,
    schemaContext,
    schemaNode,
    onChange,
  })

  const refName =
    effectiveType.type === "$ref" && effectiveSchemaNode.$ref
      ? definitionNameFromRef(effectiveSchemaNode.$ref)
      : undefined

  return {
    value: createTypeMenuValue({ type: effectiveType.type, refName }),
    sections: [
      {
        id: "types",
        kind: "items",
        items: createPrimitiveTypeItems({ onSelectType: selectType }),
      },
      createDefinitionSection({
        definitionNames: Object.keys(schemaContext.schemaDefinitions),
        onCreateDefinition: () => {
          if (disabled) return
          void schemaContext.onCommand?.({ type: "createDefinition" })
        },
        onSelectDefinition: selectDefinition,
      }),
    ],
    selectObjectTemplate,
  }
}

function createObjectTemplateSelector({
  disabled,
  schemaContext,
  schemaNode,
  onChange,
}: PropertyTypeMenuModelInput) {
  return (templateName: string) => {
    if (disabled) return
    void schemaContext.onCommand?.({
      type: "installObjectTemplate",
      templateName,
    })
    replaceEffectiveSchemaNode({
      schemaNode,
      replacement: {
        $ref: definitionRef("$defs", templateName),
      },
      onChange,
    })
  }
}

function replaceEffectiveSchemaNode({
  schemaNode,
  replacement,
  onChange,
}: {
  schemaNode: ExtendedJSONSchema7
  replacement: ExtendedJSONSchema7
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  onChange(
    updateEffectiveNode(schemaNode, preserveMetadata(schemaNode, replacement))
  )
}

function createDefinitionSection({
  definitionNames,
  onCreateDefinition,
  onSelectDefinition,
}: {
  definitionNames: string[]
  onCreateDefinition: () => void
  onSelectDefinition: (definitionName: string) => void
}): SchemaTypeMenuSection {
  return createDefinitionTypeSubmenu({
    createDefinitionLabel: "Create new definition",
    definitionNames,
    onCreateDefinition,
    onSelectDefinition,
  })
}

function preserveMetadata(
  schemaNode: ExtendedJSONSchema7,
  replacement: ExtendedJSONSchema7
): ExtendedJSONSchema7 {
  const { anyOf, description, title } = schemaNode
  if (anyOf && Array.isArray(anyOf)) return replacement
  return {
    ...replacement,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  }
}
