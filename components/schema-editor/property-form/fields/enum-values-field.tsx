"use client"

import * as React from "react"
import type { JSONSchema7Type } from "json-schema"
import { PlusIcon, X } from "lucide-react"

import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"
import { Button } from "@/components/ui-retab/button"
import { Input } from "@/components/ui-retab/input"
import { Label } from "@/components/ui-retab/label"

interface EnumValueRow {
  id: string
  valueText: string
}

export function EnumValuesField({
  values,
  disabled,
  onChange,
}: {
  values: JSONSchema7Type[]
  disabled: boolean
  onChange: (values: JSONSchema7Type[]) => void
}) {
  const nextRowId = React.useRef(0)
  const [rows, setRows] = React.useState<EnumValueRow[]>(() =>
    values.map((value, index) => ({
      id: `initial-enum-value-${index}`,
      valueText: formatEnumValueInput(value),
    }))
  )
  const [nextValue, setNextValue] = React.useState("")

  React.useEffect(() => {
    setRows((currentRows) =>
      values.map((value, index) => ({
        id: currentRows[index]?.id ?? `enum-value-${nextRowId.current++}`,
        valueText: formatEnumValueInput(value),
      }))
    )
  }, [values])

  const commitRows = (nextRows: EnumValueRow[]) => {
    setRows(nextRows)
    onChange(nextRows.map((row) => parseEnumValueInput(row.valueText)))
  }

  const addValue = () => {
    if (!nextValue.trim()) return
    commitRows([
      ...rows,
      {
        id: `enum-value-${nextRowId.current++}`,
        valueText: nextValue,
      },
    ])
    setNextValue("")
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Enabled options</Label>
      {rows.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="flex items-center space-x-2 rounded-md border border-border bg-muted px-2 py-1"
            >
              <Input
                disabled={disabled}
                value={row.valueText}
                onChange={(event) => {
                  const nextRows = rows.slice()
                  nextRows[index] = {
                    ...row,
                    valueText: event.target.value,
                  }
                  commitRows(nextRows)
                }}
                className="h-6 w-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="button"
                disabled={disabled}
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                aria-label={`Remove option ${row.valueText}`}
                onClick={() => {
                  commitRows(rows.filter((currentRow) => currentRow !== row))
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
