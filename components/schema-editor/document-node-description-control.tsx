"use client"

import * as React from "react"

import { Input } from "@/components/ui-retab/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip"

interface DocumentNodeDescriptionControlProps {
  description: string
  editMode: "descriptionOnly" | "readOnly" | "editable"
  onOpenMetadata: () => void
  onSubmitDescription: (description: string) => void
}

export function DocumentNodeDescriptionControl({
  description,
  editMode,
  onOpenMetadata,
  onSubmitDescription,
}: DocumentNodeDescriptionControlProps) {
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [draftDescription, setDraftDescription] = React.useState(description)

  const submitDescription = () => {
    const trimmedValue = draftDescription.trim()
    if (trimmedValue !== description.trim()) {
      onSubmitDescription(trimmedValue)
    }
    setIsEditingDescription(false)
  }

  if (isEditingDescription && editMode !== "readOnly") {
    return (
      <Input
        className="m-0 h-6 border-none p-0 px-1 !text-xs shadow-none outline-none focus-visible:ring-0"
        value={draftDescription}
        placeholder="Add description"
        onChange={(event) => setDraftDescription(event.target.value)}
        onBlur={submitDescription}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submitDescription()
          } else if (event.key === "Escape") {
            setDraftDescription(description)
            setIsEditingDescription(false)
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
            editMode === "readOnly"
              ? "text-muted-foreground"
              : "cursor-text text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          onClick={() => {
            if (editMode === "readOnly") {
              onOpenMetadata()
              return
            }
            setDraftDescription(description)
            setIsEditingDescription(true)
          }}
        >
          {description || (
            <span className="text-muted-foreground/70">Add description</span>
          )}
        </div>
      </TooltipTrigger>

      {description && (
        <TooltipContent className="max-w-xs">
          <div className="mb-1 text-xs text-muted-foreground">
            Description:
          </div>
          <div className="text-xs">{description}</div>
        </TooltipContent>
      )}
    </Tooltip>
  )
}
