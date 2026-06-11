"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  addDefinition,
  isDefinitionReferenced,
  nodeFromJson,
  projectNode,
  removeDefinition,
  renameDefinition,
  replaceNodeJson,
  setNodeDescription,
  setNodeTitle,
  stripDescriptions,
  type SchemaDocument,
} from "@/components/schema-editor/document";
import { DocumentSchemaNodeEditor } from "@/components/schema-editor/document-schema-node-editor";
import { TopLevelEditor } from "@/components/schema-editor/json-schema-top-level-editor";
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import type {
  ResolvedSchemaBuilderFeatures,
  SchemaDispatch,
  SchemaValidationResult,
} from "@/components/schema-editor/schema-builder-types";
import { resolveSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types";
import { validationErrorsText } from "@/components/schema-editor/validation";
import { ValidationErrorDisplay } from "@/components/schema-editor/validation-error-display";
import { Button } from "@/components/ui-retab/button";
import { Input } from "@/components/ui-retab/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-retab/accordion";

type SchemaEditorMode = "descriptionOnly" | "readOnly" | "editable";

interface DocumentSchemaEditorProps {
  doc: SchemaDocument;
  schema: ExtendedJSONSchema7;
  validation: SchemaValidationResult;
  dispatch: SchemaDispatch;
  editMode?: SchemaEditorMode;
  features?: ResolvedSchemaBuilderFeatures;
}

export function DocumentSchemaEditor({
  doc,
  schema,
  validation,
  dispatch,
  editMode = "editable",
  features: featuresProp,
}: DocumentSchemaEditorProps) {
  const features = featuresProp ?? resolveSchemaBuilderFeatures();
  const [defsAccordionOpen, setDefsAccordionOpen] = React.useState(false);
  const draggedParentRef = React.useRef<string | null>(null);
  const draggedPropertyRef = React.useRef<string | null>(null);
  const validationErrors = React.useMemo(
    () => validationErrorsText(validation),
    [validation],
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
      <div className="group flex w-full flex-col">
        <ValidationErrorDisplay
          validationErrors={validationErrors}
          variant="full"
        />
        <TopLevelEditor
          node={schema}
          editMode={editMode}
          showImportExportActions={features.importExport}
          onTitleChange={(title) =>
            dispatch((current) => setNodeTitle(current, current.root.id, title))
          }
          onDescriptionChange={(description) =>
            dispatch((current) =>
              setNodeDescription(current, current.root.id, description)
            )
          }
          onEraseAll={() =>
            dispatch((current) =>
              replaceNodeJson(current, current.root.id, {
                title: "",
                type: "object",
                properties: {},
              })
            )
          }
          onEraseDescriptions={() =>
            dispatch((current) => stripDescriptions(current))
          }
          onReplaceRoot={(newNode) =>
            dispatch((current) =>
              replaceNodeJson(current, current.root.id, newNode)
            )
          }
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <DocumentSchemaNodeEditor
          applyDocOp={dispatch}
          doc={doc}
          name="root"
          nodeId={doc.root.id}
          node={schema}
          path="#"
          defs={schema.$defs || {}}
          editMode={editMode}
          features={features}
          canDelete={false}
          setDefsAccordionOpen={setDefsAccordionOpen}
          draggedParentRef={draggedParentRef}
          draggedPropertyRef={draggedPropertyRef}
        />
        <DocumentDefinitionsEditor
          dispatch={dispatch}
          doc={doc}
          schema={schema}
          editMode={editMode}
          definitionsEnabled={features.definitions}
          features={features}
          accordionOpen={defsAccordionOpen}
          setAccordionOpen={setDefsAccordionOpen}
          draggedParentRef={draggedParentRef}
          draggedPropertyRef={draggedPropertyRef}
        />
      </div>
    </div>
  );
}

function DocumentDefinitionsEditor({
  dispatch,
  doc,
  schema,
  editMode,
  definitionsEnabled,
  features,
  accordionOpen: _accordionOpen,
  setAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
}: {
  dispatch: SchemaDispatch;
  doc: SchemaDocument;
  schema: ExtendedJSONSchema7;
  editMode: SchemaEditorMode;
  definitionsEnabled: boolean;
  features: ResolvedSchemaBuilderFeatures;
  accordionOpen: boolean;
  setAccordionOpen: (open: boolean) => void;
  draggedParentRef: React.RefObject<string | null>;
  draggedPropertyRef: React.RefObject<string | null>;
}) {
  const [newDefName, setNewDefName] = React.useState("");
  const [showAccordion, setShowAccordion] = React.useState(false);
  const isEditable = editMode === "editable";

  const handleAddDef = () => {
    if (!newDefName.trim()) return;
    dispatch(
      (current) =>
        addDefinition(current, {
          name: newDefName,
          node: nodeFromJson({ type: "object", properties: {}, required: [] }, current),
        }).doc,
    );
    setNewDefName("");
  };

  const handleDeleteDef = (defId: string, defName: string) => {
    if (isDefinitionReferenced(doc, defId, { exceptDefId: defId })) {
      toast.error(
        `Cannot delete "${defName}" because it is referenced by one or more $ref properties. Remove or update those references first.`,
      );
      return;
    }
    dispatch((current) => removeDefinition(current, defId));
    if (doc.defs.length <= 1) {
      setShowAccordion(false);
    }
  };

  if (doc.defs.length === 0 && (!showAccordion || !definitionsEnabled)) {
    return editMode === "descriptionOnly" ? null : (
      <div className="mt-6 flex pb-4">
        <div className="rounded-md" id="definitions-section">
          {definitionsEnabled ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAccordion(true);
                setAccordionOpen(true);
              }}
              className="rounded-md bg-transparent transition-colors duration-300"
            >
              Add definition
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Accordion
      className="mt-6 w-full rounded-lg border border-border px-4 pb-0 shadow-sm"
      type="single"
      collapsible={false}
      value="defs"
    >
      <AccordionItem value="defs" className="border-none bg-transparent">
        <AccordionTrigger className="bg-transparent font-medium text-muted-foreground">
          <div className="flex items-center">Definitions ({doc.defs.length})</div>
        </AccordionTrigger>
        <AccordionContent className="bg-transparent pt-2">
          <div className="space-y-4">
            {doc.defs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Create reusable schema components to avoid duplication with a
                new definition.
              </p>
            )}
            {doc.defs.map((definition) => {
              const projected = projectNode(doc, definition.node);
              const node =
                typeof projected === "object" && projected !== null
                  ? (projected as ExtendedJSONSchema7)
                  : ({} as ExtendedJSONSchema7);

              return (
                <div
                  key={definition.id}
                  className="py-2"
                  id={`def-${definition.name}`}
                >
                  <DocumentSchemaNodeEditor
                    applyDocOp={dispatch}
                    doc={doc}
                    draggedParentRef={draggedParentRef}
                    draggedPropertyRef={draggedPropertyRef}
                    editMode={definitionsEnabled ? editMode : "readOnly"}
                    features={features}
                    name={definition.name}
                    nodeId={definition.node.id}
                    node={node}
                    onNameChange={(newName, updatedDef) => {
                      if (newName !== definition.name) {
                        dispatch((current) => {
                          let next = renameDefinition(
                            current,
                            definition.id,
                            newName,
                          );
                          if (updatedDef) {
                            next = replaceNodeJson(
                              next,
                              definition.node.id,
                              updatedDef,
                            );
                          }
                          return next;
                        });
                      }
                    }}
                    path={`#/$defs/${definition.name}`}
                    defs={schema.$defs || {}}
                    canDelete={
                      !isDefinitionReferenced(doc, definition.id, {
                        exceptDefId: definition.id,
                      })
                    }
                    onDelete={() =>
                      handleDeleteDef(definition.id, definition.name)
                    }
                    setDefsAccordionOpen={setAccordionOpen}
                  />
                </div>
              );
            })}
            {isEditable && definitionsEnabled && (
              <div className="flex items-center gap-3">
                <Input
                  placeholder="New definition name"
                  className="w-40"
                  value={newDefName}
                  onChange={(event) => setNewDefName(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddDef}
                  className="p-1!"
                >
                  Add Definition
                </Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
