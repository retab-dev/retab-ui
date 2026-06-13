"use client"

import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description"

interface DocumentNodeDescriptionControlProps {
  description: string
  mode: "descriptionOnly" | "readOnly" | "editable"
  onOpenMetadata: () => void
  onSubmitDescription: (description: string) => void
}

export function DocumentNodeDescriptionControl({
  description,
  mode,
  onOpenMetadata,
  onSubmitDescription,
}: DocumentNodeDescriptionControlProps) {
  return (
    <SchemaInlineDescription
      ariaLabel="Field description"
      value={description}
      editable={mode !== "readOnly"}
      onOpenDetails={onOpenMetadata}
      onCommit={onSubmitDescription}
    />
  )
}
