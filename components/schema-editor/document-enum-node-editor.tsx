"use client"

import { useState } from "react"

import type {
  DocumentSchemaNodeEditorProps,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import {
  addEnumValue,
  removeEnumValue,
  updateEnumValue,
} from "@/components/schema-editor/document/enum-operations"
import type { EnumValue } from "@/components/schema-editor/document/types"
import { SchemaChipAddRow } from "@/components/schema-editor/primitives/schema-chip-add-row"
import { SchemaChipList } from "@/components/schema-editor/primitives/schema-chip-list"

interface DocumentEnumNodeEditorProps {
  dispatch: DocumentSchemaNodeEditorProps["dispatch"]
  mode: SchemaEditorMode
  nodeId: string
  enumEntries: EnumValue[]
}

export function DocumentEnumNodeEditor({
  dispatch,
  mode,
  nodeId,
  enumEntries,
}: DocumentEnumNodeEditorProps) {
  const [newEnumValue, setNewEnumValue] = useState("")
  const editable = mode === "editable"
  const canAddEnumValue = newEnumValue.trim().length > 0

  const handleAddEnum = () => {
    if (!canAddEnumValue) return
    dispatch((current) => addEnumValue(current, nodeId, newEnumValue.trim()))
    setNewEnumValue("")
  }

  const handleRemoveEnum = (id: string) => {
    dispatch((current) => removeEnumValue(current, nodeId, id))
  }

  const handleEditEnum = (id: string, newValue: string) => {
    dispatch((current) =>
      updateEnumValue(current, nodeId, id, { value: newValue })
    )
  }
  const addRow = {
    focusAfterSubmit: true,
    inputLabel: "New choice",
    placeholder: "New choice",
    submitLabel: "Add",
    value: newEnumValue,
    onChange: setNewEnumValue,
    onSubmit: handleAddEnum,
  }

  return (
    <div className="ml-6">
      <div className="mt-1 mb-2">
        <SchemaChipList
          editable={editable}
          items={enumEntries.map((entry, index) => {
            const value = String(entry.value)
            return {
              id: entry.id,
              inputLabel: `Option ${index + 1}: ${value || "empty"}`,
              removeLabel: `Remove option ${value}`,
              value,
            }
          })}
          onRemove={handleRemoveEnum}
          onReplace={handleEditEnum}
        />
        {editable && (
          <SchemaChipAddRow
            editable={editable}
            row={addRow}
          />
        )}
      </div>

      {enumEntries.length === 0 && !editable && (
        <div className="mb-2 text-sm text-muted-foreground">
          No enum values defined.
        </div>
      )}
    </div>
  )
}
