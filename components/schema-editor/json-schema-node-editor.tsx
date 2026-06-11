"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui-retab/button";
import { Input } from "@/components/ui-retab/input";
import {
  Pencil,
  PlusIcon,
  Trash2,
  AlertCircle,
  X,
  EyeIcon,
  ChevronDown,
  Type,
  Hash,
  ToggleLeft,
  List,
  Braces,
  Brackets,
  Calendar,
  Clock,
  CalendarClock,
  Link,
  Copy,
  GripVertical,
  Shapes,
  MapPin,
  DollarSign,
  User,
  Building2,
  CalendarDays,
  Eye,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui-retab/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui-retab/dropdown-menu";
import { NodeDialog } from "@/components/schema-editor/node-dialog";
import { EnumCreationDialog } from "./enum-creation-dialog";
import { JSONSchema7Definition } from "json-schema";
import { templateObjects } from "./template-objects";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import {
  getEffectiveNode,
  validateName,
} from "@/components/schema-editor/lib/json-schema-utils";
import {
  applyObjectTemplateReference,
  defaultSchemaForType,
  formatTitle,
  getEffectiveType,
  renamePropertyAtPath,
  updateEffectiveNode,
  updateSchemaProperty,
  updateType,
} from "./json-schema-builder-utils";
import { useJsonSchemaOptional } from "@/components/schema-editor/contexts/json-schema";
import {
  getChildNodeId,
  getItemsNodeId,
  replaceNodeJson,
} from "@/components/schema-editor/document";

const getTemplateIcon = (templateName: string) => {
  switch (templateName) {
    case "Address":
      return <MapPin className="h-4 w-4" />;
    case "Price":
      return <DollarSign className="h-4 w-4" />;
    case "Person":
      return <User className="h-4 w-4" />;
    case "Company":
      return <Building2 className="h-4 w-4" />;
    case "Event":
      return <CalendarDays className="h-4 w-4" />;
    default:
      return <Link className="h-4 w-4" />;
  }
};

function isJSONSchema(
  value: JSONSchema7Definition,
): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null;
}

