"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui-retab/button";
import { Input } from "@/components/ui-retab/input";
import { Label } from "@/components/ui-retab/label";
import { Checkbox } from "@/components/ui-retab/checkbox";
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
  Download,
  CloudUpload,
  EllipsisVertical,
  MapPin,
  DollarSign,
  User,
  Building2,
  CalendarDays,
  MessageCircleOff,
  GalleryVerticalEnd,
  Eye,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui-retab/accordion";
import { useJsonSchema } from "@/components/schema-editor/contexts/json-schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import { Textarea } from "@/components/ui-retab/textarea";
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
import { JSONSchema7Definition } from "json-schema";
import { templateObjects } from "./template-objects";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import {
  getEffectiveNode,
  validateName,
} from "@/components/schema-editor/lib/json-schema-utils";
import { toast } from "sonner";
import { ValidationErrorDisplay } from "./validation-error-display";
import { TopLevelEditor } from "./json-schema-top-level-editor";
import { SchemaNodeEditor } from "./json-schema-node-editor";
import {
  defaultSchemaForType,
  formatTitle,
  getEffectiveType,
  renamePropertyAtPath,
  setNullable,
  updateEffectiveNode,
  updateNodeWithMetadata,
  updateSchemaProperty,
  updateType,
} from "./json-schema-builder-utils";

export {
  defaultSchemaForType,
  formatTitle,
  getEffectiveType,
  renamePropertyAtPath,
  setNullable,
  updateEffectiveNode,
  updateNodeWithMetadata,
  updateSchemaProperty,
  updateType,
} from "./json-schema-builder-utils";

