"use client";

import { useState } from "react";
import { JSONSchema7 } from "json-schema";
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
