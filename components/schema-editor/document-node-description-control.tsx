"use client"

import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description"

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
  return (
    <SchemaInlineDescription
      value={description}
      editMode={editMode}
      onOpenMetadata={onOpenMetadata}
      onCommit={onSubmitDescription}
    />
  )
}