function DefsEditor({
  schema,
  onChange,
  accordionOpen: _accordionOpen,
  setAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
  editMode = "editable",
}: {
  schema: any;
  onChange: (newSchema: any) => void;
  accordionOpen: boolean;
  setAccordionOpen: (open: boolean) => void;
  draggedParentRef: React.RefObject<string | null>;
  draggedPropertyRef: React.RefObject<string | null>;
  editMode?: "promptOnly" | "readOnly" | "editable";
}) {
  const defs = schema.$defs || {};
  const [newDefName, setNewDefName] = useState("");
  const [showAccordion, setShowAccordion] = useState(false);
  const isEditable = editMode === "editable";

  const handleAddDef = () => {
    if (!newDefName.trim()) return;
    const newDefs = {
      ...defs,
      [newDefName]: { type: "object", properties: {}, required: [] },
    };
    onChange({ ...schema, $defs: newDefs });
    setNewDefName("");
  };

  // Returns true if the given def is referenced by any $ref outside of its own definition
  const isDefReferenced = (targetName: string): boolean => {
    const targetRef = `#/$defs/${targetName}`;

    const traverse = (node: any): boolean => {
      if (node === null || typeof node !== "object") return false;

      if (Array.isArray(node)) {
        for (const item of node) {
          if (traverse(item)) return true;
        }
        return false;
      }

      if ((node as any).$ref === targetRef) return true;

      // Special handling at the schema root: iterate $defs entries but skip the target def subtree
      if (
        node === schema &&
        (schema as any).$defs &&
        typeof (schema as any).$defs === "object"
      ) {
        for (const [name, defSchema] of Object.entries((schema as any).$defs)) {
          if (name === targetName) continue;
          if (traverse(defSchema)) return true;
        }
        // Continue traversing the rest of the schema excluding $defs
        const { $defs: _omit, ...rest } = schema as any;
        return traverse(rest);
      }

      for (const key of Object.keys(node)) {
        if (key === "$defs") continue;
        if (traverse((node as any)[key])) return true;
      }
      return false;
    };

    return traverse(schema);
  };

  const handleDeleteDef = (defName: string) => {
    if (isDefReferenced(defName)) {
      toast.error(
        `Cannot delete "${defName}" because it is referenced by one or more $ref properties. Remove or update those references first.`,
      );
      return;
    }
    const newDefs = { ...defs };
    delete newDefs[defName];
    onChange({ ...schema, $defs: newDefs });
    if (Object.keys(newDefs).length === 0) {
      setShowAccordion(false);
    }
  };

  // If there are no definitions and accordion isn't shown, show just a button
  if (Object.keys(defs).length === 0 && !showAccordion) {
    return editMode === "promptOnly" ? null : (
      <div className="mt-6 flex pb-4">
        <div className="rounded-md" id="definitions-section">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowAccordion(true);
              setAccordionOpen(true);
            }}
            className="rounded-md bg-transparent transition-colors duration-300"
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add definition
          </Button>
        </div>
      </div>
    );
  }

  // Otherwise show the full accordion
  return (
    <Accordion
      className="mt-6 w-full rounded-lg border border-border px-4 pb-0 shadow-sm"
      type="single"
      collapsible={false}
      value="defs"
      //value={accordionOpen ? "defs" : ""}
      //onValueChange={(value) => setAccordionOpen(!!value && value === "defs")}
    >
      <AccordionItem value="defs" className="border-none bg-transparent">
        <AccordionTrigger className="bg-transparent font-medium text-muted-foreground">
          <div className="flex items-center">
            Definitions ({Object.keys(defs).length})
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-transparent pt-2">
          <div className="space-y-4">
            {Object.keys(defs).length === 0 && (
              <p className="text-muted-foreground text-sm">
                Create reusable schema components to avoid duplication with a
                new definition.
              </p>
            )}
            {Object.entries(defs).map(([defName, defSchema]: [string, any]) => (
              <div key={defName} className="py-2" id={`def-${defName}`}>
                <SchemaNodeEditor
                  draggedParentRef={draggedParentRef}
                  draggedPropertyRef={draggedPropertyRef}
                  editMode={editMode}
                  name={defName}
                  node={defSchema}
                  onChange={(newDef) => {
                    const newDefs = { ...defs, [defName]: newDef };
                    onChange({ ...schema, $defs: newDefs });
                  }}
                  onNameChange={(newName, updatedDef) => {
                    if (newName !== defName) {
                      // Create new defs object with renamed definition
                      const newDefs = { ...defs };
                      newDefs[newName] = updatedDef || defSchema;
                      delete newDefs[defName];

                      // Update all $ref references in the schema
                      const updateRefs = (obj: any): any => {
                        if (typeof obj !== "object" || obj === null) return obj;
                        if (Array.isArray(obj)) return obj.map(updateRefs);

                        const updated = { ...obj };
                        if (updated.$ref === `#/$defs/${defName}`) {
                          updated.$ref = `#/$defs/${newName}`;
                        }

                        // Recursively update nested objects
                        Object.keys(updated).forEach((key) => {
                          if (key !== "$ref") {
                            updated[key] = updateRefs(updated[key]);
                          }
                        });

                        return updated;
                      };

                      const updatedSchema = updateRefs({
                        ...schema,
                        $defs: newDefs,
                      });
                      onChange(updatedSchema);
                    }
                  }}
                  jsonSchema={schema}
                  setJsonSchema={onChange}
                  path={`#/$defs/${defName}`}
                  defs={defs}
                  canDelete={!isDefReferenced(defName)}
                  onDelete={() => handleDeleteDef(defName)}
                  setDefsAccordionOpen={setAccordionOpen}
                />
              </div>
            ))}
            {isEditable && (
              <div className="flex items-center gap-3">
                <Input
                  placeholder="New definition name"
                  className="w-40"
                  value={newDefName}
                  onChange={(e) => setNewDefName(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddDef}
                  className="p-1!"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span className="ml-1">Add Definition</span>
                </Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/* ------------------- Main JSON Schema Editor ------------------- */

function JsonSchemaEditorRaw({
  fullCodeModeState,
  showTemplatesButton = false,
  editMode = "editable",
}: {
  fullCodeModeState?: [boolean, (value: boolean) => void];
  showTemplatesButton?: boolean;
  editMode?: "promptOnly" | "readOnly" | "editable";
}) {
  const [internalFullCodeMode, setInternalFullCodeMode] = useState(false);

  // Use either the external state or internal state
  const [fullCodeMode, _setFullCodeMode] = fullCodeModeState || [
    internalFullCodeMode,
    setInternalFullCodeMode,
  ];

  const {
    jsonSchema: schema,
    setJsonSchema: setSchema,
    validationErrors,
  } = useJsonSchema();
  const [defsAccordionOpen, setDefsAccordionOpen] = useState(false);
  const [, setOpenLayoutDialog] = React.useState(false);
  const draggedParentRef = React.useRef<string | null>(null);
  const draggedPropertyRef = React.useRef<string | null>(null);

  const handleDefsAccordionChange = (open: boolean) => {
    setDefsAccordionOpen(open);
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
      {/* Topbar */}
      <div
        className={`group flex w-full flex-col ${fullCodeMode ? "h-full" : ""}`}
      >
        {/* Schema Editor Content */}
        <ValidationErrorDisplay
          validationErrors={validationErrors}
          variant="full"
        />

        {/* Top Level Editor */}
        {fullCodeMode ? (
          <textarea
            spellCheck={false}
            className="h-full min-h-0 flex-1 resize-none overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={JSON.stringify(schema, null, 2)}
            onChange={async (e) => {
              try {
                const newSchema = JSON.parse(e.target.value || "");
                await setSchema(newSchema);
              } catch {
                // Ignore invalid JSON while the user is typing.
              }
            }}
          />
        ) : (
          <TopLevelEditor
            onChange={setSchema}
            node={schema}
            editMode={editMode}
            setOpenLayoutDialog={setOpenLayoutDialog}
            showTemplatesButton={showTemplatesButton}
          />
        )}
      </div>

      {!fullCodeMode && (
        <div className="flex min-h-0 flex-1 flex-col pb-20">
          <SchemaNodeEditor
            name="root"
            node={schema}
            onChange={setSchema}
            jsonSchema={schema}
            setJsonSchema={setSchema}
            path="#"
            defs={schema.$defs || {}}
            editMode={editMode}
            canDelete={false}
            setDefsAccordionOpen={handleDefsAccordionChange}
            draggedParentRef={draggedParentRef}
            draggedPropertyRef={draggedPropertyRef}
          />
          <DefsEditor
            editMode={editMode}
            schema={schema}
            onChange={setSchema}
            accordionOpen={defsAccordionOpen}
            setAccordionOpen={handleDefsAccordionChange}
            draggedParentRef={draggedParentRef}
            draggedPropertyRef={draggedPropertyRef}
          />
        </div>
      )}
    </div>
  );
}

export const JsonSchemaEditor = React.memo(JsonSchemaEditorRaw);
