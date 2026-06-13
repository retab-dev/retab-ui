"use client"

import * as React from "react"

import { InputPrimitive } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
  const inputRef = React.useRef<HTMLInputElement>(null)
  const pointerClientXRef = React.useRef<number | null>(null)

  React.useLayoutEffect(() => {
    if (!isEditingDescription || editMode === "readOnly") return

    const input = inputRef.current
    if (!input) return

    input.focus()

    const pointerClientX = pointerClientXRef.current
    pointerClientXRef.current = null
    if (pointerClientX === null) return

    const caretIndex = getInputCaretIndexFromClientX(input, pointerClientX)
    input.setSelectionRange(caretIndex, caretIndex)
  }, [editMode, isEditingDescription])

  const submitDescription = () => {
    const trimmedValue = draftDescription.trim()
    if (trimmedValue !== description.trim()) {
      onSubmitDescription(trimmedValue)
    }
    setIsEditingDescription(false)
  }

  if (isEditingDescription && editMode !== "readOnly") {
    return (
      <InputPrimitive
        ref={inputRef}
        className="m-0 h-6 min-w-[140px] flex-1 rounded-sm border-none bg-transparent px-1 !text-xs leading-6 text-foreground shadow-none outline-none focus-visible:ring-0"
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
          onPointerDown={(event) => {
            if (editMode !== "readOnly") {
              pointerClientXRef.current = event.clientX
            }
          }}
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

function getInputCaretIndexFromClientX(
  input: HTMLInputElement,
  clientX: number
): number {
  const value = input.value
  if (!value) return 0

  const rect = input.getBoundingClientRect()
  const style = window.getComputedStyle(input)
  const paddingLeft = parseCssPixels(style.paddingLeft)
  const paddingRight = parseCssPixels(style.paddingRight)
  const textX = Math.max(
    0,
    Math.min(
      clientX - rect.left - paddingLeft + input.scrollLeft,
      rect.width - paddingLeft - paddingRight
    )
  )

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) return value.length

  context.font =
    style.font ||
    `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`

  let previousWidth = 0
  for (let index = 0; index < value.length; index += 1) {
    const nextWidth = context.measureText(value.slice(0, index + 1)).width
    if (textX < (previousWidth + nextWidth) / 2) {
      return index
    }
    previousWidth = nextWidth
  }

  return value.length
}

function parseCssPixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}
