"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface SchemaChipAddRowModel {
  focusAfterSubmit?: boolean
  inputLabel: string
  placeholder: string
  submitLabel: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export interface SchemaChipAddRowProps {
  editable: boolean
  row: SchemaChipAddRowModel
}

export function SchemaChipAddRow({ editable, row }: SchemaChipAddRowProps) {
  const addInputRef = React.useRef<HTMLInputElement>(null)

  const submitAddRow = () => {
    if (!row.value.trim()) return
    row.onSubmit()
    if (row.focusAfterSubmit) {
      addInputRef.current?.focus()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={row.inputLabel}
        ref={addInputRef}
        disabled={!editable}
        placeholder={row.placeholder}
        value={row.value}
        onChange={(event) => row.onChange(event.target.value)}
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
        disabled={!editable || !row.value.trim()}
        type="button"
        variant="outline"
        size="sm"
        onClick={submitAddRow}
      >
        <PlusIcon className="mr-1 h-4 w-4" />
        {row.submitLabel}
      </Button>
    </div>
  )
}
