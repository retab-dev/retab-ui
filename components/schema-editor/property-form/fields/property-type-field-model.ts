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
import type {
  SchemaTypeMenuSection,
  SchemaTypeMenuTrailingContent,
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

interface PropertyTypeFieldModelInput {
  editable: boolean
  schemaContext: PropertyFormSchemaContext
  schemaNode: ExtendedJSONSchema7
  trailingContent?: SchemaTypeMenuTrailingContent
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export function createPropertyTypeField({
  editable,
  schemaContext,
  schemaNode,
  trailingContent,
  onChange,
}: PropertyTypeFieldModelInput): PropertyTypeFieldModel {
  const effectiveType = getEffectiveType(schemaNode)
  const effectiveSchemaNode = getEffectiveNode(schemaNode)

  const selectType = (type: SchemaTypeOptionId) => {
    if (!editable) return
    onChange(updateType(type, effectiveType.isNullable, schemaNode))
  }

  const selectDefinition = (definitionName: string) => {
    if (!editable) return
    void schemaContext.onCommand?.({
      type: "selectDefinition",
      definitionName,
    })
    replacePropertyTypeSchemaNode({
      schemaNode,
      replacement: { $ref: definitionRef("$defs", definitionName) },
      onChange,
    })
  }

  const refName =
    effectiveType.type === "$ref" && effectiveSchemaNode.$ref
      ? definitionNameFromRef(effectiveSchemaNode.$ref)
      : undefined

  return {
    ariaLabel: `Data type${
      schemaContext.fieldPath ? ` for ${schemaContext.fieldPath}` : ""
    }`,
    editable,
    sections: [
      {
        id: "types",
        kind: "items",
        items: createPrimitiveTypeItems({ onSelectType: selectType }),
      },
      createDefinitionSection({
        definitionNames: Object.keys(schemaContext.schemaDefinitions),
        onCreateDefinition: () => {
          if (!editable) return
          void schemaContext.onCommand?.({ type: "createDefinition" })
        },
        onSelectDefinition: selectDefinition,
      }),
    ],
    trailingContent,
    value: createTypeMenuValue({ type: effectiveType.type, refName }),
  }
}

export function replacePropertyTypeSchemaNode({
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
