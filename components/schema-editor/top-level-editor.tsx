"use client"

import * as React from "react"
import { useState } from "react"
import {
  EllipsisVertical,
  Eye,
  MessageCircleOff,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui-retab/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-retab/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui-retab/alert-dialog"
import { Input } from "@/components/ui-retab/input"
import { Textarea } from "@/components/ui-retab/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip"
import { RootDialog } from "@/components/schema-editor/root-dialog"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

const LazyImportExportMenuItems = React.lazy(() =>
  import(
    "@/components/schema-editor/optional/import-export/import-export-menu-items"
  ).then((module) => ({
    default: module.ImportExportMenuItems,
  }))
)

type SchemaEditorMode = "descriptionOnly" | "readOnly" | "editable"

type TopLevelEditorProps = {
  node: ExtendedJSONSchema7
  editMode: SchemaEditorMode
  showImportExportActions?: boolean
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onEraseAll: () => void
  onEraseDescriptions: () => void
  onReplaceRoot: (node: ExtendedJSONSchema7) => void
}

export function buildTopLevelMetadataValues(node: ExtendedJSONSchema7) {
  return {
    title: node.title || "",
    description: node.description || "",
  }
}

export function TopLevelEditor({
  node,
  editMode,
  showImportExportActions = true,
  onTitleChange,
  onDescriptionChange,
  onEraseAll,
  onEraseDescriptions,
  onReplaceRoot,
}: TopLevelEditorProps) {
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    "eraseAll" | "eraseDescriptions" | null
  >(null)
  const [metadataValues, setMetadataValues] = useState(() =>
    buildTopLevelMetadataValues(node)
  )
  const [draftTitle, setDraftTitle] = useState(node.title || "")
  const [isTitleDirty, setIsTitleDirty] = useState(false)
  const [draftDescription, setDraftDescription] = useState(
    node.description || ""
  )
  const [isDescriptionDirty, setIsDescriptionDirty] = useState(false)
  const [dialogPropertyName, setDialogPropertyName] = useState(
    node.title || ""
  )
  const currentTitle = isTitleDirty ? draftTitle : node.title || ""
  const currentDescription = isDescriptionDirty
    ? draftDescription
    : node.description || ""

  const commitTitle = () => {
    if (currentTitle !== (node.title || "")) {
      onTitleChange(currentTitle || "")
    }
    setIsTitleDirty(false)
    setDraftTitle(node.title || "")
  }

  const commitDescription = () => {
    if (currentDescription !== (node.description || "")) {
      onDescriptionChange(currentDescription)
    }
    setIsDescriptionDirty(false)
    setDraftDescription(node.description || "")
  }

  const openMetadataDialog = () => {
    setMetadataValues(buildTopLevelMetadataValues(node))
    setDialogPropertyName(node.title || "")
    setMetadataDialogOpen(true)
  }

  const confirmDestructiveAction = () => {
    if (confirmAction === "eraseAll") onEraseAll()
    if (confirmAction === "eraseDescriptions") onEraseDescriptions()
    setConfirmAction(null)
  }

  return (
    <div className="pb-4">
      <div className="group flex flex-col items-start justify-between pl-0 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center space-x-2">
          <Input
            className="m-0 h-5 rounded-none border-none p-0 text-lg font-medium text-foreground shadow-none outline-none focus-visible:ring-0 md:text-lg"
            value={currentTitle}
            placeholder="Add a title to your schema"
            onChange={(event) => {
              setDraftTitle(event.target.value)
              setIsTitleDirty(true)
            }}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitTitle()
            }}
            disabled={editMode === "readOnly" || editMode === "descriptionOnly"}
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label="Open schema actions"
                className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {editMode === "editable" && (
                <DropdownMenuItem onClick={() => setConfirmAction("eraseAll")}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Schema
                </DropdownMenuItem>
              )}

              {(editMode === "editable" || editMode === "descriptionOnly") && (
                <DropdownMenuItem
                  onClick={() => setConfirmAction("eraseDescriptions")}
                >
                  <MessageCircleOff className="mr-2 h-4 w-4" />
                  Delete all descriptions
                </DropdownMenuItem>
              )}

              {showImportExportActions && (
                <React.Suspense fallback={null}>
                  <LazyImportExportMenuItems
                    node={node}
                    onReplaceRoot={onReplaceRoot}
                  />
                </React.Suspense>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="pb-2">
        <div className="flex items-start justify-between">
          <Textarea
            className="m-0 max-h-64 min-h-6 resize-none rounded-none border-none p-0 text-sm font-normal text-muted-foreground shadow-none outline-none focus-visible:ring-0 md:text-sm"
            value={currentDescription}
            placeholder="Add a description to your schema"
            onChange={(event) => {
              setDraftDescription(event.target.value)
              setIsDescriptionDirty(true)
            }}
            onBlur={commitDescription}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                commitDescription()
              }
            }}
            disabled={editMode === "readOnly"}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  editMode === "readOnly"
                    ? "View schema properties"
                    : "Edit schema properties"
                }
                className="m-0 p-0"
                onClick={openMetadataDialog}
              >
                {editMode === "readOnly" ? (
                  <Eye className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                ) : (
                  <Pencil className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                {editMode === "readOnly"
                  ? "View schema properties"
                  : "Edit schema properties"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <RootDialog
        isOpen={metadataDialogOpen}
        onClose={() => setMetadataDialogOpen(false)}
        path="#"
        schemaTitle={dialogPropertyName}
        setSchemaTitle={setDialogPropertyName}
        metadataValues={metadataValues}
        setMetadataValues={setMetadataValues}
        onSave={(metadata) => {
          onTitleChange(metadata.title)
          onDescriptionChange(metadata.description)
        }}
        editMode={editMode}
      />

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "eraseAll"
                ? "Delete schema?"
                : "Delete all descriptions?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "eraseAll"
                ? "This clears every field in the current schema. This action cannot be undone."
                : "This removes the description from every field in the schema. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDestructiveAction}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
