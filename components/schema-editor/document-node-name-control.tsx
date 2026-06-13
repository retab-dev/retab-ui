"use client"

import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import { SchemaFieldName } from "@/components/schema-editor/primitives/schema-field-name"

interface DocumentNodeNameControlProps {
  isEditable: boolean
  name: string
  siblingNames: string[]
  canRename: boolean
  isReference: boolean
  refName?: string
  onNameChange?: (newName: string) => void
  onShowDefinition: (definitionName: string) => void
}

export function DocumentNodeNameControl({
  isEditable,
  name,
  siblingNames,
  canRename,
  isReference,
  refName,
  onNameChange,
  onShowDefinition,
}: DocumentNodeNameControlProps) {
  return (
    <SchemaFieldName
      value={name}
      editable={isEditable}
      canRename={canRename}
      validate={(value) => validateName(value, siblingNames, name, "property")}
      reference={
        isReference && refName
          ? {
              label: refName,
              onReveal: () => onShowDefinition(refName),
            }
          : undefined
      }
      onCommit={onNameChange}
    />
  )
}
