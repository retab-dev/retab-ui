"use client"

import { SchemaFieldDescription } from "@/components/schema-editor/primitives/schema-field-description"

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
    <SchemaFieldDescription
      value={description}
      editable={editMode !== "readOnly"}
      onOpenDetails={onOpenMetadata}
      onCommit={onSubmitDescription}
    />
  )
}
