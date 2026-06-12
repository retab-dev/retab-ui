"use client"

import { Eye, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DocumentNodeActionsProps {
  canDelete: boolean
  editMode: "descriptionOnly" | "readOnly" | "editable"
  hidePencilButton: boolean
  isEditable: boolean
  onDelete?: () => void
  onOpenMetadata: () => void
}

export function DocumentNodeActions({
  canDelete,
  editMode,
  hidePencilButton,
  isEditable,
  onDelete,
  onOpenMetadata,
}: DocumentNodeActionsProps) {
  return (
    <>
      {isEditable && canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="m-0 shrink-0 p-0"
          aria-label="Delete field"
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-primary-foreground group-hover:text-muted-foreground" />
        </Button>
      )}

      {!hidePencilButton && editMode !== "readOnly" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="m-0 shrink-0 p-0"
              aria-label="Edit field properties"
              onClick={onOpenMetadata}
            >
              <Pencil className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Edit field properties</p>
          </TooltipContent>
        </Tooltip>
      )}

      {editMode === "readOnly" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="m-0 shrink-0 p-0"
              aria-label="View field properties"
              onClick={onOpenMetadata}
            >
              <Eye className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>View field properties</p>
          </TooltipContent>
        </Tooltip>
      )}
    </>
  )
}
