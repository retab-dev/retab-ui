"use client";

import { useState } from "react";
import { Button } from "@/components/ui-retab/button";
import { Input } from "@/components/ui-retab/input";
import { Label } from "@/components/ui-retab/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuSubContent } from "@/components/ui-retab/dropdown-menu";
import { ChevronDown, PlusIcon, X, Type, List, Shapes } from "lucide-react";
import { useJsonSchema } from "@/components/schema-editor/contexts/json-schema";
import { updateType, getEffectiveType, updateEffectiveNode } from "@/components/schema-editor/json-schema-builder";
import { SchemaNodeEditor } from "@/components/schema-editor/json-schema-node-editor";
import { CreateDefinitionDialog } from "@/components/schema-editor/create-definition-dialog";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { templateObjects } from "@/components/schema-editor/template-objects";
import { getTypeIcon, getTemplateIcon } from "@/components/schema-editor/type-icons";

// Modify the ItemTypeSelector component to use SchemaNodeEditor for arrays
export function ItemTypeSelector({
  name: _name,
  value,
  onChange,
  setJsonSchema,
  label = "Type",
  isRoot = false,
  editMode = "editable",
  setDialogMode,
  disabled = false,
  focusPath: _focusPath,
}: {
  name: string;
  value: ExtendedJSONSchema7;
  onChange: (updated: ExtendedJSONSchema7) => void;
  setJsonSchema: (schema: ExtendedJSONSchema7) => void;
  label?: string;
  isRoot?: boolean;
  editMode?: "promptOnly" | "readOnly" | "editable";
  setDialogMode: (mode: "object-editor" | "array-editor") => void;
  disabled?: boolean;
  focusPath?: string;
}) {
  const { jsonSchema } = useJsonSchema();
  const [createDefinitionOpen, setCreateDefinitionOpen] = useState(false);

  // Store the item editor state
  const [, setEditingItems] = useState<ExtendedJSONSchema7 | null>(null);

  const effectiveType = getEffectiveType(value);

  // Handle definition creation
  const handleDefinitionCreated = (definitionName: string) => {
    onChange(
      updateEffectiveNode(value, {
        $ref: `#/$defs/${definitionName}`,
      }),
    );
  };

  return (
    <div className={isRoot ? "" : "mt-3 rounded-md bg-muted p-3"}>
      <CreateDefinitionDialog
        open={createDefinitionOpen}
        onOpenChange={setCreateDefinitionOpen}
        onDefinitionCreated={handleDefinitionCreated}
      />

      {!isRoot && (
        <Label className="mb-2 block text-sm font-medium text-foreground">
          {label}
        </Label>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={disabled}
            variant="outline"
            className={`mt-2 w-full justify-between ${disabled ? "disabled:opacity-100" : ""}`}
          >
            <div className="flex items-center gap-2">
              {getTypeIcon(effectiveType.type)}
              <span>
                {(() => {
                  if (effectiveType.type === "$ref") {
                    const direct = (value as any).$ref as string | undefined;
                    const fromAnyOf = Array.isArray((value as any).anyOf)
                      ? (
                          (value as any).anyOf.find(
                            (b: any) => typeof b === "object" && b.$ref,
                          ) as any
                        )?.$ref
                      : undefined;
                    const ref = direct || fromAnyOf;
                    return ref ? ref.replace("#/$defs/", "") : "$ref";
                  }
                  if (effectiveType.type === "date") return "date";
                  if (effectiveType.type === "time") return "time";
                  if (effectiveType.type === "datetime") return "timestamp";
                  if (effectiveType.type === "boolean") return "true/false";
                  if (effectiveType.type === "enum") return "multiple choice";
                  if (effectiveType.type === "array") return "list";
                  return effectiveType.type;
                })()}
              </span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full">
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("string", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("string")}
              <span>string</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("number", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("number")}
              <span>number</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("boolean", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("boolean")}
              <span>true/false</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => {
              const updated = updateType(
                "enum",
                effectiveType.isNullable,
                value,
              );
              onChange({
                ...updated,
                enum: value.enum || [],
              });
            }}
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("enum")}
              <span>multiple choice</span>
            </div>
          </DropdownMenuItem>

          {/* Add new date/time formats */}
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("date", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("date")}
              <span>date</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("time", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("time")}
              <span>time</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("datetime", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("datetime")}
              <span>timestamp</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("array", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("array")}
              <span>list</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={disabled}
            onSelect={() =>
              onChange(updateType("object", effectiveType.isNullable, value))
            }
          >
            <div className="flex items-center gap-2">
              {getTypeIcon("object")}
              <span>object</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <div className="flex items-center gap-2">
                {getTypeIcon("$ref")}
                <span>definition</span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {Object.keys(jsonSchema.$defs || {}).length > 0 ? (
                  <>
                    {Object.keys(jsonSchema.$defs || {}).map((defKey) => (
                      <DropdownMenuItem
                        key={defKey}
                        onSelect={() => {
                          onChange(
                            updateEffectiveNode(value, {
                              $ref: `#/$defs/${defKey}`,
                            }),
                          );
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {getTemplateIcon(defKey)}
                          <span>{defKey}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  disabled={disabled}
                  onSelect={() => {
                    setTimeout(() => {
                      setCreateDefinitionOpen(true);
                    }, 100);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <PlusIcon className="h-4 w-4" />
                    <span>Create new definition</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <div className="flex items-center gap-2">
                <Shapes className="h-4 w-4" />
                <span>object template</span>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {Object.entries(templateObjects).map(([name, object]) => (
                  <DropdownMenuItem
                    key={name}
                    onSelect={() => {
                      let toAdd = [name];
                      if (object.deps) toAdd.push(...object.deps);

                      let newDefs = { ...(jsonSchema.$defs || {}) };
                      for (const defName of toAdd) {
                        if (!newDefs[defName]) {
                          newDefs[defName] = templateObjects[defName];
                        }
                      }
                      setJsonSchema({
                        ...jsonSchema,
                        $defs: newDefs,
                      });
                      onChange(
                        updateEffectiveNode(value, {
                          $ref: `#/$defs/${name}`,
                        }),
                      );
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {getTemplateIcon(name)}
                      <span>{name}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* For object types, use SchemaNodeEditor in a dialog */}
      {effectiveType.type === "object" &&
        !value.$ref &&
        editMode !== "readOnly" && (
          <div className="mt-3 text-sm">
            <Button
              disabled={disabled}
              variant="secondary"
              className="w-full"
              onClick={() => {
                setDialogMode("object-editor");
              }}
            >
              Edit Object Properties
            </Button>
          </div>
        )}

      {/* For array types, use SchemaNodeEditor in a dialog */}
      {effectiveType.type === "array" && (
        <div className="mt-3 text-sm">
          <Button
            disabled={disabled}
            variant="secondary"
            className="w-full"
            onClick={() => {
              setEditingItems(
                (value.items as ExtendedJSONSchema7) || { type: "string" },
              );
              setDialogMode("array-editor");
            }}
          >
            Edit List Items
          </Button>
        </div>
      )}

      {/* Multiple choice options - keep as before */}
      {(() => {
        const effective =
          value.anyOf && Array.isArray(value.anyOf)
            ? (value.anyOf.find(
                (b: any) =>
                  typeof b === "object" &&
                  (b.type !== "null" || b.$ref || b.enum),
              ) as any) || value
            : value;
        return Array.isArray((effective as any).enum);
      })() && (
        <div className="mt-3">
          <Label className="mb-2 block text-sm font-medium text-foreground">
            Enabled options
          </Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {(value.anyOf && Array.isArray(value.anyOf)
              ? (
                  value.anyOf.find(
                    (b: any) =>
                      typeof b === "object" &&
                      (b.type !== "null" || b.$ref || b.enum),
                  ) as any
                )?.enum || []
              : value.enum || []
            ).map((enumValue: any, index: number) => (
              <div
                key={index}
                className="flex items-center space-x-2 rounded-md border border-border bg-muted px-2 py-1"
              >
                <Input
                  disabled={disabled}
                  value={
                    typeof enumValue === "string"
                      ? enumValue
                      : String(enumValue)
                  }
                  onChange={(e) => {
                    const base =
                      value.anyOf && Array.isArray(value.anyOf)
                        ? (value.anyOf.find(
                            (b: any) =>
                              typeof b === "object" &&
                              (b.type !== "null" || b.$ref || b.enum),
                          ) as any) || {}
                        : value;
                    const newEnum = [...(((base as any).enum as any[]) || [])];
                    newEnum[index] = e.target.value;
                    const updatedEffective = {
                      ...base,
                      enum: newEnum.filter((v) => v && v !== ""),
                    } as any;
                    const updatedFull = updateEffectiveNode(
                      value as any,
                      updatedEffective,
                    );
                    onChange(updatedFull as any);
                  }}
                  className="h-6 w-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  type="button"
                  disabled={disabled}
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0"
                  onClick={() => {
                    const base =
                      value.anyOf && Array.isArray(value.anyOf)
                        ? (value.anyOf.find(
                            (b: any) =>
                              typeof b === "object" &&
                              (b.type !== "null" || b.$ref || b.enum),
                          ) as any) || {}
                        : value;
                    const newEnum = [...(((base as any).enum as any[]) || [])];
                    newEnum.splice(index, 1);
                    const updatedEffective = {
                      ...base,
                      enum: newEnum,
                    } as any;
                    const updatedFull = updateEffectiveNode(
                      value as any,
                      updatedEffective,
                    );
                    onChange(updatedFull as any);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              disabled={disabled}
              placeholder="Add new value"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value) {
                  const base =
                    value.anyOf && Array.isArray(value.anyOf)
                      ? (value.anyOf.find(
                          (b: any) =>
                            typeof b === "object" &&
                            (b.type !== "null" || b.$ref || b.enum),
                        ) as any) || {}
                      : value;
                  const updatedEffective = {
                    ...base,
                    enum: [
                      ...(((base as any).enum as any[]) || []),
                      e.currentTarget.value,
                    ],
                  } as any;
                  const updatedFull = updateEffectiveNode(
                    value as any,
                    updatedEffective,
                  );
                  onChange(updatedFull as any);
                  e.currentTarget.value = "";
                }
              }}
              className="w-40"
            />
            <Button
              disabled={disabled}
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                const input = e.currentTarget
                  .previousElementSibling as HTMLInputElement;
                if (input.value) {
                  const base =
                    value.anyOf && Array.isArray(value.anyOf)
                      ? (value.anyOf.find(
                          (b: any) =>
                            typeof b === "object" &&
                            (b.type !== "null" || b.$ref || b.enum),
                        ) as any) || {}
                      : value;
                  const updatedEffective = {
                    ...base,
                    enum: [
                      ...(((base as any).enum as any[]) || []),
                      input.value,
                    ],
                  } as any;
                  const updatedFull = updateEffectiveNode(
                    value as any,
                    updatedEffective,
                  );
                  onChange(updatedFull as any);
                  input.value = "";
                }
              }}
            >
              <PlusIcon className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
