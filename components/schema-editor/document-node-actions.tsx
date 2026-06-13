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
  return <SchemaRowActions {...props} />
}
