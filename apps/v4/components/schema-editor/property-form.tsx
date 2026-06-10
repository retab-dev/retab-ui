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
import { DialogClose } from "@/components/ui-retab/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-retab/tooltip";
import { ChevronLeft, X, AlertCircle } from "lucide-react";
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

  const [dialogMode, setDialogMode] = useState<
    "main" | "array-editor" | "object-editor"
  >("main");
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
      required: !getEffectiveType(editedProperty).isNullable,
    },
    values: {
      name: editedName,
      description: editedProperty.description || "",
      required: !getEffectiveType(editedProperty).isNullable,
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
    const {
      "X-Reasoning": _xr,
      "X-ReasoningPrompt": _xrp,
      ...baseProperty
    } = editedProperty;
    const updatedProperty = {
      ...baseProperty,
      title: formatTitle(data.name),
      description: data.description,
    };

    // Update nullable status based on required field
    const nullableProperty = setNullable(updatedProperty, !data.required);
    setEditedProperty(nullableProperty);

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

  const handleRequiredChange = (checked: boolean | "indeterminate") => {
    if (typeof checked === "boolean") {
      const updatedProperty = setNullable(editedProperty, !checked);
      setEditedProperty(updatedProperty);
      form.setValue("required", checked);
    }
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

  // Render a different UI based on dialog mode
  if (
    editMode === "editable" &&
    dialogMode === "array-editor" &&
    getEffectiveType(editedProperty).type === "array"
  ) {
    return (
      <div className="max-h-[80vh] space-y-4 overflow-y-auto p-4">
        <div className="mb-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogMode("main")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-lg font-medium">Edit list items</h2>
        </div>

        <div className="rounded-md bg-muted p-4">
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

        <div className="mt-4 flex justify-end space-x-2">
          <Button onClick={() => setDialogMode("main")}>Done</Button>
        </div>
      </div>
    );
  }

  if (
    editMode === "editable" &&
    dialogMode === "object-editor" &&
    getEffectiveType(editedProperty).type === "object"
  ) {
    return (
      <div className="max-h-[80vh] space-y-4 overflow-y-auto p-4">
        <div className="mb-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogMode("main")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-lg font-medium">Edit Object Properties</h2>
        </div>

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

        <div className="mt-4 flex justify-end space-x-2">
          <Button onClick={() => setDialogMode("main")}>Done</Button>
        </div>
      </div>
    );
  }

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
                    <Label
                      htmlFor="name"
                      className="block text-sm font-medium text-foreground"
                    >
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
              <Label
                htmlFor="type"
                className="block text-sm font-medium text-foreground"
              >
                Data type
              </Label>
              <ItemTypeSelector
                name={editedName}
                editMode={editMode}
                disabled={editMode !== "editable"}
                value={editedProperty}
                onChange={setEditedProperty}
                setJsonSchema={setEditedJsonSchema}
                setDialogMode={setDialogMode}
                isRoot={true}
                focusPath={fieldPathOverride ?? editedName}
              />
            </div>
            <div className="flex flex-row items-center justify-between">
              <FormField
                control={form.control}
                name="required"
                render={({ field: _field2 }) => (
                  <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                    <FormControl>
                      <Switch
                        id="required"
                        disabled={editMode !== "editable"}
                        checked={!getEffectiveType(editedProperty).isNullable}
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
                          className="cursor-pointer text-sm font-medium text-foreground"
                        >
                          Required
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          When a field is required, it must have a value and
                          cannot be null or undefined.
                        </p>
                        <p>
                          Required fields must be provided when submitting data
                          for this schema.
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
                    <Label
                      htmlFor="description"
                      className="block text-sm font-medium text-foreground"
                    >
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
          <div className="flex justify-between p-4">
            {/* Delete button on the left */}
            <div>
              {onDelete && editMode === "editable" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={false}
                  onClick={onDelete}
                  className={
                    "border-destructive text-destructive hover:border-destructive hover:text-destructive"
                  }
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
                  className="group before:transtion-opacity relative isolate inline-flex h-[1.875rem] items-center justify-center overflow-hidden rounded-md bg-primary px-3 text-left text-sm font-medium text-primary-foreground shadow-[0_1px_theme(colors.white/0.07)_inset,0_1px_3px_theme(colors.gray.900/0.2)] ring-1 ring-ring transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-b before:from-white/20 before:opacity-50 before:duration-300 before:ease-[cubic-bezier(0.4,0.36,0,1)] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:bg-gradient-to-b after:from-white/10 after:from-[46%] after:to-[54%] after:mix-blend-overlay hover:bg-primary/90 hover:opacity-80 hover:before:opacity-100"
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
          </div>
        )}
      </form>
    </Form>
  );
}
