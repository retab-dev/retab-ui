"use client"

import * as React from "react"

import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import { SchemaAddRow } from "@/components/schema-editor/primitives/schema-add-row"

interface DocumentPropertyAddRowProps {
  rootLayout: boolean
  siblingNames: string[]
  onAddProperty: (propertyName: string) => void
}

export function DocumentPropertyAddRow({
  rootLayout,
  siblingNames,
  onAddProperty,
}: DocumentPropertyAddRowProps) {
  const [propertyName, setPropertyName] = React.useState("")
  const [propertyNameError, setPropertyNameError] = React.useState<
    string | null
  >(null)

  const validatePropertyName = React.useCallback(
    (value: string) => validateName(value, siblingNames, undefined, "property"),
    [siblingNames]
  )

  const addProperty = () => {
    const key = propertyName.trim()
    const error = validatePropertyName(key)
    if (error) {
      setPropertyNameError(error)
      return
    }
    if (!key) return

    onAddProperty(key)
    setPropertyName("")
    setPropertyNameError(null)
  }

  return (
    <SchemaAddRow
      ariaLabel="New property name"
      className={
        rootLayout ? "mt-3 ml-4" : "mt-2 ml-4 border-l border-border pl-4"
      }
      disabled={false}
      error={propertyNameError}
      placeholder="New property name"
      value={propertyName}
      onAdd={addProperty}
      onChange={(value) => {
        setPropertyName(value)
        setPropertyNameError(value ? validatePropertyName(value) : null)
      }}
    />
  )
}
