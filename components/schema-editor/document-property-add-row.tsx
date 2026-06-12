"use client"

import * as React from "react"
import { AlertCircle, PlusIcon } from "lucide-react"

import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import { Button } from "@/components/ui-retab/button"
import { Input } from "@/components/ui-retab/input"

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
    <div
      className={
        rootLayout
          ? "mt-3 ml-4 flex flex-col gap-1"
          : "mt-2 ml-4 flex items-center gap-3 border-l border-border pl-4"
      }
    >
      <div className="flex items-center gap-3">
        <Input
          placeholder="New property name"
          className={`h-8 w-40 ${propertyNameError ? "border-destructive" : ""}`}
          value={propertyName}
          onChange={(event) => {
            const value = event.target.value
            setPropertyName(value)
            setPropertyNameError(value ? validatePropertyName(value) : null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && propertyName.trim()) {
              addProperty()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!propertyNameError || !propertyName.trim()}
          className={
            !!propertyNameError || !propertyName.trim()
              ? "cursor-not-allowed"
              : ""
          }
          onClick={addProperty}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add</span>
        </Button>
      </div>

      {propertyNameError && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {propertyNameError}
        </p>
      )}
    </div>
  )
}
