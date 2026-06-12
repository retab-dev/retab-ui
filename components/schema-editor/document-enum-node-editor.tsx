"use client"

import * as React from "react"
import { useState } from "react"
import { PlusIcon, X } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  const firstEnumInputRef = React.useRef<HTMLInputElement>(null)
  const newEnumInputRef = React.useRef<HTMLInputElement>(null)
  const isEditable = editMode === "editable"

  const handleAddEnum = () => {
    if (!newEnumValue.trim()) return
    dispatch((current) => addEnumValue(current, nodeId, newEnumValue.trim()))
    setNewEnumValue("")
    newEnumInputRef.current?.focus()
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
      {enumEntries.length > 0 ? (
        <ul className="mt-1 mb-2 flex flex-wrap gap-2">
          {enumEntries.map((entry, index) => (
            <li
              key={entry.id}
              className="flex items-center space-x-2 rounded-md border border-border bg-muted px-2 py-1"
            >
              <Input
                value={String(entry.value)}
                ref={index === 0 ? firstEnumInputRef : undefined}
                onChange={(event) => {
                  if (!isEditable) return
                  handleEditEnum(index, event.target.value)
                }}
                disabled={!isEditable}
                className="h-6 w-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {isEditable && (
                <Button
                  type="button"
                  variant="ghost"
                  className="m-0 h-3 w-3 p-1"
                  size="icon"
                  onClick={() => handleRemoveEnum(index)}
                >
                  <X className="h-2 w-2" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-2 text-sm text-muted-foreground">
          No enum values defined.
        </div>
      )}

      {isEditable && (
        <div className="flex items-center gap-3">
          <Input
            ref={newEnumInputRef}
            placeholder="New choice"
            className="h-8 w-40"
            value={newEnumValue}
            onChange={(event) => setNewEnumValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && newEnumValue.trim()) {
                handleAddEnum()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddEnum}
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add</span>
          </Button>
        </div>
      )}
    </div>
  )
}
