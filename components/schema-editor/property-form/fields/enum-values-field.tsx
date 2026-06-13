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
        editable={!disabled}
        getKey={(index) => `enum-value-${index}`}
        pendingValue={nextValue}
        placeholder="Add new value"
        submitLabel="Add"
        values={values.map(formatEnumValueInput)}
        onPendingValueChange={setNextValue}
        onRemoveValue={(index) =>
          onChange(values.filter((_value, current) => current !== index))
        }
        onReplaceValue={(index, value) => {
          const nextValues = values.slice()
          nextValues[index] = parseEnumValueInput(value)
          onChange(nextValues)
        }}
        onSubmitPendingValue={() => {
          onChange([...values, parseEnumValueInput(nextValue)])
          setNextValue("")
        }}
      />
    </div>
  )
}
