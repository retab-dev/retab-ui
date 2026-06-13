"use client"

import { SchemaRowActions } from "@/components/schema-editor/primitives/schema-row-actions"

interface DocumentNodeActionsProps {
  canDelete: boolean
  editMode: "descriptionOnly" | "readOnly" | "editable"
  hidePencilButton: boolean
  isEditable: boolean
  onDelete?: () => void
  onOpenMetadata: () => void
}

export function DocumentNodeActions(props: DocumentNodeActionsProps) {
  const details =
    props.hidePencilButton || !props.onOpenMetadata
      ? undefined
      : props.editMode === "readOnly"
        ? {
            label: "View field properties",
            mode: "view" as const,
            onOpen: props.onOpenMetadata,
          }
        : {
            label: "Edit field properties",
            mode: "edit" as const,
            onOpen: props.onOpenMetadata,
          }

  return (
    <SchemaRowActions
      canDelete={props.canDelete}
      editable={props.isEditable}
      details={details}
      onDelete={props.onDelete}
    />
  )
}
