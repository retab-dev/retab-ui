"use client"

import * as React from "react"
import { AlertCircle, EyeIcon } from "lucide-react"

import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import { Button } from "@/components/ui-retab/button"
import { Input } from "@/components/ui-retab/input"

interface DocumentNodeNameControlProps {
  isEditable: boolean
  name: string
  siblingNames: string[]
  canRename: boolean
  isReference: boolean
  refName?: string
  onNameChange?: (newName: string) => void
  onShowDefinition: (definitionName: string) => void
}

export function DocumentNodeNameControl({
  isEditable,
  name,
  siblingNames,
  canRename,
  isReference,
  refName,
  onNameChange,
  onShowDefinition,
}: DocumentNodeNameControlProps) {
  const [isEditingName, setIsEditingName] = React.useState(false)
  const [draftName, setDraftName] = React.useState(name)
  const [inlineError, setInlineError] = React.useState<string | null>(null)

  const validateInlineName = React.useCallback(
    (value: string) => validateName(value, siblingNames, name, "property"),
    [name, siblingNames]
  )

  const submitName = () => {
    const error = validateInlineName(draftName)
    if (error) {
      setInlineError(error)
      return
    }

    setInlineError(null)
    if (draftName && draftName !== name) {
      onNameChange?.(draftName)
    }
    setIsEditingName(false)
  }

  if (isEditingName && isEditable) {
    return (
      <>
        <Input
          className={`m-0 h-6 w-40 border-none p-0 px-1 text-sm font-medium shadow-none outline-none focus-visible:ring-0 ${inlineError ? "border-destructive" : ""}`}
          value={draftName}
          onChange={(event) => {
            const value = event.target.value
            setDraftName(value)
            setInlineError(value ? validateInlineName(value) : null)
          }}
          onBlur={submitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submitName()
            } else if (event.key === "Escape") {
              setDraftName(name)
              setInlineError(null)
              setIsEditingName(false)
            }
          }}
          autoFocus
        />
        {inlineError && (
          <p className="mt-1 ml-1 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {inlineError}
          </p>
        )}
      </>
    )
  }

  return (
    <div className="flex items-center">
      <span
        className="mr-1 cursor-pointer text-sm font-medium whitespace-nowrap text-foreground"
        onClick={() => {
          if (!canRename) return
          setDraftName(name)
          setInlineError(null)
          setIsEditingName(true)
        }}
      >
        {name}
      </span>
      {isReference && refName && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0"
          aria-label={`Show ${refName} definition`}
          onClick={() => onShowDefinition(refName)}
        >
          <EyeIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}
