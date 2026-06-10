"use client";

import * as React from "react";
import { useState } from "react";
import { JSONSchema7 } from "json-schema";
import { Form } from "@/components/ui-retab/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui-retab/dialog";
import { renamePropertyAtPath, formatTitle } from "@/components/schema-editor/json-schema-builder";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { ResetOnMountRunner } from "@/components/schema-editor/reset-on-mount-runner";
import { PropertyForm } from "@/components/schema-editor/property-form";

export const defaultNewProperty: ExtendedJSONSchema7 = {
  type: "string",
  description: "",
};

// In PropertyEditor, use the builder functions for property updates and React Hook Form
export function PropertyEditor({
  property,
  propertyKey,
  setDropdownOpen,
  jsonSchema,
  setJsonSchema,
  editMode = "editable",
}: {
  property: any;
  propertyKey: string;
  setDropdownOpen: (open: boolean) => void;
  jsonSchema: JSONSchema7;
  setJsonSchema: (schema: JSONSchema7) => void;
  editMode?: "promptOnly" | "readOnly" | "editable";
}) {
  // Use state for local values, not tied to the form
  const [editedName, setEditedName] = useState(
    () => propertyKey.split(".")?.pop() || propertyKey,
  );
  const [editedProperty, setEditedProperty] = useState(
    property || defaultNewProperty,
  );
  const [editedSchema, setEditedSchema] = useState<ExtendedJSONSchema7>({
    ...jsonSchema,
  });

  // State for semantic validation errors
  const [nameError, setNameError] = useState<string | null>(null);

  // This is called after validation passes
  const handleFormSubmit = () => {
    // Don't proceed if there are semantic errors
    if (nameError) {
      return;
    }

    // Automatically set the title to match the name
    const updatedProperty = {
      ...editedProperty,
      title: formatTitle(editedName),
    };

    const updatedSchema = renamePropertyAtPath(
      editedSchema,
      propertyKey,
      editedName,
      updatedProperty,
    );

    setJsonSchema(updatedSchema);

    setDropdownOpen(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setDropdownOpen(false);
  };

  return (
    <>
      <ResetOnMountRunner
        key={JSON.stringify(jsonSchema)}
        onReset={() => {
          setEditedSchema({ ...jsonSchema });
        }}
      />
      <PropertyForm
        editedProperty={editedProperty}
        setEditedProperty={setEditedProperty}
        setJsonSchema={(newSchema) => {
          setJsonSchema(
            typeof newSchema === "function"
              ? newSchema(jsonSchema as ExtendedJSONSchema7)
              : newSchema,
          );
        }}
        editedJsonSchema={editedSchema}
        setEditedJsonSchema={setEditedSchema}
        editedName={editedName}
        setEditedName={setEditedName}
        onSubmit={handleFormSubmit}
        onCancel={handleCancel}
        submitLabel="Save Changes"
        onNameError={setNameError}
        editMode={editMode}
        fieldPathOverride={propertyKey}
        wrapCancelInDialogClose
        wrapSubmitInDialogClose
      />
    </>
  );
}

export function PropertyDialog({
  open,
  onOpenChange,
  jsonSchema,
  setJsonSchema,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsonSchema: JSONSchema7;
  setJsonSchema: (schema: JSONSchema7) => void;
}) {
  const property = defaultNewProperty;

  // Reset the form when dialog opens
  const [editedProperty, setEditedProperty] = useState<ExtendedJSONSchema7>({
    ...property,
  });
  const [editedSchema, setEditedSchema] = useState<ExtendedJSONSchema7>({
    ...jsonSchema,
  });
  const [editedName, setEditedName] = useState<string>("");
  const [nameError, setNameError] = useState<string | null>(null);

  const handleAddProperty = (
    propertyName: string,
    newProperty: ExtendedJSONSchema7,
  ) => {
    // Add the new property to the schema with formatted title
    const propertyWithTitle = {
      ...newProperty,
      title: formatTitle(propertyName),
      type: Array.isArray(newProperty.enum) ? "string" : newProperty.type,
      ...(newProperty.enum && { enum: newProperty.enum }),
    };

    // Update the schema
    const newProperties = {
      ...editedSchema.properties,
      [propertyName]: propertyWithTitle,
    };

    // Update the schema
    setJsonSchema({
      ...editedSchema,
      properties: newProperties,
      required: [...(editedSchema.required || []), propertyName],
    });
  };

  // This will be called after form validation passes
  const handleFormSubmit = () => {
    // Don't proceed if there are semantic errors
    if (nameError) {
      return;
    }

    // PropertyForm already sets the title based on the name
    handleAddProperty(editedName, editedProperty);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ResetOnMountRunner
          key={`property-dialog-reset:${JSON.stringify(jsonSchema)}`}
          onReset={() => {
            setEditedProperty({ ...property });
            setEditedName("");
            setNameError(null);
            setEditedSchema({ ...jsonSchema });
          }}
        />
      ) : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0! sm:max-w-xl">
        <DialogHeader className="bg-muted p-4">
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>Configure the property settings</DialogDescription>
        </DialogHeader>

        <PropertyForm
          editedProperty={editedProperty}
          setEditedProperty={setEditedProperty}
          setJsonSchema={(newSchema) => {
            setJsonSchema(
              typeof newSchema === "function"
                ? newSchema(jsonSchema as ExtendedJSONSchema7)
                : newSchema,
            );
          }}
          editedJsonSchema={editedSchema}
          setEditedJsonSchema={setEditedSchema}
          editedName={editedName}
          setEditedName={setEditedName}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          submitLabel="Add Property"
          onNameError={setNameError}
          wrapCancelInDialogClose
          wrapSubmitInDialogClose
        />
      </DialogContent>
    </Dialog>
  );
}
