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

  const items = values.map((value, index) => {
    const inputValue = formatEnumValueInput(value)
    return {
      id: `enum-value-${index}`,
      inputLabel: `Option ${index + 1}: ${inputValue || "empty"}`,
      removeLabel: `Remove option ${inputValue}`,
      value: inputValue,
    }
  })

  const indexFromId = (id: string) => Number(id.replace("enum-value-", ""))

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Enabled options</Label>
      <SchemaChipList
        addRow={{
          inputLabel: "Add new value",
          placeholder: "Add new value",
          submitLabel: "Add",
          value: nextValue,
          onChange: setNextValue,
          onSubmit: () => {
            onChange([...values, parseEnumValueInput(nextValue)])
            setNextValue("")
          },
        }}
        editable={!disabled}
        items={items}
        onRemove={(id) => {
          const index = indexFromId(id)
          onChange(values.filter((_value, current) => current !== index))
        }}
        onReplace={(id, value) => {
          const index = indexFromId(id)
          const nextValues = values.slice()
          nextValues[index] = parseEnumValueInput(value)
          onChange(nextValues)
        }}
      />
    </div>
  )
}
