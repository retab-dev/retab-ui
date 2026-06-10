"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { JSONSchema7 } from "json-schema";
import { Button } from "@/components/ui-retab/button";
import { Input } from "@/components/ui-retab/input";
import { Label } from "@/components/ui-retab/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui-retab/dialog";
import { PlusIcon, AlertCircle } from "lucide-react";
import { useJsonSchema } from "@/components/schema-editor/contexts/json-schema";
import { SchemaNodeEditor } from "@/components/schema-editor/json-schema-node-editor";
import { validateName } from "@/components/schema-editor/lib/json-schema-utils";
import { ResetOnMountRunner } from "@/components/schema-editor/reset-on-mount-runner";

export function CreateDefinitionDialog({
  open,
  onOpenChange,
  onDefinitionCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDefinitionCreated: (definitionName: string) => void;
}) {
  const { jsonSchema, setJsonSchema } = useJsonSchema();
  const [newDefName, setNewDefName] = useState("");
  const [defSchema, setDefSchema] = useState<JSONSchema7>({
    type: "object",
    properties: {},
    required: [],
  });
  const [nameError, setNameError] = useState<string | null>(null);

  // Validate the definition name against constraints
  const validateDefName = (name: string): string | null => {
    const defsList = Object.keys(jsonSchema.$defs || {});
    return validateName(name, defsList, undefined, "definition");
  };

  const handleNameChange = (updatedName: string) => {
    setNewDefName(updatedName);
    setNameError(validateDefName(updatedName));
  };

  const handleAddDef = () => {
    if (!newDefName.trim()) return;

    // Validate name before creating
    const validationError = validateDefName(newDefName);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    // Create a new definition in the schema
    const newSchema = { ...jsonSchema };

    // Initialize $defs if it doesn't exist
    if (!newSchema.$defs) {
      newSchema.$defs = {};
    }

    // Add the new definition
    newSchema.$defs[newDefName] = defSchema;

    // Update the schema
    setJsonSchema(newSchema);

    // Notify parent component
    onDefinitionCreated(newDefName);

    // Close dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ResetOnMountRunner
          key="create-definition-dialog-reset"
          onReset={() => {
            setNewDefName("");
            setDefSchema({
              type: "object",
              properties: {},
              required: [],
            });
            setNameError(null);
          }}
        />
      ) : null}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Definition</DialogTitle>
          <DialogDescription>
            Create a reusable definition that can be referenced in multiple
            places.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="defName">
            Definition Name<span className="ml-0.5 text-destructive">*</span>
          </Label>
          <Input
            id="defName"
            value={newDefName}
            onChange={(e) => handleNameChange(e.target.value)}
            className={nameError ? "border-destructive" : undefined}
            placeholder="e.g. person_address or personAddress"
          />
          {nameError && (
            <p className="flex items-center gap-1 text-sm font-medium text-destructive">
              <AlertCircle className="h-3 w-3" />
              {nameError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Must start with a letter or underscore, contain only letters,
            digits, or underscores, and be at most 64 characters.
          </p>
        </div>

        <SchemaNodeEditor
          name={newDefName || "Click to set definition name"}
          node={defSchema}
          onChange={setDefSchema}
          jsonSchema={jsonSchema}
          setJsonSchema={setJsonSchema}
          path="#/definition"
          defs={jsonSchema.$defs || {}}
          canDelete={false}
          setDefsAccordionOpen={() => {}}
          onNameChange={(updatedName) => handleNameChange(updatedName)}
          draggedParentRef={React.useRef(null)}
          draggedPropertyRef={React.useRef(null)}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddDef}
            disabled={!newDefName.trim() || !!nameError}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Definition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
