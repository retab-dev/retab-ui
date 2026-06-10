"use client";

import * as React from "react";
import { useState } from "react";
import { JSONSchema7Definition } from "json-schema";
import {
  CloudUpload,
  Copy,
  Download,
  EllipsisVertical,
  Eye,
  GalleryVerticalEnd,
  MessageCircleOff,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui-retab/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-retab/dropdown-menu";
import { Input } from "@/components/ui-retab/input";
import { Textarea } from "@/components/ui-retab/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import { RootDialog } from "@/components/schema-editor/root-dialog";
import { TemplatesDialog } from "@/components/schema-editor/templates-dialog";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";

import { updateNodeWithMetadata } from "./json-schema-builder-utils";

type SchemaEditorMode = "promptOnly" | "readOnly" | "editable";

type TopLevelEditorProps = {
  onChange: (newNode: ExtendedJSONSchema7) => void | Promise<void>;
  setDisplayEvanescentButtons?: (display: boolean) => void;
  node: ExtendedJSONSchema7;
  editMode: SchemaEditorMode;
  setOpenLayoutDialog: (open: boolean) => void;
  showTemplatesButton?: boolean;
};

export function buildTopLevelMetadataValues(node: ExtendedJSONSchema7) {
  return {
    title: node.title || "",
    description: node.description || "",
    maxLength: node.maxLength || undefined,
  };
}

export function TopLevelEditor({
  onChange,
  setDisplayEvanescentButtons,
  node,
  editMode,
  setOpenLayoutDialog: _setOpenLayoutDialog,
  showTemplatesButton = false,
}: TopLevelEditorProps) {
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [metadataValues, setMetadataValues] = useState(() =>
    buildTopLevelMetadataValues(node),
  );
  const [editedName, setEditedName] = useState(node.title || "");
  const [isNameDirty, setIsNameDirty] = useState(false);
  const [editedDescription, setEditedDescription] = useState(
    node.description || "",
  );
  const [isDescriptionDirty, setIsDescriptionDirty] = useState(false);
  const [dialogPropertyName, setDialogPropertyName] = useState(
    node.title || "",
  );
  const effectiveEditedName = isNameDirty ? editedName : node.title || "";
  const effectiveEditedDescription = isDescriptionDirty
    ? editedDescription
    : node.description || "";

  const handleNameSubmit = () => {
    if (effectiveEditedName !== (node.title || "")) {
      const updatedMetadata = {
        ...buildTopLevelMetadataValues(node),
        title: effectiveEditedName || "",
      };
      onChange(updateNodeWithMetadata(node, updatedMetadata));
    }
    setIsNameDirty(false);
    setEditedName(node.title || "");
  };

  const handleDescriptionSubmit = () => {
    if (effectiveEditedDescription !== (node.description || "")) {
      const updatedMetadata = {
        ...buildTopLevelMetadataValues(node),
        description: effectiveEditedDescription,
      };
      onChange(updateNodeWithMetadata(node, updatedMetadata));
    }
    setIsDescriptionDirty(false);
    setEditedDescription(node.description || "");
  };

  const openMetadataDialog = () => {
    setMetadataValues(buildTopLevelMetadataValues(node));
    setDialogPropertyName(node.title || "");
    setMetadataDialogOpen(true);
  };

  const handleEraseAll = async () => {
    if (
      window.confirm(
        "Are you sure you want to erase the current schema? This action cannot be undone.",
      )
    ) {
      await onChange({
        title: "",
        type: "object",
        properties: {},
      });
    }
  };

  const stripFieldEverywhere = (
    schema: JSONSchema7Definition,
    field: "description",
  ): JSONSchema7Definition => {
    if (typeof schema !== "object" || schema === null) return schema;

    const cloned: Record<string, unknown> = { ...schema };

    if (field in cloned) delete cloned[field];

    if (cloned.properties && typeof cloned.properties === "object") {
      const newProps: Record<string, JSONSchema7Definition> = {};
      for (const key of Object.keys(cloned.properties)) {
        newProps[key] = stripFieldEverywhere(
          (cloned.properties as Record<string, JSONSchema7Definition>)[key],
          field,
        );
      }
      cloned.properties = newProps;
    }

    if (
      cloned.patternProperties &&
      typeof cloned.patternProperties === "object"
    ) {
      const newPatternProps: Record<string, JSONSchema7Definition> = {};
      for (const key of Object.keys(cloned.patternProperties)) {
        newPatternProps[key] = stripFieldEverywhere(
          (cloned.patternProperties as Record<string, JSONSchema7Definition>)[
            key
          ],
          field,
        );
      }
      cloned.patternProperties = newPatternProps;
    }

    if ("additionalProperties" in cloned) {
      const additionalProperties = cloned.additionalProperties;
      if (
        typeof additionalProperties === "object" &&
        additionalProperties !== null
      ) {
        cloned.additionalProperties = stripFieldEverywhere(
          additionalProperties as JSONSchema7Definition,
          field,
        );
      }
    }

    if ("items" in cloned && cloned.items) {
      if (Array.isArray(cloned.items)) {
        cloned.items = cloned.items.map((item) =>
          stripFieldEverywhere(item as JSONSchema7Definition, field),
        );
      } else if (typeof cloned.items === "object") {
        cloned.items = stripFieldEverywhere(
          cloned.items as JSONSchema7Definition,
          field,
        );
      }
    }

    const arrayCombinerKeys = ["anyOf", "oneOf", "allOf"] as const;
    for (const key of arrayCombinerKeys) {
      if (Array.isArray(cloned[key])) {
        cloned[key] = cloned[key].map((definition) =>
          stripFieldEverywhere(definition as JSONSchema7Definition, field),
        );
      }
    }

    if (cloned.not && typeof cloned.not === "object") {
      cloned.not = stripFieldEverywhere(
        cloned.not as JSONSchema7Definition,
        field,
      );
    }
    if (cloned.if && typeof cloned.if === "object") {
      cloned.if = stripFieldEverywhere(
        cloned.if as JSONSchema7Definition,
        field,
      );
    }
    if (cloned.then && typeof cloned.then === "object") {
      cloned.then = stripFieldEverywhere(
        cloned.then as JSONSchema7Definition,
        field,
      );
    }
    if (cloned.else && typeof cloned.else === "object") {
      cloned.else = stripFieldEverywhere(
        cloned.else as JSONSchema7Definition,
        field,
      );
    }
    if (cloned.propertyNames && typeof cloned.propertyNames === "object") {
      cloned.propertyNames = stripFieldEverywhere(
        cloned.propertyNames as JSONSchema7Definition,
        field,
      );
    }
    if (cloned.contains && typeof cloned.contains === "object") {
      cloned.contains = stripFieldEverywhere(
        cloned.contains as JSONSchema7Definition,
        field,
      );
    }

    if (
      cloned.dependentSchemas &&
      typeof cloned.dependentSchemas === "object"
    ) {
      const newDependentSchemas: Record<string, JSONSchema7Definition> = {};
      for (const key of Object.keys(cloned.dependentSchemas)) {
        newDependentSchemas[key] = stripFieldEverywhere(
          (cloned.dependentSchemas as Record<string, JSONSchema7Definition>)[
            key
          ],
          field,
        );
      }
      cloned.dependentSchemas = newDependentSchemas;
    }

    if (cloned.$defs && typeof cloned.$defs === "object") {
      const newDefs: Record<string, JSONSchema7Definition> = {};
      for (const key of Object.keys(cloned.$defs)) {
        newDefs[key] = stripFieldEverywhere(
          (cloned.$defs as Record<string, JSONSchema7Definition>)[key],
          field,
        );
      }
      cloned.$defs = newDefs;
    }

    if (cloned.definitions && typeof cloned.definitions === "object") {
      const newDefinitions: Record<string, JSONSchema7Definition> = {};
      for (const key of Object.keys(cloned.definitions)) {
        newDefinitions[key] = stripFieldEverywhere(
          (cloned.definitions as Record<string, JSONSchema7Definition>)[key],
          field,
        );
      }
      cloned.definitions = newDefinitions;
    }

    return cloned as JSONSchema7Definition;
  };

  const handleEraseAllDescriptions = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete all descriptions in this schema? This cannot be undone.",
      )
    ) {
      await onChange(
        stripFieldEverywhere(
          node as JSONSchema7Definition,
          "description",
        ) as ExtendedJSONSchema7,
      );
    }
  };

  const handleDownloadSchema = () => {
    try {
      const schemaBlob = new Blob([JSON.stringify(node, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(schemaBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = node.title
        ? `${node.title.toLowerCase().replace(/\s+/g, "-")}.json`
        : "schema.json";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Download Started", {
        description: "Your schema has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error downloading schema:", error);
      toast.error("Download Failed", {
        description: "There was an error downloading your schema.",
      });
    }
  };

  const handleUploadSchema = () => {
    try {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
      fileInput.style.display = "none";

      fileInput.addEventListener("change", (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const reader = new FileReader();

          reader.onload = async (loadEvent) => {
            try {
              const content = loadEvent.target?.result as string;
              await onChange(JSON.parse(content));
              toast.success("Schema Uploaded", {
                description:
                  "Your schema has been uploaded and applied successfully.",
              });
            } catch (error) {
              console.error("Error parsing uploaded schema:", error);
              toast.error("Upload Failed", {
                description: "The uploaded file is not a valid JSON schema.",
              });
            }
          };

          reader.readAsText(file);
        }

        document.body.removeChild(fileInput);
      });

      document.body.appendChild(fileInput);
      fileInput.click();
    } catch (error) {
      console.error("Error uploading schema:", error);
      toast.error("Upload Failed", {
        description: "There was an error uploading your schema.",
      });
    }
  };

  const handleCopy = () => {
    try {
      const formattedSchema = JSON.stringify(node, null, 2);
      navigator.clipboard
        .writeText(formattedSchema)
        .then(() => {
          toast.success("Copied to Clipboard", {
            description: "Your schema has been copied to the clipboard.",
          });
        })
        .catch((error) => {
          console.error("Error copying to clipboard:", error);
          const textArea = document.createElement("textarea");
          textArea.value = formattedSchema;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          try {
            document.execCommand("copy");
            textArea.remove();
            toast.success("Copied to Clipboard", {
              description: "Your schema has been copied to the clipboard.",
            });
          } catch (fallbackError) {
            console.error("Fallback: Oops, unable to copy", fallbackError);
            toast.error("Copy Failed", {
              description:
                "There was an error copying your schema to the clipboard.",
            });
            textArea.remove();
          }
        });
    } catch (error) {
      console.error("Error preparing schema for copy:", error);
      toast.error("Copy Failed", {
        description: "There was an error preparing your schema for copying.",
      });
    }
  };

  return (
    <div className="pb-4">
      <div className="group flex flex-col items-start justify-between pl-0 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center space-x-2">
          <Input
            className="m-0 h-5 rounded-none border-none p-0 text-lg font-medium text-foreground shadow-none outline-none focus-visible:ring-0 md:text-lg"
            value={effectiveEditedName}
            placeholder="Add a title to your schema"
            onChange={(event) => {
              setEditedName(event.target.value);
              setIsNameDirty(true);
            }}
            onBlur={handleNameSubmit}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleNameSubmit();
            }}
            onMouseEnter={() => setDisplayEvanescentButtons?.(true)}
            onMouseLeave={() => setDisplayEvanescentButtons?.(false)}
            autoFocus
            disabled={editMode === "readOnly" || editMode === "promptOnly"}
          />
        </div>

        <div className="flex items-center gap-2">
          {showTemplatesButton && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setTemplatesDialogOpen(true)}
            >
              <GalleryVerticalEnd className="mr-2 h-4 w-4" />
              Templates
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {editMode === "editable" && (
                <DropdownMenuItem onClick={handleEraseAll}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Schema
                </DropdownMenuItem>
              )}

              {(editMode === "editable" || editMode === "promptOnly") && (
                <DropdownMenuItem onClick={handleEraseAllDescriptions}>
                  <MessageCircleOff className="mr-2 h-4 w-4" />
                  Delete all descriptions
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handleDownloadSchema}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleUploadSchema}>
                <CloudUpload className="mr-2 h-4 w-4" />
                Upload
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy to clipboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="pb-2">
        <div className="flex items-start justify-between">
          <Textarea
            className="m-0 max-h-64 min-h-6 resize-none rounded-none border-none p-0 text-sm font-normal text-muted-foreground shadow-none outline-none focus-visible:ring-0 md:text-sm"
            value={effectiveEditedDescription}
            placeholder="Add a description to your schema"
            onChange={(event) => {
              setEditedDescription(event.target.value);
              setIsDescriptionDirty(true);
            }}
            onBlur={handleDescriptionSubmit}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                handleDescriptionSubmit();
              }
            }}
            onMouseEnter={() => setDisplayEvanescentButtons?.(true)}
            onMouseLeave={() => setDisplayEvanescentButtons?.(false)}
            autoFocus
            disabled={editMode === "readOnly"}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="m-0 p-0"
                onClick={openMetadataDialog}
              >
                {editMode === "readOnly" ? (
                  <Eye className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                ) : (
                  <Pencil className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                {editMode === "readOnly"
                  ? "View schema properties"
                  : "Edit schema properties"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <RootDialog
        isOpen={metadataDialogOpen}
        onClose={() => setMetadataDialogOpen(false)}
        path="#"
        schemaTitle={dialogPropertyName}
        setSchemaTitle={setDialogPropertyName}
        metadataValues={metadataValues}
        setMetadataValues={setMetadataValues}
        onChange={onChange}
        node={node}
        editMode={editMode}
      />

      <TemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
      />
    </div>
  );
}
