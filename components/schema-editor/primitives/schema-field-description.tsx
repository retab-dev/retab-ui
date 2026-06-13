"use client"

import * as React from "react"

import { InputPrimitive } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SchemaFieldDescriptionProps {
  value: string
  editable: boolean
  placeholder?: string
  onOpenDetails?: () => void
  onCommit: (value: string) => void
}

export function SchemaFieldDescription({
  value,
  editable,
  placeholder = "Add description",
  onOpenDetails,
  onCommit,
}: SchemaFieldDescriptionProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [draftValue, setDraftValue] = React.useState(value)

  React.useEffect(() => {
    if (!isEditing) setDraftValue(value)
  }, [isEditing, value])

  const submitValue = () => {
    const trimmedValue = draftValue.trim()
    if (trimmedValue !== value.trim()) {
      onCommit(trimmedValue)
    }
    setIsEditing(false)
  }

  if (isEditing && editable) {
    return (
      <InputPrimitive
        className="m-0 h-6 min-w-[140px] flex-1 rounded-sm border-none bg-transparent px-1 !text-xs leading-6 text-foreground shadow-none outline-none focus-visible:ring-0"
        value={draftValue}
        placeholder={placeholder}
        onChange={(event) => setDraftValue(event.target.value)}
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
            setIsEditing(false)
          }
        }}
        autoFocus
      />
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex h-6 min-w-[140px] flex-1 items-center truncate rounded-sm px-1 !text-xs ${
            editable
              ? "cursor-text text-muted-foreground hover:bg-accent hover:text-foreground"
              : "text-muted-foreground"
          }`}
          onClick={() => {
            if (!editable) {
              onOpenDetails?.()
              return
            }
            setDraftValue(value)
            setIsEditing(true)
          }}
        >
          {value || (
            <span className="text-muted-foreground/70">{placeholder}</span>
          )}
        </div>
      </TooltipTrigger>

      {value && (
        <TooltipContent className="max-w-xs">
          <div className="mb-1 text-xs text-muted-foreground">Description:</div>
          <div className="text-xs">{value}</div>
        </TooltipContent>
      )}
    </Tooltip>
  )
}