export function SchemaNodeEditor({
  name,
  node,
  onChange: onChangeProp,
  nodeId,
  jsonSchema,
  setJsonSchema,
  path,
  defs,
  canDelete = false,
  onDelete,
  onNameChange,
  setDefsAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
  editMode = "editable",
  hidePencilButton = false,
  isRequired,
  onRequiredChange,
}: {
  name: string;
  node: ExtendedJSONSchema7;
  onChange: (newNode: ExtendedJSONSchema7) => void;
  /** Document id of this node. When present (and inside a provider), edits route
   *  through the Document by id; otherwise they fall back to `onChange`. */
  nodeId?: string;
  jsonSchema: ExtendedJSONSchema7;
  setJsonSchema: (
    newSchema: React.SetStateAction<ExtendedJSONSchema7>,
  ) => void | Promise<void>;
  path: string;
  defs?: Record<string, JSONSchema7Definition>;
  canDelete?: boolean;
  onDelete?: () => void;
  onNameChange?: (newName: string, updatedNode?: ExtendedJSONSchema7) => void;
  setDefsAccordionOpen: (open: boolean) => void;
  draggedParentRef: React.RefObject<string | null>;
  draggedPropertyRef: React.RefObject<string | null>;
  editMode?: "descriptionOnly" | "readOnly" | "editable";
  hidePencilButton?: boolean;
  /** Whether this field is in its parent object's `required` array. */
  isRequired?: boolean;
  /** Toggle this field's membership in the parent's `required` array. */
  onRequiredChange?: (required: boolean) => void;
}) {
  const parentPath = path;

  // Document routing: when this node has an id and a provider is present, every
  // edit (which is always `onChange(updateEffectiveNode(node, …))`) is spliced
  // back into the Document by id — node-local, id-stable, serialization-faithful.
  // Without a nodeId (e.g. inside the standalone PropertyForm) we fall back to the
  // original bubbling `onChange`, so that path is unchanged.
  const schemaCtx = useJsonSchemaOptional();
  const onChange = React.useCallback(
    (newNode: ExtendedJSONSchema7) => {
      if (schemaCtx?.applyDocOp && nodeId) {
        schemaCtx.applyDocOp((d) => replaceNodeJson(d, nodeId, newNode));
      } else {
        onChangeProp(newNode);
      }
    },
    [schemaCtx, nodeId, onChangeProp],
  );
  const childNodeId = (propName: string): string | undefined =>
    schemaCtx?.doc && nodeId
      ? getChildNodeId(schemaCtx.doc, nodeId, propName)
      : undefined;
  const itemsNodeId: string | undefined =
    schemaCtx?.doc && nodeId
      ? getItemsNodeId(schemaCtx.doc, nodeId)
      : undefined;

  const { type: localType, isNullable: localNullable } = getEffectiveType(node);
  const isEditable = editMode === "editable";

  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [enumCreationDialogOpen, setEnumCreationDialogOpen] = useState(false);
  const [, setPendingTypeBeforeEnum] = useState<string>("");

  // Validate property name
  const validatePropertyName = (propName: string): string | null => {
    if (effective.properties) {
      // For properties, we need to check against existing property names
      const existingProps = Object.keys(effective.properties);
      return validateName(propName, existingProps, name, "property");
    }

    // For other cases, just check basic validation rules
    return validateName(propName, [], name, "name");
  };

  const [newPropName, setNewPropName] = useState("");
  const [newPropErr, setNewPropErr] = useState<string | null>(null);

  const [isEditingPropertyName, setIsEditingPropertyName] = useState(false);
  const [editedPropertyName, setEditedPropertyName] = useState(name);
  const [propInlineErr, setPropInlineErr] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(
    node.description || "",
  );

  // --- New state for the enum value input ---
  const [newEnumValue, setNewEnumValue] = useState("");

  const firstEnumInputRef = React.useRef<HTMLInputElement>(null);
  const newEnumInputRef = React.useRef<HTMLInputElement>(null);

  const effective = getEffectiveNode(node);
  const description = node.description || "";

  const handleTypeChange = (newType: string) => {
    if (newType === "enum") {
      // Only open the enum creation dialog if the field is not already an enum
      if (localType !== "enum") {
        // Store the current type before opening the enum dialog
        setPendingTypeBeforeEnum(localType);
        setEnumCreationDialogOpen(true);
        return;
      } else {
        // Field is already an enum, no need to open dialog
        return;
      }
    }
    const updated = updateType(newType, localNullable, node);
    onChange(updated);
  };

  // Handle enum creation dialog confirmation
  const handleEnumConfirm = (enumValues: string[]) => {
    const enumSchema = {
      enum: enumValues,
      type: "string",
    } as ExtendedJSONSchema7;
    const updated = updateType("enum", localNullable, enumSchema);
    onChange(updated);
  };

  // Handle enum creation dialog cancellation
  const handleEnumCancel = () => {
    // Revert to the previous type
    // No need to change anything since we haven't applied the enum type yet
  };

  const handlePropertyNameSubmit = () => {
    const err = validateInline(editedPropertyName);
    if (err) {
      setPropInlineErr(err); // keep the editor open until fixed
      return;
    }
    setPropInlineErr(null);

    if (editedPropertyName && editedPropertyName !== name && onNameChange) {
      onNameChange(editedPropertyName);
    }
    setIsEditingPropertyName(false);
  };

  const handleDescriptionSubmit = () => {
    const trimmedValue = editedDescription.trim();
    const currentDescription = description;
    if (trimmedValue === currentDescription.trim()) {
      setIsEditingDescription(false);
      return;
    }

    const { description: _omittedDescription, ...effectiveWithoutDescription } =
      effective;
    const updatedEffective = trimmedValue
      ? { ...effectiveWithoutDescription, description: editedDescription }
      : effectiveWithoutDescription;

    onChange(
      updateEffectiveNode(node, updatedEffective as ExtendedJSONSchema7),
    );
    setIsEditingDescription(false);
  };

  /* ------------------- Enum Handlers ------------------- */
  const handleAddEnum = () => {
    if (!newEnumValue.trim()) return;
    const currentEnum = effective.enum || [];
    const updatedEffective = {
      ...effective,
      enum: [...currentEnum, newEnumValue.trim()],
    };
    onChange(updateEffectiveNode(node, updatedEffective));
    setNewEnumValue("");

    // Focus back on the input field for adding another enum value
    const inputElement = document.querySelector(
      'input[placeholder="New choice"]',
    );
    if (inputElement) {
      (inputElement as HTMLInputElement).focus();
    }
  };

  const handleRemoveEnum = (index: number) => {
    const updatedEnum = (effective.enum || []).filter(
      (_: any, i: number) => i !== index,
    );
    const updatedEffective = { ...effective, enum: updatedEnum };
    onChange(updateEffectiveNode(node, updatedEffective));
  };

  const handleEditEnum = (index: number, newValue: string) => {
    const updatedEnum = (effective.enum || []).map((val: any, i: number) =>
      i === index ? newValue : val,
    );
    const updatedEffective = { ...effective, enum: updatedEnum };
    onChange(updateEffectiveNode(node, updatedEffective));
  };

  const reorderProperties = (sourceKey: string, targetKey: string) => {
    const currentProperties = effective.properties || {};
    const keys = Object.keys(currentProperties);

    const sourceIndex = keys.indexOf(sourceKey);
    const targetIndex = keys.indexOf(targetKey);

    // Basic validation
    if (
      sourceIndex === -1 ||
      targetIndex === -1 ||
      sourceIndex === targetIndex
    ) {
      console.warn(
        "[DRAG] Drag and drop reorder failed: Invalid keys or indices. sourceIndex:",
        sourceIndex,
        "targetIndex:",
        targetIndex,
      );
      return;
    }

    let reorderedKeys = keys;
    if (sourceIndex < targetIndex) {
      // Move the source key before the target key
      reorderedKeys = [
        ...keys.slice(0, sourceIndex),
        ...keys.slice(sourceIndex + 1, targetIndex + 1),
        sourceKey,
        ...keys.slice(targetIndex + 1),
      ];
    } else {
      // Move the source key after the target key
      reorderedKeys = [
        ...keys.slice(0, targetIndex),
        sourceKey,
        ...keys.slice(targetIndex, sourceIndex),
        ...keys.slice(sourceIndex + 1),
      ];
    }

    // Create a new array with the reordered keys
    // Create the new properties object preserving the new order
    const newProperties: Record<string, ExtendedJSONSchema7> = {};
    reorderedKeys.forEach((key) => {
      // Ensure the property actually exists in the original object
      if (Object.prototype.hasOwnProperty.call(currentProperties, key)) {
        const property = currentProperties[key];
        if (typeof property === "object" && property !== null) {
          newProperties[key] = property as ExtendedJSONSchema7;
        }
      }
    });


    // Update the schema state
    const updatedEffective = { ...effective, properties: newProperties };
    const finalUpdatedNode = updateEffectiveNode(node, updatedEffective);
    onChange(finalUpdatedNode);
  };
  /* ------------------- Drag and Drop Handlers ------------------- */
  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    propName: string,
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData("text/plain", propName);
    event.dataTransfer.effectAllowed = "move";
    draggedParentRef.current = parentPath;
    draggedPropertyRef.current = propName;

    // Create a custom drag image
    const dragElement = document.createElement("div");
    const rect = event.currentTarget.getBoundingClientRect();

    // Apply styling for the drag image
    dragElement.style.width = `${rect.width}px`;
    dragElement.style.padding = "8px";
    dragElement.style.border = "1px solid var(--ring)";
    dragElement.style.borderRadius = "4px";
    dragElement.style.backgroundColor = "var(--background)";
    dragElement.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
    dragElement.style.opacity = "0.8";
    dragElement.style.position = "fixed";
    dragElement.style.zIndex = "9999";
    dragElement.style.pointerEvents = "none";
    dragElement.innerHTML = `<span style="font-weight: medium">${propName}</span>`;
    document.body.appendChild(dragElement);

    // Set the custom drag image and then remove the element
    event.dataTransfer.setDragImage(dragElement, 10, 10);
    setTimeout(() => {
      document.body.removeChild(dragElement);
    }, 0);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    targetPropName: string,
  ) => {
    event.preventDefault(); // Necessary to allow dropping
    const currentProperties = effective.properties || {};
    const keys = Object.keys(currentProperties);

    const sourceIndex = keys.indexOf(draggedPropertyRef.current!);
    const targetIndex = keys.indexOf(targetPropName);

    event.dataTransfer.dropEffect = "move";

    if (
      draggedParentRef.current === parentPath &&
      targetPropName !== draggedPropertyRef.current
    ) {
      // Optional: Add visual feedback for drop target
      event.currentTarget.classList.add(
        sourceIndex > targetIndex ? "border-t-2" : "border-b-2",
      );

      event.currentTarget.classList.add("border-grey-700");
      event.currentTarget.classList.add("border-dashed");
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    // Optional: Remove visual feedback
    event.stopPropagation();
    event.currentTarget.classList.remove("border-t-2");
    event.currentTarget.classList.remove("border-b-2");
    event.currentTarget.classList.remove("border-grey-700");
    event.currentTarget.classList.remove("border-dashed");
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetPropName: string,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const sourcePropName = event.dataTransfer.getData("text/plain");

    event.currentTarget.classList.remove("border-t-2");
    event.currentTarget.classList.remove("border-b-2");
    event.currentTarget.classList.remove("border-grey-700");
    event.currentTarget.classList.remove("border-dashed");

    if (
      sourcePropName &&
      sourcePropName !== targetPropName &&
      draggedParentRef.current === parentPath
    ) {
      reorderProperties(sourcePropName, targetPropName);
    } else {
    }
  };

  const handleDragEnd = (_event: React.DragEvent<HTMLDivElement>) => {
    // Optional: Clean up dragging class
  };

  // helper for this particular field
  const validateInline = (val: string) =>
    validateName(
      val,
      Object.keys(effective.properties || []),
      name, // current key we're editing
      "property",
    );

  // Get icon for type
  const getTypeIcon = (type: string, refName?: string) => {
    switch (type) {
      case "string":
        return <Type className="h-4 w-4" />;
      case "number":
      case "integer":
        return <Hash className="h-4 w-4" />;
      case "boolean":
        return <ToggleLeft className="h-4 w-4" />;
      case "enum":
        return <List className="h-4 w-4" />;
      case "object":
        return <Braces className="h-4 w-4" />;
      case "array":
        return <Brackets className="h-4 w-4" />;
      case "date":
        return <Calendar className="h-4 w-4" />;
      case "time":
        return <Clock className="h-4 w-4" />;
      case "datetime":
        return <CalendarClock className="h-4 w-4" />;
      case "$ref":
        return getTemplateIcon(refName || "");
      default:
        return <Shapes className="h-4 w-4" />;
    }
  };

  return (
    <div>
      {/* Header - only show for non-root elements */}
      {path !== "#" && (
        <div
          id={`schema-field-${path.replace(/^#\.?/, "").split(".").join("-")}`}
          className="group flex flex-col items-start justify-between py-0 pl-0 hover:bg-accent sm:flex-row sm:items-center"
        >
          {isEditable ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <GripVertical className="h-12 w-6 cursor-pointer px-1 py-4 text-transparent group-hover:text-muted-foreground" />
              </TooltipTrigger>
            </Tooltip>
          ) : (
            <div className="h-12 w-6 px-1 py-4" />
          )}

          {/* The "left column" that holds name + description */}
          <div className="flex min-w-0 flex-1 items-center space-x-2">
            {isEditingPropertyName && isEditable ? (
              <Input
                className={`m-0 h-6 w-40 border-none p-0 px-1 text-sm font-medium shadow-none outline-none focus-visible:ring-0 ${propInlineErr ? "border-destructive" : ""}`}
                value={editedPropertyName}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditedPropertyName(val);
                  setPropInlineErr(val ? validateInline(val) : null);
                }}
                onBlur={handlePropertyNameSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePropertyNameSubmit();
                  }
                }}
                autoFocus
              />
            ) : (
              <div className="flex items-center">
                <span
                  className="mr-1 cursor-pointer text-sm font-medium whitespace-nowrap text-foreground"
                  onClick={() => {
                    if (onNameChange) {
                      setEditedPropertyName(name);
                      setPropInlineErr(null);
                      setIsEditingPropertyName(true);
                    }
                  }}
                >
                  {name}
                </span>
                {localType === "$ref" && effective.$ref && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={() => {
                      const defName = effective.$ref?.replace("#/$defs/", "");
                      if (setDefsAccordionOpen) {
                        setDefsAccordionOpen(true);
                      }
                      setTimeout(() => {
                        const defElement = document.getElementById(
                          `def-${defName}`,
                        );
                        if (defElement) {
                          defElement.scrollIntoView({ behavior: "smooth" });
                          defElement.classList.add("bg-accent");
                          setTimeout(
                            () => defElement.classList.remove("bg-accent"),
                            2500,
                          );
                        }
                      }, 600);
                    }}
                  >
                    <EyeIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            )}
            {isEditingPropertyName && propInlineErr && (
              <p className="mt-1 ml-1 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {propInlineErr}
              </p>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {isEditingDescription && editMode !== "readOnly" ? (
                <Input
                  className="m-0 h-6 border-none p-0 px-1 !text-xs shadow-none outline-none focus-visible:ring-0"
                  value={editedDescription}
                  placeholder="Add description"
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onBlur={handleDescriptionSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleDescriptionSubmit();
                    } else if (e.key === "Escape") {
                      setEditedDescription(description);
                      setIsEditingDescription(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex h-6 min-w-[140px] flex-1 items-center truncate rounded-sm px-1 !text-xs ${
                        editMode === "readOnly"
                          ? "text-muted-foreground"
                          : "text-muted-foreground cursor-text hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() => {
                        if (editMode === "readOnly") {
                          setMetadataDialogOpen(true);
                          return;
                        }
                        setEditedDescription(description);
                        setIsEditingDescription(true);
                      }}
                    >
                      {description || (
                        <span className="text-muted-foreground/70">
                          Add description
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>

                  {description && (
                    <TooltipContent className="max-w-xs">
                      <div className="mb-1 text-xs text-muted-foreground">
                        Description:
                      </div>
                      <div className="text-xs">{description}</div>
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditable && canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="m-0 h-3 w-3 p-0"
                onClick={onDelete}
              >
                <Trash2 className="group-hover:text-muted-foreground h-1 w-1 text-primary-foreground" />
              </Button>
            )}

            {!hidePencilButton && editMode !== "readOnly" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="m-0 p-0"
                    onClick={() => setMetadataDialogOpen(true)}
                  >
                    <Pencil className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Edit field properties</p>
                </TooltipContent>
              </Tooltip>
            )}

            {editMode === "readOnly" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="m-0 p-0"
                    onClick={() => setMetadataDialogOpen(true)}
                  >
                    <Eye className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>View field properties</p>
                </TooltipContent>
              </Tooltip>
            )}


            {isEditable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-40 justify-between pr-0 text-xs font-normal text-muted-foreground"
                  >
                    <div className="flex items-center gap-1">
                      {getTypeIcon(
                        localType,
                        localType === "$ref" && effective.$ref
                          ? effective.$ref.replace("#/$defs/", "")
                          : undefined,
                      )}
                      <span className="">
                        {localType === "$ref" && effective.$ref
                          ? effective.$ref.replace("#/$defs/", "")
                          : localType === "date"
                            ? "date"
                            : localType === "time"
                              ? "time"
                              : localType === "datetime"
                                ? "datetime"
                                : localType === "boolean"
                                  ? "true/false"
                                  : localType === "enum"
                                    ? "multiple choice"
                                    : localType === "array"
                                      ? "list"
                                      : localType || "Select type"}
                      </span>
                    </div>
                    <ChevronDown className="mx-2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => handleTypeChange("string")}>
                    <Type className="mr-2 h-4 w-4" />
                    string
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("number")}>
                    <Hash className="mr-2 h-4 w-4" />
                    number
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleTypeChange("integer")}
                  >
                    <Hash className="mr-2 h-4 w-4" />
                    integer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleTypeChange("boolean")}
                  >
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    true/false
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("enum")}>
                    <List className="mr-2 h-4 w-4" />
                    multiple choice
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("object")}>
                    <Braces className="mr-2 h-4 w-4" />
                    object
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("array")}>
                    <Brackets className="mr-2 h-4 w-4" />
                    list
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("date")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    date
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("time")}>
                    <Clock className="mr-2 h-4 w-4" />
                    time
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleTypeChange("datetime")}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    datetime
                  </DropdownMenuItem>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Link className="mr-4 h-4 w-4" />
                      definition
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {!defs || Object.keys(defs).length === 0 ? (
                          <DropdownMenuItem
                            onSelect={() => {
                              if (setDefsAccordionOpen) {
                                setDefsAccordionOpen(true);
                                // Add a small delay to ensure accordion is open before scrolling
                                setTimeout(() => {
                                  const defsSection = document.getElementById(
                                    "definitions-section",
                                  );
                                  if (defsSection) {
                                    defsSection.scrollIntoView({
                                      behavior: "smooth",
                                    });
                                    // Apply a stronger highlight
                                    defsSection.style.backgroundColor =
                                      "var(--accent)";
                                    setTimeout(() => {
                                      defsSection.style.backgroundColor = ""; // Reset to default
                                    }, 2500);
                                  }
                                }, 600);
                              }
                            }}
                          >
                            <PlusIcon className="mr-2 h-4 w-4" />
                            Create a new definition to get started
                          </DropdownMenuItem>
                        ) : (
                          Object.keys(defs).map((defKey) => (
                            <DropdownMenuItem
                              key={defKey}
                              onSelect={() => {
                                onChange(
                                  updateEffectiveNode(node, {
                                    $ref: `#/$defs/${defKey}`,
                                  }),
                                );
                              }}
                            >
                              {getTemplateIcon(defKey)}
                              {defKey}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Shapes className="mr-4 h-4 w-4" />
                      object template
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {Object.entries(templateObjects).map(([name]) => {
                          // Get appropriate icon for each template type

                          return (
                            <DropdownMenuItem
                              key={name}
                              className="flex items-center gap-2"
                              onSelect={() => {
                                const updatedNode = updateEffectiveNode(node, {
                                  $ref: `#/$defs/${name}`,
                                });
                                const preview = applyObjectTemplateReference(
                                  jsonSchema,
                                  node,
                                  name,
                                );

                                setJsonSchema(
                                  (previousSchema) =>
                                    applyObjectTemplateReference(
                                      previousSchema,
                                      node,
                                      name,
                                    ).schema,
                                );

                                if (!preview.didUpdateTarget) {
                                  onChange(updatedNode);
                                }
                              }}
                            >
                              {getTemplateIcon(name)}
                              {name}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="ml-4 w-40 text-xs">
                {localType === "$ref" && effective.$ref
                  ? effective.$ref.replace("#/$defs/", "")
                  : localType === "date"
                    ? "date"
                    : localType === "time"
                      ? "time"
                      : localType === "datetime"
                        ? "datetime"
                        : localType === "boolean"
                          ? "true/false"
                          : localType === "enum"
                            ? "multiple choice"
                            : localType === "array"
                              ? "list"
                              : localType || "string"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render content based on type */}
      {localType === "object" && (
        <div className={path === "#" ? "px-0" : "pl-2"}>
          {path === "#" ? (
            <Accordion
              defaultValue="properties"
              type="single"
              collapsible
              className="w-full rounded-lg border border-border px-4 pb-0 shadow-sm"
            >
              <AccordionItem value="properties" className="border-none">
                <AccordionTrigger className="text-sm font-medium text-muted-foreground">
                  Properties ({Object.keys(effective.properties || {}).length})
                </AccordionTrigger>
                <AccordionContent className="">
                  <div className="">
                    {Object.keys(effective.properties || {}).length === 0 && (
                      <p className="ml-4 py-2 text-sm text-muted-foreground">
                        Define the data structure for this object.
                      </p>
                    )}
                    {effective.properties &&
                      Object.keys(effective.properties || {}).length > 0 &&
                      Object.keys(effective.properties || {}).map(
                        (propName) => {
                          const propValue = (effective.properties || {})[
                            propName
                          ];
                          return (
                            <div
                              key={propName}
                              className=""
                              draggable={isEditable}
                              onDragStart={(e) => handleDragStart(e, propName)}
                              onDragOver={(e) => handleDragOver(e, propName)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, propName)}
                              onDragEnd={handleDragEnd}
                              data-prop-key={propName}
                            >
                              {isJSONSchema(propValue) && (
                                <SchemaNodeEditor
                                  draggedParentRef={draggedParentRef}
                                  draggedPropertyRef={draggedPropertyRef}
                                  editMode={editMode}
                                  isRequired={
                                    Array.isArray(effective.required) &&
                                    effective.required.includes(propName)
                                  }
                                  onRequiredChange={(req) => {
                                    const cur = Array.isArray(effective.required)
                                      ? effective.required
                                      : [];
                                    const newRequired = req
                                      ? Array.from(new Set([...cur, propName]))
                                      : cur.filter((r) => r !== propName);
                                    onChange(
                                      updateEffectiveNode(node, {
                                        ...effective,
                                        required: newRequired,
                                      }),
                                    );
                                  }}
                                  name={propName}
                                  nodeId={childNodeId(propName)}
                                  node={propValue as ExtendedJSONSchema7}
                                  jsonSchema={jsonSchema}
                                  setJsonSchema={setJsonSchema}
                                  onChange={(newProp) => {
                                    const newProperties = {
                                      ...(effective.properties || {}),
                                      [propName]: newProp,
                                    };
                                    const updatedEffective = {
                                      ...effective,
                                      properties: newProperties,
                                    };
                                    onChange(
                                      updateEffectiveNode(
                                        node,
                                        updatedEffective,
                                      ),
                                    );
                                  }}
                                  onNameChange={(newName, updatedNode) => {
                                    if (newName !== propName) {
                                      const updated = updateSchemaProperty(
                                        node,
                                        propName,
                                        newName,
                                        updatedNode ||
                                          (effective.properties?.[
                                            propName
                                          ] as ExtendedJSONSchema7),
                                      );
                                      onChange(
                                        updateEffectiveNode(node, updated),
                                      );
                                    }
                                  }}
                                  path={`${path}.${propName}`}
                                  defs={defs}
                                  canDelete={true}
                                  onDelete={() => {
                                    const newProperties = {
                                      ...effective.properties,
                                    };
                                    delete newProperties[propName];
                                    const newRequired = Array.isArray(
                                      effective.required,
                                    )
                                      ? effective.required.filter(
                                          (r: string) => r !== propName,
                                        )
                                      : [];
                                    const updatedEffective = {
                                      ...effective,
                                      properties: newProperties,
                                      required: newRequired,
                                    };
                                    onChange(
                                      updateEffectiveNode(
                                        node,
                                        updatedEffective,
                                      ),
                                    );
                                  }}
                                  setDefsAccordionOpen={setDefsAccordionOpen}
                                />
                              )}
                            </div>
                          );
                        },
                      )}
                    {isEditable && (
                      <div className="mt-3 ml-4 flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <Input
                            placeholder="New property name"
                            className={`h-8 w-40 ${newPropErr ? "border-destructive" : ""}`}
                            value={newPropName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewPropName(val);
                              setNewPropErr(
                                val
                                  ? validateName(
                                      val,
                                      Object.keys(effective.properties || []),
                                      undefined,
                                      "property",
                                    )
                                  : null,
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newPropName.trim()) {
                                const newProp = defaultSchemaForType("string");
                                newProp.title = formatTitle(newPropName);
                                const newProperties = {
                                  ...(effective.properties || {}),
                                  [newPropName]: newProp,
                                };
                                const newRequired = Array.isArray(
                                  effective.required,
                                )
                                  ? [...effective.required, newPropName]
                                  : [newPropName];
                                const updatedEffective = {
                                  ...effective,
                                  properties: newProperties,
                                  required: newRequired,
                                };
                                onChange(
                                  updateEffectiveNode(node, updatedEffective),
                                );
                                setNewPropName("");
                              }
                            }}
                          />

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!!newPropErr || !newPropName.trim()}
                            className={
                              !!newPropErr || !newPropName.trim()
                                ? "cursor-not-allowed"
                                : ""
                            }
                            onClick={() => {
                              const err = validateName(
                                newPropName,
                                Object.keys(effective.properties || []),
                                undefined,
                                "property",
                              );
                              if (err) {
                                setNewPropErr(err);
                                return;
                              }

                              const newProp = defaultSchemaForType("string");
                              newProp.title = formatTitle(newPropName);

                              const newProperties = {
                                ...(effective.properties || {}),
                                [newPropName]: newProp,
                              };
                              const newRequired = Array.isArray(
                                effective.required,
                              )
                                ? [...effective.required, newPropName]
                                : [newPropName];

                              const updatedEffective = {
                                ...effective,
                                properties: newProperties,
                                required: newRequired,
                              };
                              onChange(
                                updateEffectiveNode(node, updatedEffective),
                              );
                              setNewPropName("");
                            }}
                          >
                            <PlusIcon className="h-4 w-4" />
                            <span>Add</span>
                          </Button>
                        </div>

                        {newPropErr && (
                          <p className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="h-3 w-3" /> {newPropErr}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <div className="">
              {effective.properties &&
                Object.keys(effective.properties || {}).length > 0 &&
                Object.keys(effective.properties || {}).map((propName) => {
                  const propValue = (effective.properties || {})[propName];
                  return (
                    <div
                      key={propName}
                      className="ml-4 border-l border-border"
                      draggable={isEditable}
                      onDragStart={(e) => handleDragStart(e, propName)}
                      onDragOver={(e) => handleDragOver(e, propName)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, propName)}
                      onDragEnd={handleDragEnd}
                      data-prop-key={propName}
                    >
                      {isJSONSchema(propValue) && (
                        <SchemaNodeEditor
                          draggedParentRef={draggedParentRef}
                          name={propName}
                          nodeId={childNodeId(propName)}
                          draggedPropertyRef={draggedPropertyRef}
                          editMode={editMode}
                          node={propValue as ExtendedJSONSchema7}
                          onChange={(newProp) => {
                            const newProperties = {
                              ...(effective.properties || {}),
                              [propName]: newProp,
                            };
                            const updatedEffective = {
                              ...effective,
                              properties: newProperties,
                            };
                            onChange(
                              updateEffectiveNode(node, updatedEffective),
                            );
                          }}
                          jsonSchema={jsonSchema}
                          setJsonSchema={setJsonSchema}
                          onNameChange={(newName, updatedNode) => {
                            if (newName !== propName) {
                              const updated = updateSchemaProperty(
                                node,
                                propName,
                                newName,
                                updatedNode ||
                                  (effective.properties?.[
                                    propName
                                  ] as ExtendedJSONSchema7),
                              );
                              onChange(updateEffectiveNode(node, updated));
                            }
                          }}
                          path={`${path}.${propName}`}
                          defs={defs}
                          canDelete={true}
                          onDelete={() => {
                            const newProperties = { ...effective.properties };
                            delete newProperties[propName];
                            const newRequired = Array.isArray(
                              effective.required,
                            )
                              ? effective.required.filter(
                                  (r: string) => r !== propName,
                                )
                              : [];
                            const updatedEffective = {
                              ...effective,
                              properties: newProperties,
                              required: newRequired,
                            };
                            onChange(
                              updateEffectiveNode(node, updatedEffective),
                            );
                          }}
                          setDefsAccordionOpen={setDefsAccordionOpen}
                        />
                      )}
                    </div>
                  );
                })}
              {isEditable && (
                <div className="mt-2 ml-4 flex items-center gap-3 border-l border-border pl-4">
                  <Input
                    placeholder="New property name"
                    className="h-8 w-40"
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newPropName.trim()) {
                        const newProp = defaultSchemaForType("string");
                        newProp.title = formatTitle(newPropName);
                        const newProperties = {
                          ...(effective.properties || {}),
                          [newPropName]: newProp,
                        };
                        const newRequired = Array.isArray(effective.required)
                          ? [...effective.required, newPropName]
                          : [newPropName];
                        const updatedEffective = {
                          ...effective,
                          properties: newProperties,
                          required: newRequired,
                        };
                        onChange(updateEffectiveNode(node, updatedEffective));
                        setNewPropName("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!newPropName.trim()) return;
                      const newProp = defaultSchemaForType("string");
                      newProp.title = formatTitle(newPropName);
                      const newProperties = {
                        ...(effective.properties || {}),
                        [newPropName]: newProp,
                      };
                      const newRequired = Array.isArray(effective.required)
                        ? [...effective.required, newPropName]
                        : [newPropName];
                      const updatedEffective = {
                        ...effective,
                        properties: newProperties,
                        required: newRequired,
                      };
                      onChange(updateEffectiveNode(node, updatedEffective));
                      setNewPropName("");
                    }}
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Add</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {localType === "array" && (
        <div className="ml-4">
          <div className="ml-4 border-l border-border">
            {(() => {
              const items = getEffectiveNode(node).items;
              // Handle both single schema and array of schemas
              const validItems =
                items !== undefined &&
                !Array.isArray(items) &&
                isJSONSchema(items);

              return (
                validItems && (
                  <SchemaNodeEditor
                    draggedParentRef={draggedParentRef}
                    draggedPropertyRef={draggedPropertyRef}
                    editMode={editMode}
                    name="items"
                    nodeId={itemsNodeId}
                    node={items as ExtendedJSONSchema7}
                    onChange={(newItems) =>
                      onChange(
                        updateEffectiveNode(node, {
                          ...effective,
                          items: newItems,
                        }),
                      )
                    }
                    jsonSchema={jsonSchema}
                    setJsonSchema={setJsonSchema}
                    path={`${path}.items`}
                    defs={defs}
                    canDelete={false}
                    hidePencilButton
                    setDefsAccordionOpen={setDefsAccordionOpen}
                    // setSystemPromptDialogOpen={setSystemPromptDialogOpen}
                  />
                )
              );
            })()}
          </div>
        </div>
      )}

      {/* ------------------- Enum Editor UI ------------------- */}
      {localType === "enum" && (
        <div className="ml-6">
          {effective.enum && effective.enum.length > 0 ? (
            <ul className="mt-1 mb-2 flex flex-wrap gap-2">
              {effective.enum.map((val: any, index: number) => (
                <li
                  key={index}
                  className="flex items-center space-x-2 rounded-md border border-border bg-muted px-2 py-1"
                >
                  <Input
                    value={val}
                    ref={index === 0 ? firstEnumInputRef : undefined}
                    onChange={(e) => {
                      handleEditEnum(index, e.target.value);
                    }}
                    className="h-6 w-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="m-0 h-3 w-3 p-1"
                    size="icon"
                    onClick={() => handleRemoveEnum(index)}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mb-2 text-sm text-muted-foreground">
              No enum values defined.
            </div>
          )}

          <div className="flex items-center gap-3">
            <Input
              ref={newEnumInputRef}
              placeholder="New choice"
              className="h-8 w-40"
              value={newEnumValue}
              onChange={(e) => setNewEnumValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newEnumValue.trim()) {
                  handleAddEnum();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddEnum}
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add</span>
            </Button>
          </div>
        </div>
      )}

      {/* Metadata Dialog - only for non-root elements */}
      {path !== "#" && metadataDialogOpen ? (
        <NodeDialog
          isOpen={metadataDialogOpen}
          onClose={() => setMetadataDialogOpen(false)}
          validateName={validatePropertyName}
          onChange={onChange}
          onNameChange={onNameChange || (() => {})}
          onDelete={
            isEditable && canDelete
              ? () => {
                  if (onDelete) {
                    onDelete();
                    setMetadataDialogOpen(false);
                  }
                }
              : undefined
          }
          node={node}
          name={name}
          editMode={editMode}
          isRequired={isRequired}
          onRequiredChange={onRequiredChange}
        />
      ) : null}

      {/* Enum Creation Dialog */}
      <EnumCreationDialog
        isOpen={enumCreationDialogOpen}
        onClose={() => setEnumCreationDialogOpen(false)}
        onConfirm={handleEnumConfirm}
        onCancel={handleEnumCancel}
      />
    </div>
  );
}

/* ------------------- Definitions Editor ------------------- */
