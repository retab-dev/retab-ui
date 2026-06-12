"use client"

import { useState } from "react"
import type { JSONSchema7 } from "json-schema"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { PropertyForm } from "@/components/schema-editor/property-form/property-form"
import type {
  PropertyDraft,
  PropertyFormCommand,
} from "@/components/schema-editor/property-form/types"
import { ResetOnMountRunner } from "@/components/schema-editor/reset-on-mount-runner"
import {
  applyTemplateToTableSchemaProperty,
  renamePropertyAtPath,
} from "@/components/json-table/schema-property-operations"
import { formatTitle } from "@/components/schema-editor/schema-title"

export const defaultNewProperty: ExtendedJSONSchema7 = {
  type: "string",
  description: "",
}

function getSiblingNamesAtPath(
  schema: ExtendedJSONSchema7,
  propertyPath: string
): string[] {
  const segments = propertyPath.split(".").filter(Boolean)
  segments.pop()

  let current: ExtendedJSONSchema7 = schema
  for (const segment of segments) {
    current = getEffectiveNode(current)
    if (current.type === "object" && current.properties?.[segment]) {
      current = current.properties[segment] as ExtendedJSONSchema7
      continue
    }
    if (current.type === "array" && !Array.isArray(current.items)) {
      current = current.items as ExtendedJSONSchema7
      continue
    }
    return []
  }

  const parent = getEffectiveNode(current)
  return Object.keys(parent.properties || {})
}

export function PropertyEditor({
  property,
  propertyKey,
  setDropdownOpen,
  schema,
  replaceSchema,
  editMode = "editable",
  onDelete,
}: {
  property: ExtendedJSONSchema7
  propertyKey: string
  setDropdownOpen: (open: boolean) => void
  schema: JSONSchema7
  replaceSchema: (schema: JSONSchema7) => void
  editMode?: "descriptionOnly" | "readOnly" | "editable"
  onDelete?: () => void
}) {
  const initialName = propertyKey.split(".")?.pop() || propertyKey
  const initialProperty = property || defaultNewProperty
  const [editedSchema, setEditedSchema] = useState<ExtendedJSONSchema7>({
    ...(schema as ExtendedJSONSchema7),
  })

  const handleCommit = (next: PropertyDraft) => {
    const updatedProperty = {
      ...next.schemaNode,
      title: formatTitle(next.name),
    }

    const updatedSchema = renamePropertyAtPath(
      editedSchema,
      propertyKey,
      next.name,
      updatedProperty
    )

    replaceSchema(updatedSchema)
    setDropdownOpen(false)
  }

  const handleCommand = async (command: PropertyFormCommand) => {
    if (command.type !== "installObjectTemplate") return

    const nextSchema = await applyTemplateToTableSchemaProperty(
      editedSchema,
      propertyKey,
      command.templateName
    )
    setEditedSchema(nextSchema)
  }

  return (
    <>
      <ResetOnMountRunner
        key={JSON.stringify(schema)}
        onReset={() => {
          setEditedSchema({ ...(schema as ExtendedJSONSchema7) })
        }}
      />
      <PropertyForm
        propertyDraft={{
          name: initialName,
          schemaNode: initialProperty,
        }}
        schemaContext={{
          siblingNames: getSiblingNamesAtPath(editedSchema, propertyKey),
          originalName: initialName,
          schemaDefinitions: editedSchema.$defs || {},
          fieldPath: propertyKey,
          objectTemplatesEnabled: true,
          onCommand: handleCommand,
        }}
        onCommitPropertyDraft={handleCommit}
        onCancel={() => setDropdownOpen(false)}
        onDelete={onDelete}
        submitLabel="Save Changes"
        mode={editMode}
      />
    </>
  )
}
