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
import { SchemaTypeMenu } from "@/components/schema-editor/primitives/schema-type-menu"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"

const primitiveTypes = [
  ["string", "string"],
  ["number", "number"],
  ["integer", "integer"],
  ["boolean", "true/false"],
  ["enum", "multiple choice"],
  ["date", "date"],
  ["time", "time"],
  ["datetime", "timestamp"],
  ["array", "list"],
  ["object", "object"],
] as const

export function TypeField({
  schemaNode,
  schemaContext,
  fieldPath,
  mode,
  disabled,
  variant = "outline",
  onChange,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  fieldPath?: string
  mode: "descriptionOnly" | "readOnly" | "editable"
  disabled: boolean
  variant?: "outline" | "compact"
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const effectiveType = getEffectiveType(schemaNode)
  const effectiveSchemaNode = getEffectiveNode(schemaNode)
  const isDisabled = disabled || mode === "readOnly"

  const setType = (type: (typeof primitiveTypes)[number][0]) => {
    if (isDisabled) return
    const nextSchemaNode = updateType(
      type,
      effectiveType.isNullable,
      schemaNode
    )
    onChange(nextSchemaNode)
  }

  const withReplacementMetadata = (
    replacement: ExtendedJSONSchema7
  ): ExtendedJSONSchema7 => {
    if (schemaNode.anyOf && Array.isArray(schemaNode.anyOf)) return replacement
    return {
      ...replacement,
      ...(schemaNode.title ? { title: schemaNode.title } : {}),
      ...(schemaNode.description
        ? { description: schemaNode.description }
        : {}),
    }
  }

  const setDefinition = (definitionName: string) => {
    if (isDisabled) return
    void schemaContext.onCommand?.({
      type: "selectDefinition",
      definitionName,
    })
    onChange(
      updateEffectiveNode(
        schemaNode,
        withReplacementMetadata({
          $ref: definitionRef("$defs", definitionName),
        })
      )
    )
  }

  const setObjectTemplate = (templateName: string) => {
    if (isDisabled) return
    void schemaContext.onCommand?.({
      type: "installObjectTemplate",
      templateName,
    })
    onChange(
      updateEffectiveNode(
        schemaNode,
        withReplacementMetadata({
          $ref: definitionRef("$defs", templateName),
        })
      )
    )
  }

  const refName =
    effectiveType.type === "$ref" && effectiveSchemaNode.$ref
      ? definitionNameFromRef(effectiveSchemaNode.$ref)
      : undefined

  return (
    <SchemaTypeMenu
      ariaLabel={`Data type${fieldPath ? ` for ${fieldPath}` : ""}`}
      defs={schemaContext.schemaDefinitions}
      definitionsEnabled={true}
      definitionCreateLabel="Create new definition"
      isEditable={!isDisabled}
      localType={effectiveType.type}
      objectTemplatesEnabled={Boolean(schemaContext.objectTemplatesEnabled)}
      refName={refName}
      variant={variant === "compact" ? "row" : "form"}
      onCreateDefinition={() => {
        if (isDisabled) return
        void schemaContext.onCommand?.({ type: "createDefinition" })
      }}
      onSelectDefinition={setDefinition}
      onSelectObjectTemplate={setObjectTemplate}
      onSelectType={(type) =>
        setType(type as (typeof primitiveTypes)[number][0])
      }
    />
  )
}
