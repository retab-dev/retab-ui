"use client"

import * as React from "react"
import { PlusIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input, InputPrimitive } from "@/components/ui/input"

interface SchemaChipListProps {
  editable: boolean
  focusInputAfterSubmit?: boolean
  getKey: (index: number) => string
  pendingValue: string
  placeholder: string
  showSubmitInput?: boolean
  submitLabel: string
  values: string[]
  onPendingValueChange: (value: string) => void
  onRemoveValue: (index: number) => void
  onReplaceValue: (index: number, value: string) => void
  onSubmitPendingValue: () => void
}

export function SchemaChipList({
  editable,
  focusInputAfterSubmit = false,
  getKey,
  pendingValue,
  placeholder,
  showSubmitInput = true,
  submitLabel,
  values,
  onPendingValueChange,
  onRemoveValue,
  onReplaceValue,
  onSubmitPendingValue,
}: SchemaChipListProps) {
  const addInputRef = React.useRef<HTMLInputElement>(null)

  const submitPendingValue = () => {
    if (!pendingValue.trim()) return
    onSubmitPendingValue()
    if (focusInputAfterSubmit) {
      addInputRef.current?.focus()
    }
  }

  return (
    <div data-slot="schema-chip-list" className="space-y-2">
      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((value, index) => {
            return (
              <div
                key={getKey(index)}
                data-slot="schema-chip"
                className="flex items-center gap-1 rounded-md border border-border bg-muted px-1 shadow-none"
              >
                <InputPrimitive
                  aria-label={`Option ${index + 1}: ${value || "empty"}`}
                  data-slot="schema-chip-input"
                  disabled={!editable}
                  value={value}
                  onChange={(event) => {
                    onReplaceValue(index, event.target.value)
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
                  aria-label={`Remove option ${value}`}
                  onClick={() => onRemoveValue(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : null}

      {showSubmitInput && (
        <div className="flex items-center gap-2">
          <Input
            aria-label={placeholder}
            ref={addInputRef}
            disabled={!editable}
            placeholder={placeholder}
            value={pendingValue}
            onChange={(event) => onPendingValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                event.stopPropagation()
                submitPendingValue()
              }
            }}
            className="w-40"
          />
          <Button
            disabled={!editable || !pendingValue.trim()}
            type="button"
            variant="outline"
            size="sm"
            onClick={submitPendingValue}
          >
            <PlusIcon className="mr-1 h-4 w-4" />
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
