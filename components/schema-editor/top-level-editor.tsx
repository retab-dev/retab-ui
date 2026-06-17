"use client"

import * as React from "react"
import {
  EllipsisVertical,
  Eye,
  MessageCircleOff,
  Pencil,
  Trash2,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RootDialog } from "@/components/schema-editor/root-dialog"
import {
  useTopLevelEditorController,
  type TopLevelEditorProps,
} from "@/components/schema-editor/top-level-editor-controller"

const LazyImportExportMenuItems = React.lazy(() =>
  import("@/components/schema-editor/optional/import-export/import-export-menu-items").then(
    (module) => ({
      default: module.ImportExportMenuItems,
    })
  )
)

export function TopLevelEditor({
  node,
  mode,
  showImportExportActions = true,
  onTitleChange,
  onDescriptionChange,
  onEraseAll,
  onEraseDescriptions,
  onReplaceRoot,
}: TopLevelEditorProps) {
  const controller = useTopLevelEditorController({
    node,
    onTitleChange,
    onDescriptionChange,
    onEraseAll,
    onEraseDescriptions,
  })

  return (
    <div className="pb-4">
      <div className="group flex flex-col items-start justify-between pl-0 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center space-x-2">
          <input
            className="m-0 h-5 w-full min-w-0 rounded-none border-none bg-transparent p-0 text-lg font-medium text-foreground shadow-none outline-none placeholder:text-muted-foreground/72 focus-visible:ring-0 disabled:opacity-64 md:text-lg"
            value={controller.currentTitle}
            placeholder="Add a title to your schema"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              controller.setDraftTitle(event.target.value)
              controller.setIsTitleDirty(true)
            }}
            onBlur={controller.commitTitle}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") controller.commitTitle()
            }}
            disabled={mode === "readOnly" || mode === "descriptionOnly"}
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Open schema actions"
                className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mode === "editable" && (
                <DropdownMenuItem
                  onClick={() => controller.setConfirmAction("eraseAll")}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Schema
                </DropdownMenuItem>
              )}

              {(mode === "editable" || mode === "descriptionOnly") && (
                <DropdownMenuItem
                  onClick={() =>
                    controller.setConfirmAction("eraseDescriptions")
                  }
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
            value={controller.currentDescription}
            placeholder="Add a description to your schema"
            onChange={(event) => {
              controller.setDraftDescription(event.target.value)
              controller.setIsDescriptionDirty(true)
            }}
            onBlur={controller.commitDescription}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                controller.commitDescription()
              }
            }}
            disabled={mode === "readOnly"}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  mode === "readOnly"
                    ? "View schema properties"
                    : "Edit schema properties"
                }
                className="m-0 p-0"
                onClick={controller.openMetadataDialog}
              >
                {mode === "readOnly" ? (
                  <Eye className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                ) : (
                  <Pencil className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                {mode === "readOnly"
                  ? "View schema properties"
                  : "Edit schema properties"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <RootDialog
        isOpen={controller.metadataDialogOpen}
        onClose={() => controller.setMetadataDialogOpen(false)}
        path="#"
        schemaTitle={controller.dialogPropertyName}
        setSchemaTitle={controller.setDialogPropertyName}
        metadataValues={controller.metadataValues}
        setMetadataValues={controller.setMetadataValues}
        onSave={(metadata) => {
          onTitleChange(metadata.title)
          onDescriptionChange(metadata.description)
        }}
        mode={mode}
      />

      <AlertDialog
        open={controller.confirmAction !== null}
        onOpenChange={(open) => !open && controller.setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {controller.confirmAction === "eraseAll"
                ? "Delete schema?"
                : "Delete all descriptions?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {controller.confirmAction === "eraseAll"
                ? "This clears every field in the current schema. This action cannot be undone."
                : "This removes the description from every field in the schema. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={controller.confirmDestructiveAction}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
