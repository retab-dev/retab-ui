"use client"

import * as React from "react"
import type { JSONSchema7Type } from "json-schema"

import { Label } from "@/components/ui/label"
import { SchemaChipAddRow } from "@/components/schema-editor/primitives/schema-chip-add-row"
import { SchemaChipList } from "@/components/schema-editor/primitives/schema-chip-list"
import {
  formatEnumValueInput,
  parseEnumValueInput,
} from "@/components/schema-editor/property-form/model/enum-values"

import { useEnumValueIdentity } from "./enum-value-identity"

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
  const valueIdentity = useEnumValueIdentity({ resetKey, values })

  React.useEffect(() => {
    setNextValue("")
  }, [resetKey])

  const items = values.map((value, index) => {
    const inputValue = formatEnumValueInput(value)
    return {
      id: valueIdentity.ids[index],
      inputLabel: `Option ${index + 1}: ${inputValue || "empty"}`,
      removeLabel: `Remove option ${inputValue}`,
      value: inputValue,
    }
  })

  const indexFromId = (id: string) => valueIdentity.ids.indexOf(id)
  const addInput = {
    inputLabel: "Add new value",
    placeholder: "Add new value",
    submitLabel: "Add",
    value: nextValue,
    onChange: setNextValue,
    onSubmit: () => {
      onChange([...values, parseEnumValueInput(nextValue)])
      setNextValue("")
    },
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Enabled options</Label>
      <SchemaChipList
        editable={!disabled}
        items={items}
        onRemove={(id) => {
          const index = indexFromId(id)
          valueIdentity.removeId(id)
          onChange(values.filter((_value, current) => current !== index))
        }}
        onReplace={(id, value) => {
          const index = indexFromId(id)
          const nextValues = values.slice()
          nextValues[index] = parseEnumValueInput(value)
          onChange(nextValues)
        }}
      />
      <SchemaChipAddRow
        addInput={addInput}
        editable={!disabled}
      />
    </div>
  )
}
