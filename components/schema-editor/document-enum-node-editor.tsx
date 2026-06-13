"use client"

import { useState } from "react"

import type {
  DocumentSchemaNodeEditorProps,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import {
  addEnumValue,
  removeEnumValueAtIndex,
  updateEnumValueAtIndex,
} from "@/components/schema-editor/document/enum-operations"
import type { EnumValue } from "@/components/schema-editor/document/types"
import { SchemaChipList } from "@/components/schema-editor/primitives/schema-chip-list"

interface DocumentEnumNodeEditorProps {
  dispatch: DocumentSchemaNodeEditorProps["dispatch"]
  editMode: SchemaEditorMode
  nodeId: string
  enumEntries: EnumValue[]
}

export function DocumentEnumNodeEditor({
  dispatch,
  editMode,
  nodeId,
  enumEntries,
}: DocumentEnumNodeEditorProps) {
  const [newEnumValue, setNewEnumValue] = useState("")
  const isEditable = editMode === "editable"
  const canAddEnumValue = newEnumValue.trim().length > 0

  const handleAddEnum = () => {
    if (!canAddEnumValue) return
    dispatch((current) => addEnumValue(current, nodeId, newEnumValue.trim()))
    setNewEnumValue("")
  }

  const handleRemoveEnum = (index: number) => {
    dispatch((current) => removeEnumValueAtIndex(current, nodeId, index))
  }

  const handleEditEnum = (index: number, newValue: string) => {
    dispatch((current) =>
      updateEnumValueAtIndex(current, nodeId, index, newValue)
    )
  }

  return (
    <div className="ml-6">
      <div className="mt-1 mb-2">
        <SchemaChipList
          editable={isEditable}
          focusInputAfterSubmit
          getKey={(index) => enumEntries[index]?.id ?? String(index)}
          pendingValue={newEnumValue}
          placeholder="New choice"
          showSubmitInput={isEditable}
          submitLabel="Add"
          values={enumEntries.map((entry) => String(entry.value))}
          onPendingValueChange={setNewEnumValue}
          onRemoveValue={handleRemoveEnum}
          onReplaceValue={(index, value) => handleEditEnum(index, value)}
          onSubmitPendingValue={handleAddEnum}
        />
      </div>

      {enumEntries.length === 0 && !isEditable && (
        <div className="mb-2 text-sm text-muted-foreground">
          No enum values defined.
        </div>
      )}
    </div>
  )
}
