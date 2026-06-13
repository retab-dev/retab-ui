"use client"

import * as React from "react"
import { PlusIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input, InputPrimitive } from "@/components/ui/input"

export interface SchemaChipItem {
  id: string
  inputLabel: string
  removeLabel: string
  value: string
}

export interface SchemaChipAddRow {
  focusAfterSubmit?: boolean
  inputLabel: string
  placeholder: string
  submitLabel: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export interface SchemaChipListProps {
  addRow?: SchemaChipAddRow
  editable: boolean
  items: SchemaChipItem[]
  onRemove: (id: string) => void
  onReplace: (id: string, value: string) => void
}

export function SchemaChipList({
  addRow,
  editable,
  items,
  onRemove,
  onReplace,
}: SchemaChipListProps) {
  const addInputRef = React.useRef<HTMLInputElement>(null)

  const submitAddRow = () => {
    if (!addRow?.value.trim()) return
    addRow.onSubmit()
    if (addRow.focusAfterSubmit) {
      addInputRef.current?.focus()
    }
  }

  return (
    <div data-slot="schema-chip-list" className="space-y-2">
      {items.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {items.map((item) => {
            return (
              <div
                key={item.id}
                data-slot="schema-chip"
                className="flex items-center gap-1 rounded-md border border-border bg-muted px-1 shadow-none"
              >
                <InputPrimitive
                  aria-label={item.inputLabel}
                  data-slot="schema-chip-input"
                  disabled={!editable}
                  value={item.value}
                  onChange={(event) => {
                    onReplace(item.id, event.target.value)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation()
                    }
                  }}
                  className="h-6 w-24 min-w-0 rounded-[inherit] border-0 bg-transparent px-1 text-sm leading-6 outline-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-64"
                />
                <Button
                  type="button"
                  disabled={!editable}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-sm border-0 bg-transparent p-0 shadow-none hover:bg-transparent data-pressed:bg-transparent"
                  aria-label={item.removeLabel}
                  onClick={() => onRemove(item.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : null}

      {addRow && (
        <div className="flex items-center gap-2">
          <Input
            aria-label={addRow.inputLabel}
            ref={addInputRef}
            disabled={!editable}
            placeholder={addRow.placeholder}
            value={addRow.value}
            onChange={(event) => addRow.onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                event.stopPropagation()
                submitAddRow()
              }
            }}
            className="w-40"
          />
          <Button
            disabled={!editable || !addRow.value.trim()}
            type="button"
            variant="outline"
            size="sm"
            onClick={submitAddRow}
          >
            <PlusIcon className="mr-1 h-4 w-4" />
            {addRow.submitLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
