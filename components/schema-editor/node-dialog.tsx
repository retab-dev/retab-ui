import * as React from "react"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { PropertyForm } from "@/components/schema-editor/property-form"
import type {
  PropertyDraft,
  PropertyFormMode,
  PropertyFormSchemaContext,
} from "@/components/schema-editor/property-form/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-retab/dialog"

interface NodeDialogProps {
  isOpen: boolean
  onClose: () => void
  onChange: (newNode: ExtendedJSONSchema7) => void
  onNameChange?: (newName: string, updatedNode?: ExtendedJSONSchema7) => void
  onDelete?: () => void
  node: ExtendedJSONSchema7
  name: string
  editMode: PropertyFormMode
  siblingNames: string[]
  formContext: Omit<PropertyFormSchemaContext, "siblingNames" | "originalName">
}

export function NodeDialog({
  isOpen,
  onClose,
  onChange,
  onNameChange,
  onDelete,
  node,
  name,
  editMode,
  siblingNames,
  formContext,
}: NodeDialogProps) {
  const handleCommit = async (next: PropertyDraft) => {
    if (next.name !== name && onNameChange) {
      onNameChange(next.name, next.schemaNode)
    } else {
      onChange(next.schemaNode)
    }

    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] gap-2 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>
            {editMode === "readOnly" ? "View Property" : "Edit Property"}
          </DialogTitle>
          <DialogDescription>
            {editMode === "readOnly"
              ? "View property name, type, description, and other characteristics."
              : "Modify property name, type, description, and other characteristics."}
          </DialogDescription>
        </DialogHeader>

        <PropertyForm
          propertyDraft={{ name, schemaNode: node }}
          schemaContext={{
            ...formContext,
            siblingNames,
            originalName: name,
          }}
          onCommitPropertyDraft={handleCommit}
          onCancel={onClose}
          onDelete={onDelete}
          submitLabel="Save"
          mode={editMode}
        />
      </DialogContent>
    </Dialog>
  )
}
