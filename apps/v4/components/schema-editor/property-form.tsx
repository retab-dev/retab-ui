"use client";

import * as React from "react";
import * as z from "zod";
import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormControl } from "@/components/ui-retab/form";
import { Button } from "@/components/ui-retab/button";
import { Input } from "@/components/ui-retab/input";
import { Label } from "@/components/ui-retab/label";
import { Textarea } from "@/components/ui-retab/textarea";
import { Switch } from "@/components/ui-retab/switch";
import { DialogClose, DialogFooter } from "@/components/ui-retab/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-retab/tooltip";
import { X, AlertCircle } from "lucide-react";
import { useJsonSchema } from "@/components/schema-editor/contexts/json-schema";
import { setNullable, getEffectiveType, formatTitle } from "@/components/schema-editor/json-schema-builder";
import { SchemaNodeEditor } from "@/components/schema-editor/json-schema-node-editor";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { validateName } from "@/components/schema-editor/lib/json-schema-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ItemTypeSelector } from "@/components/schema-editor/item-type-selector";

// Then modify the PropertyForm component to use a form structure with Zod validation
const propertyFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/, {
      message:
        "Name must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 64 characters long",
    }),
  description: z.string().optional(),
  required: z.boolean(),
  nullable: z.boolean(),
});

