"use client"

import type * as React from "react"
import { ArrowDown, ArrowUp } from "lucide-react"

import { Button } from "@/components/ui/button"

export interface SchemaRowReorderActionsProps {
  canMoveDown: boolean
  canMoveUp: boolean
  moveDownLabel: string
  moveUpLabel: string
  onMoveDown: () => void
  onMoveUp: () => void
  moveDownAttributes?: React.ButtonHTMLAttributes<HTMLButtonElement>
  moveUpAttributes?: React.ButtonHTMLAttributes<HTMLButtonElement>
}

export function SchemaRowReorderActions({
  canMoveDown,
  canMoveUp,
  moveDownLabel,
  moveUpLabel,
  onMoveDown,
  onMoveUp,
  moveDownAttributes,
  moveUpAttributes,
}: SchemaRowReorderActionsProps) {
  return (
    <>
      <Button
        {...moveUpAttributes}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="m-0 shrink-0 p-0"
        aria-label={moveUpLabel}
        disabled={!canMoveUp}
        onClick={onMoveUp}
      >
        <ArrowUp className="size-4 text-muted-foreground" />
      </Button>
      <Button
        {...moveDownAttributes}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="m-0 shrink-0 p-0"
        aria-label={moveDownLabel}
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <ArrowDown className="size-4 text-muted-foreground" />
      </Button>
    </>
  )
}
