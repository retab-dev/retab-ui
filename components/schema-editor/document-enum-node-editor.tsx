"use client"

import * as React from "react"
import { useState } from "react"
import { PlusIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const canAddEnumValue = newEnumValue.trim().length > 0

  const handleAddEnum = () => {
    if (!canAddEnumValue) return
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
      <ul className="mt-1 mb-2 flex flex-wrap items-center gap-2">
        {enumEntries.map((entry, index) => (
          <li
            key={entry.id}
            className="flex h-7 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5"
          >
            <input
              value={String(entry.value)}
              ref={index === 0 ? firstEnumInputRef : undefined}
              onChange={(event) => {
                if (!isEditable) return
                handleEditEnum(index, event.target.value)
              }}
              disabled={!isEditable}
              className="h-6 w-20 min-w-0 rounded-none border-0 bg-transparent px-0.5 text-sm outline-none disabled:opacity-64"
            />
            {isEditable && (
              <Button
                type="button"
                variant="ghost"
                className="m-0 size-5 shrink-0 p-0"
                size="icon-sm"
                onClick={() => handleRemoveEnum(index)}
              >
                <X className="size-3" />
              </Button>
            )}
          </li>
        ))}

        {isEditable && (
          <li className="flex shrink-0 items-center gap-2">
            <Input
              ref={newEnumInputRef}
              placeholder="New choice"
              className="h-8 w-40"
              value={newEnumValue}
              onChange={(event) => setNewEnumValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canAddEnumValue) {
                  handleAddEnum()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canAddEnumValue}
              onClick={handleAddEnum}
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add</span>
            </Button>
          </li>
        )}
      </ul>

      {enumEntries.length === 0 && !isEditable && (
        <div className="mb-2 text-sm text-muted-foreground">
          No enum values defined.
        </div>
      )}
    </div>
  )
}