type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export function PropertyForm({
  editedProperty,
  setEditedProperty,
  setJsonSchema: _setJsonSchema,
  editedJsonSchema,
  setEditedJsonSchema,
  editedName,
  setEditedName,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel = "Save Changes",
  onNameError,
  editMode = "editable",
  wrapCancelInDialogClose,
  wrapSubmitInDialogClose,
  fieldPathOverride,
  isRequired,
  onRequiredChange,
}: {
  editedProperty: ExtendedJSONSchema7;
  setEditedProperty: React.Dispatch<React.SetStateAction<ExtendedJSONSchema7>>;
  setJsonSchema: React.Dispatch<React.SetStateAction<ExtendedJSONSchema7>>;
  editedJsonSchema: ExtendedJSONSchema7;
  setEditedJsonSchema: React.Dispatch<
    React.SetStateAction<ExtendedJSONSchema7>
  >;
  editedName: string;
  setEditedName: (name: string) => void;
  onSubmit?: (values?: { name: string; property: ExtendedJSONSchema7 }) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  submitLabel?: string;
  onNameError?: (error: string | null) => void;
  editMode?: "promptOnly" | "readOnly" | "editable";
  wrapCancelInDialogClose?: boolean;
  wrapSubmitInDialogClose?: boolean;
  fieldPathOverride?: string;
  /** Whether this field is in its parent object's `required` array. */
  isRequired?: boolean;
  /** Toggle this field's membership in the parent's `required` array. */
  onRequiredChange?: (required: boolean) => void;
}) {
  const handleEditedJsonSchemaChange = useCallback(
    (newSchema: React.SetStateAction<ExtendedJSONSchema7>) => {
      setEditedJsonSchema(
        typeof newSchema === "function"
          ? newSchema(editedJsonSchema)
          : newSchema,
      );
    },
    [editedJsonSchema, setEditedJsonSchema],
  );

  const { jsonSchema } = useJsonSchema();

  // Create refs outside of conditional rendering
  const draggedParentRef = React.useRef(null);
  const draggedPropertyRef = React.useRef(null);

  // State for semantic validation errors
  const [nameSemanticError, setNameSemanticError] = useState<string | null>(
    () => {
      const propsList = Object.keys(jsonSchema.properties || {});
      return editedName
        ? validateName(editedName, propsList, editedName, "property")
        : null;
    },
  );

  // Validate property name for semantic rules not covered by Zod
  const validatePropertyName = useCallback(
    (name: string): string | null => {
      const propsList = Object.keys(jsonSchema.properties || {});
      return validateName(name, propsList, editedName, "property");
    },
    [jsonSchema, editedName],
  );

  const updateNameSemanticError = useCallback(
    (error: string | null) => {
      setNameSemanticError(error);
      onNameError?.(error);
    },
    [onNameError],
  );

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      name: editedName,
      description: editedProperty.description || "",
      required: isRequired ?? false,
      nullable: getEffectiveType(editedProperty).isNullable,
    },
    values: {
      name: editedName,
      description: editedProperty.description || "",
      required: isRequired ?? false,
      nullable: getEffectiveType(editedProperty).isNullable,
    },
    mode: "onBlur", // Validate on blur to show errors early
  });

  // Handle form submission with validation
  const handleSubmit = form.handleSubmit((data) => {
    // Check for semantic validation errors
    const semanticError = validatePropertyName(data.name);
    if (semanticError) {
      updateNameSemanticError(semanticError);
      return;
    }

    // Update the parent state with validated form data
    setEditedName(data.name);

    // Automatically set the title to match the name
    const updatedProperty = {
      ...editedProperty,
      title: formatTitle(data.name),
      description: data.description,
    };

    // Apply nullability from the explicit Nullable control (independent of required).
    const nullableProperty = setNullable(updatedProperty, data.nullable);
    setEditedProperty(nullableProperty);

    // Update parent object's `required` array membership.
    onRequiredChange?.(data.required);

    // Call parent onSubmit
    if (onSubmit) {
      onSubmit({
        name: data.name,
        property: nullableProperty,
      });
    }

    // Show success toast only for "Save Changes"
    if (submitLabel === "Save Changes") {
      toast.success("Changes saved successfully");
    }
  });

  // Add key down handler for Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Don't submit if there are semantic errors
      if (nameSemanticError) {
        e.preventDefault();
        return;
      }

      // Prevent the default behavior for textareas where Enter creates a newline
      if (e.target instanceof HTMLTextAreaElement) {
        // Only prevent default and submit if Ctrl+Enter or Cmd+Enter is pressed in textarea
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleSubmit();
        }
      } else {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  // Manual handlers to update parent state while editing
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditedName(value);
    updateNameSemanticError(null); // Clear semantic errors on change
    form.setValue("name", value, {
      shouldValidate: true,
    });
  };

  // Handle blur event for name field to check semantic validation
  const handleNameBlur = () => {
    const nameValue = form.getValues("name");
    if (nameValue && !form.formState.errors.name) {
      const semanticError = validatePropertyName(nameValue);
      updateNameSemanticError(semanticError);
    } else if (form.formState.errors.name) {
      // Clear semantic errors if there's already a syntax error
      updateNameSemanticError(null);
    }
  };

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    const updatedProperty = {
      ...editedProperty,
      description: value,
    };
    setEditedProperty(updatedProperty);
    form.setValue("description", value);
  };

  const handleRequiredChange = (checked: boolean) => {
    form.setValue("required", checked);
  };

  const handleNullableChange = (checked: boolean) => {
    setEditedProperty(setNullable(editedProperty, checked));
    form.setValue("nullable", checked);
  };

  // AI generation removed in project builder

  // Disable submit when enum is selected but no options are enabled
  const isEnumSelected = getEffectiveType(editedProperty).type === "enum";
  const getEffectiveEnumValues = () => {
    if (Array.isArray((editedProperty as any).enum))
      return (editedProperty as any).enum as any[];
    if (Array.isArray((editedProperty as any).anyOf)) {
      const nonNull = (editedProperty as any).anyOf.find(
        (b: any) =>
          typeof b === "object" && (b.type !== "null" || b.$ref || b.enum),
      );
      if (nonNull && Array.isArray(nonNull.enum)) return nonNull.enum as any[];
    }
    return [] as any[];
  };
  const isEnumWithoutOptions =
    isEnumSelected && getEffectiveEnumValues().length === 0;

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="flex h-full flex-col"
      >
        {/* Scrollable content area */}
        <div className="max-h-[60vh] flex-1 overflow-y-auto">
          <div className="space-y-4 border-b border-border p-4">
            {/* Iteration warning removed for project builder */}

            <FormField
              control={form.control}
              name="name"
              render={({ field: _field, fieldState }) => (
                <FormItem>
                  <div className="flex flex-row items-center gap-2">
                    <Label htmlFor="name">
                      Name
                    </Label>
                  </div>
                  <FormControl>
                    <Input
                      id="name"
                      disabled={editMode !== "editable"}
                      value={editedName}
                      onChange={handleNameChange}
                      onBlur={handleNameBlur}
                      className={`${fieldState.error || nameSemanticError ? "border-destructive" : ""} ${editMode !== "editable" ? "disabled:opacity-100" : ""}`}
                      placeholder="e.g. first_name or firstName"
                      required
                    />
                  </FormControl>
                  {fieldState.error && (
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {fieldState.error.message}
                    </p>
                  )}
                  {!fieldState.error && nameSemanticError && (
                    <p className="mt-1 flex items-center gap-1 text-sm font-medium text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {nameSemanticError}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <div>
              <Label htmlFor="type">
                Data type
              </Label>
              <ItemTypeSelector
                name={editedName}
                editMode={editMode}
                disabled={editMode !== "editable"}
                value={editedProperty}
                onChange={setEditedProperty}
                setJsonSchema={setEditedJsonSchema}
                isRoot={true}
                focusPath={fieldPathOverride ?? editedName}
              />
            </div>

            {editMode === "editable" &&
              getEffectiveType(editedProperty).type === "object" &&
              !editedProperty.$ref && (
                <div className="rounded-md border p-3">
                  <SchemaNodeEditor
                    name={editedName}
                    node={editedProperty as ExtendedJSONSchema7}
                    onChange={setEditedProperty}
                    jsonSchema={editedJsonSchema}
                    setJsonSchema={handleEditedJsonSchemaChange}
                    path="#/object"
                    defs={jsonSchema.$defs || {}}
                    canDelete={false}
                    setDefsAccordionOpen={() => {}}
                    draggedParentRef={draggedParentRef}
                    draggedPropertyRef={draggedPropertyRef}
                  />
                </div>
              )}
            {editMode === "editable" &&
              getEffectiveType(editedProperty).type === "array" && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label className="text-xs text-muted-foreground">
                    List item type
                  </Label>
                  <SchemaNodeEditor
                    name="items"
                    node={
                      (editedProperty.items as ExtendedJSONSchema7) || {
                        type: "string",
                      }
                    }
                    onChange={(updatedItems) => {
                      setEditedProperty({
                        ...editedProperty,
                        items: updatedItems,
                      });
                    }}
                    jsonSchema={editedJsonSchema}
                    setJsonSchema={handleEditedJsonSchemaChange}
                    path="#/array-item"
                    defs={jsonSchema.$defs || {}}
                    canDelete={false}
                    setDefsAccordionOpen={() => {}}
                    draggedParentRef={draggedParentRef}
                    draggedPropertyRef={draggedPropertyRef}
                    hidePencilButton={true}
                  />
                </div>
              )}
            <div className="flex flex-row items-center gap-6">
              {onRequiredChange ? (
                <FormField
                  control={form.control}
                  name="required"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                      <FormControl>
                        <Switch
                          id="required"
                          disabled={editMode !== "editable"}
                          checked={field.value}
                          onCheckedChange={handleRequiredChange}
                          className={
                            editMode !== "editable" ? "disabled:opacity-100" : ""
                          }
                        />
                      </FormControl>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Label
                            htmlFor="required"
                            className="cursor-pointer"
                          >
                            Required
                          </Label>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            Required fields must be present in the object. This
                            adds the field to the parent object&apos;s{" "}
                            <code>required</code> list.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </FormItem>
                  )}
                />
              ) : null}
              <FormField
                control={form.control}
                name="nullable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormControl>
                      <Switch
                        id="nullable"
                        disabled={editMode !== "editable"}
                        checked={field.value}
                        onCheckedChange={handleNullableChange}
                        className={
                          editMode !== "editable" ? "disabled:opacity-100" : ""
                        }
                      />
                    </FormControl>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="nullable"
                          className="cursor-pointer"
                        >
                          Nullable
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          Nullable fields allow <code>null</code> as a value (the
                          type is widened to include <code>null</code>).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="space-y-4 p-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="group">
                  <div className="flex flex-row items-center justify-between gap-2">
                    <Label htmlFor="description">
                      Description
                    </Label>
                  </div>
                  <FormControl>
                    <Textarea
                      id="description"
                      value={editedProperty.description || ""}
                      onChange={handleDescriptionChange}
                      onBlur={field.onBlur}
                      disabled={editMode === "readOnly"}
                      className={
                        editMode === "readOnly" ? "disabled:opacity-100" : ""
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />

          </div>
        </div>

        {/* Fixed action buttons at the bottom - hidden in readOnly mode */}
        {editMode !== "readOnly" && (
          <DialogFooter className="mx-0 mb-0 flex-row justify-between sm:justify-between">
            {/* Delete button on the left */}
            <div>
              {onDelete && editMode === "editable" && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                >
                  Delete Property
                </Button>
              )}
            </div>

            {/* Cancel/Save buttons on the right */}
            <div className="flex space-x-2">
              {onCancel &&
                (wrapCancelInDialogClose ? (
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onCancel}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                  >
                    Cancel
                  </Button>
                ))}
              {wrapSubmitInDialogClose ? (
                <DialogClose asChild>
                  <Button
                    type="submit"
                    size="sm"
                    className="px-3"
                    disabled={
                      isEnumWithoutOptions ||
                      !!nameSemanticError ||
                      !!form.formState.errors.name
                    }
                  >
                    {submitLabel}
                  </Button>
                </DialogClose>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  className="px-3"
                  disabled={
                    isEnumWithoutOptions ||
                    !!nameSemanticError ||
                    !!form.formState.errors.name
                  }
                >
                  {submitLabel}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </form>
    </Form>
  );
}
