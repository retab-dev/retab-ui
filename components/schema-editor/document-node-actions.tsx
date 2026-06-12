"use client"

import { Eye, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui-retab/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip"

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
          size="sm"
          className="m-0 h-3 w-3 p-0"
          aria-label="Delete field"
          onClick={onDelete}
        >
          <Trash2 className="h-1 w-1 text-primary-foreground group-hover:text-muted-foreground" />
        </Button>
      )}

      {!hidePencilButton && editMode !== "readOnly" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="m-0 p-0"
              aria-label="Edit field properties"
              onClick={onOpenMetadata}
            >
              <Pencil className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
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
              size="icon"
              className="m-0 p-0"
              aria-label="View field properties"
              onClick={onOpenMetadata}
            >
              <Eye className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
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
