"use client"

import * as React from "react"
import type { JSONSchema7Type } from "json-schema"
import { PlusIcon, X } from "lucide-react"

import { Button } from "@/components/ui-retab/button"
import { Input } from "@/components/ui-retab/input"
import { Label } from "@/components/ui-retab/label"

export function EnumValuesField({
  values,
  disabled,
  onChange,
}: {
  values: JSONSchema7Type[]
  disabled: boolean
  onChange: (values: JSONSchema7Type[]) => void
}) {
  const [nextValue, setNextValue] = React.useState("")

  const addValue = () => {
    const trimmedValue = nextValue.trim()
    if (!trimmedValue) return
    onChange([...values, trimmedValue])
    setNextValue("")
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Enabled options</Label>
      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((value, index) => (
            <div
              key={`${index}-${String(value)}`}
              className="flex items-center space-x-2 rounded-md border border-border bg-muted px-2 py-1"
            >
              <Input
                disabled={disabled}
                value={String(value)}
                onChange={(event) => {
                  const nextValues = values.slice()
                  nextValues[index] = event.target.value
                  onChange(nextValues.filter((entry) => entry !== ""))
                }}
                className="h-6 w-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="button"
                disabled={disabled}
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                aria-label={`Remove option ${String(value)}`}
                onClick={() => {
                  onChange(values.filter((_value, current) => current !== index))
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Input
          disabled={disabled}
          placeholder="Add new value"
          value={nextValue}
          onChange={(event) => setNextValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addValue()
            }
          }}
          className="w-40"
        />
        <Button
          disabled={disabled || !nextValue.trim()}
          type="button"
          variant="outline"
          size="sm"
          onClick={addValue}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
    </div>
  )
}
