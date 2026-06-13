"use client"

import * as React from "react"
import { AlertCircle, EyeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SchemaFieldNameProps {
  value: string
  editable: boolean
  canRename?: boolean
  reference?: {
    label: string
    onReveal: () => void
  }
  validate?: (value: string) => string | null
  onCommit?: (value: string) => void
}

export function SchemaFieldName({
  value,
  editable,
  canRename = true,
  reference,
  validate = () => null,
  onCommit,
}: SchemaFieldNameProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [draftValue, setDraftValue] = React.useState(value)
  const [inlineError, setInlineError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isEditing) setDraftValue(value)
  }, [isEditing, value])

  const submitValue = () => {
    const error = validate(draftValue)
    if (error) {
      setInlineError(error)
      return
    }

    setInlineError(null)
    if (draftValue && draftValue !== value) {
      onCommit?.(draftValue)
    }
    setIsEditing(false)
  }

  if (isEditing && editable) {
    return (
      <div className="relative flex min-w-0 items-center">
        <Input
          aria-label={`Field name ${value}`}
          className={`m-0 h-6 w-40 border-none p-0 px-1 text-sm font-medium shadow-none outline-none focus-visible:ring-0 ${inlineError ? "border-destructive" : ""}`}
          value={draftValue}
          onChange={(event) => {
            const nextValue = event.target.value
            setDraftValue(nextValue)
            setInlineError(nextValue ? validate(nextValue) : null)
          }}
          onBlur={submitValue}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.stopPropagation()
              submitValue()
            } else if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              setDraftValue(value)
              setInlineError(null)
              setIsEditing(false)
            }
          }}
          autoFocus
        />
        {inlineError && (
          <p className="absolute top-7 left-1 z-10 flex min-w-56 items-center gap-1 rounded-sm border bg-background px-2 py-1 text-xs text-destructive shadow-sm">
            <AlertCircle className="h-3 w-3" /> {inlineError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center">
      <span
        className={`mr-1 truncate text-sm font-medium whitespace-nowrap text-foreground ${
          canRename && editable ? "cursor-pointer" : ""
        }`}
        onClick={() => {
          if (!canRename || !editable) return
          setDraftValue(value)
          setInlineError(null)
          setIsEditing(true)
        }}
      >
        {value}
      </span>
      {reference && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0"
          aria-label={`Show ${reference.label} definition`}
          onClick={reference.onReveal}
        >
          <EyeIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}
