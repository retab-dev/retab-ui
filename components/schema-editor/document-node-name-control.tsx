"use client"

import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import { SchemaInlineName } from "@/components/schema-editor/primitives/schema-inline-name"

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
    <SchemaInlineName
      value={name}
      editable={isEditable}
      siblingValues={siblingNames}
      canRename={canRename}
      validate={(value) => validateName(value, siblingNames, name, "property")}
      isReference={isReference}
      refName={refName}
      onCommit={onNameChange}
      onShowDefinition={onShowDefinition}
    />
  )
}
