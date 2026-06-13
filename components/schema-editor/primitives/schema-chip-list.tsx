"use client"

import * as React from "react"
import { PlusIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SchemaChipListProps<T> {
  addLabel?: string
  disabled: boolean
  focusInputAfterAdd?: boolean
  getKey?: (value: T, index: number) => string
  inputValue: string
  placeholder: string
  showAddInput?: boolean
  values: T[]
  formatValue: (value: T) => string
  parseInput: (input: string) => T
  onAdd: (value: T) => void
  onInputChange: (value: string) => void
  onRemove: (index: number) => void
  onReplace: (index: number, value: T) => void
}

export function SchemaChipList<T>({
  addLabel = "Add",
  disabled,
  focusInputAfterAdd = false,
  getKey,
  inputValue,
  placeholder,
  showAddInput = true,
  values,
  formatValue,
  parseInput,
  onAdd,
  onInputChange,
  onRemove,
  onReplace,
}: SchemaChipListProps<T>) {
  const addInputRef = React.useRef<HTMLInputElement>(null)

  const addValue = () => {
    if (!inputValue.trim()) return
    onAdd(parseInput(inputValue))
    if (focusInputAfterAdd) {
      addInputRef.current?.focus()
    }
  }

  return (
    <div className="space-y-2">
      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((value, index) => {
            const formattedValue = formatValue(value)
            return (
              <div
                key={getKey ? getKey(value, index) : `schema-chip-${index}`}
                className="flex items-center space-x-2 rounded-md border border-border bg-muted px-2 py-1"
              >
                <Input
                  disabled={disabled}
                  value={formattedValue}
                  onChange={(event) => {
                    onReplace(index, parseInput(event.target.value))
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation()
                    }
                  }}
                  className="h-6 w-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  type="button"
                  disabled={disabled}
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0"
                  aria-label={`Remove option ${formattedValue}`}
                  onClick={() => onRemove(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : null}

      {showAddInput && (
        <div className="flex items-center gap-2">
          <Input
            ref={addInputRef}
            disabled={disabled}
            placeholder={placeholder}
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                event.stopPropagation()
                addValue()
              }
            }}
            className="w-40"
          />
          <Button
            disabled={disabled || !inputValue.trim()}
            type="button"
            variant="outline"
            size="sm"
            onClick={addValue}
          >
            <PlusIcon className="mr-1 h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
