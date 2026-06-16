"use client"

import { Eye, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SchemaRowActionsProps {
  canDelete: boolean
  deleteLabel?: string
  details?: {
    label: string
    mode: "edit" | "view"
    onOpen: () => void
  }
  editable: boolean
  onDelete?: () => void
}

export function SchemaRowActions({
  canDelete,
  deleteLabel = "Delete field",
  details,
  editable,
  onDelete,
}: SchemaRowActionsProps) {
  return (
    <>
      {editable && canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="m-0 shrink-0 p-0"
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-primary-foreground group-hover/row:text-muted-foreground" />
        </Button>
      )}

      {details && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="m-0 shrink-0 p-0"
              aria-label={details.label}
              onClick={details.onOpen}
            >
              {details.mode === "edit" ? (
                <Pencil className="size-4 text-muted-foreground opacity-0 group-hover/row:opacity-100" />
              ) : (
                <Eye className="size-4 text-muted-foreground opacity-0 group-hover/row:opacity-100" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>{details.label}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  )
}
