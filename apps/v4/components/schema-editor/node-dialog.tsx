import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-retab/dialog";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { PropertyForm } from "@/components/schema-editor/property-form";
import { useState } from "react";

interface NodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  validateName: (name: string) => string | null;
  onChange: (newNode: ExtendedJSONSchema7) => void;
  onNameChange: (newName: string, updatedNode?: ExtendedJSONSchema7) => void;
  onDelete?: () => void;
  node: ExtendedJSONSchema7;
  name: string;
  editMode: "promptOnly" | "readOnly" | "editable";
}

export function NodeDialog({
  isOpen,
  onClose,
  validateName,
  onChange,
  onNameChange,
  onDelete,
  node,
  name,
  editMode,
}: NodeDialogProps) {
  // State for PropertyForm
  const [editedProperty, setEditedProperty] =
    useState<ExtendedJSONSchema7>(node);
  const [editedName, setEditedName] = useState(name);
  const [editedJsonSchema, setEditedJsonSchema] = useState<ExtendedJSONSchema7>(
    {
      type: "object",
      properties: {},
      $defs: {},
    },
  );

  // Handle form submission from PropertyForm
  const handleFormSubmit = (values?: {
    name: string;
    property: ExtendedJSONSchema7;
  }) => {
    const nextName = values?.name ?? editedName;
    const nextProperty = values?.property ?? editedProperty;

    // Validate one more time before saving
    const error = validateName(nextName);
    if (error) {
      return;
    }

    // Check if name changed
    if (nextName !== name) {
      // Handle the name change
      onNameChange(nextName, nextProperty);
    } else {
      // Just update the node with new property values
      onChange(nextProperty);
    }

    onClose();
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  // Handle name error from PropertyForm
  const handleNameError = (_error: string | null) => {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] gap-2 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-xl font-bold">
            {editMode === "readOnly" ? "View Property" : "Edit Property"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {editMode === "readOnly"
              ? "View property name, type, description, and other characteristics."
              : "Modify property name, type, description, and other characteristics."}
          </DialogDescription>
        </DialogHeader>

        <PropertyForm
          editedProperty={editedProperty}
          setEditedProperty={setEditedProperty}
          setJsonSchema={() => {}} // Not needed for this use case
          editedJsonSchema={editedJsonSchema}
          setEditedJsonSchema={setEditedJsonSchema}
          editedName={editedName}
          setEditedName={setEditedName}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          onDelete={onDelete}
          submitLabel="Save"
          onNameError={handleNameError}
          editMode={editMode}
          wrapCancelInDialogClose
        />
      </DialogContent>
    </Dialog>
  );
}
