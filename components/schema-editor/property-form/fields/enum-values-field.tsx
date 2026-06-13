"use client"

import * as React from "react"
import type { JSONSchema7Type } from "json-schema"

import { Label } from "@/components/ui/label"
import { SchemaChipList } from "@/components/schema-editor/primitives/schema-chip-list"
import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"

export function EnumValuesField({
  values,
  resetKey,
  disabled,
  onChange,
}: {
  values: JSONSchema7Type[]
  resetKey: string
  disabled: boolean
  onChange: (values: JSONSchema7Type[]) => void
}) {
  const [nextValue, setNextValue] = React.useState("")

  React.useEffect(() => {
    setNextValue("")
  }, [resetKey])

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Enabled options</Label>
      <SchemaChipList
        disabled={disabled}
        inputValue={nextValue}
        placeholder="Add new value"
        values={values}
        formatValue={formatEnumValueInput}
        parseInput={parseEnumValueInput}
        onAdd={(value) => {
          onChange([...values, value])
          setNextValue("")
        }}
        onInputChange={setNextValue}
        onRemove={(index) =>
          onChange(values.filter((_value, current) => current !== index))
        }
        onReplace={(index, value) => {
          const nextValues = values.slice()
          nextValues[index] = value
          onChange(nextValues)
        }}
      />
    </div>
  )
}
