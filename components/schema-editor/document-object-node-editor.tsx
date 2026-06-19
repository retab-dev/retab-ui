"use client";

import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types";
import { useDocumentObjectNodeEditorController } from "@/components/schema-editor/document-object-node-editor-controller";
import { DocumentPropertyAddRow } from "@/components/schema-editor/document-property-add-row";
import { DocumentPropertyRow } from "@/components/schema-editor/document-property-row";
import type { SchemaDocument } from "@/components/schema-editor/document/types";
import type {
  DocumentNodeView,
  DocumentPropertyView,
} from "@/components/schema-editor/document/view-model";
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types";

interface DocumentObjectNodeEditorProps {
  dispatch: DocumentSchemaNodeEditorProps["dispatch"];
  doc: SchemaDocument;
  nodeId: string;
  nodeView: DocumentNodeView;
  path: string;
  setDefsAccordionOpen: (open: boolean) => void;
  draggedParentRef: DocumentSchemaNodeEditorProps["draggedParentRef"];
  draggedPropertyRef: DocumentSchemaNodeEditorProps["draggedPropertyRef"];
  mode: SchemaEditorMode;
  features: ResolvedSchemaBuilderFeatures;
  renderNode: RenderDocumentNodeEditor;
}

export function DocumentObjectNodeEditor({
  dispatch,
  doc,
  nodeId,
  nodeView,
  path,
  setDefsAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
  mode,
  features,
  renderNode,
}: DocumentObjectNodeEditorProps) {
  const editable = mode === "editable";
  const objectNodeId = nodeView.effectiveNode.id ?? nodeId;
  const properties = nodeView.properties;
  const controller = useDocumentObjectNodeEditorController({
    dispatch,
    objectNodeId,
    properties,
    draggedPropertyRef,
  });

  const renderProperty = (
    property: DocumentPropertyView,
    rootLayout: boolean,
  ) => {
    return (
      <DocumentPropertyRow
        key={property.propertyId}
        propertyId={property.propertyId}
        dispatch={dispatch}
        doc={doc}
        propertyName={property.propertyName}
        nodeView={property.nodeView}
        rootLayout={rootLayout}
        path={path}
        setDefsAccordionOpen={setDefsAccordionOpen}
        draggedParentRef={draggedParentRef}
        draggedPropertyRef={draggedPropertyRef}
        mode={mode}
        features={features}
        editable={editable}
        isRequired={property.isRequired}
        siblingNames={controller.propertyNames}
        renderNode={renderNode}
        onRequiredChange={(required) =>
          controller.setPropertyRequired(property, required)
        }
        onNameChange={(newName, updatedNode) =>
          controller.updateProperty(property, newName, updatedNode)
        }
        onDelete={() => controller.deleteProperty(property)}
        onDragStart={(event) => controller.startDrag(event, property)}
        onDragOver={(event) => controller.dragOver(event, property)}
        onDragLeave={controller.leaveDragTarget}
        onDrop={(event) => controller.drop(event, property)}
      />
    );
  };

  const addPropertyControl = (rootLayout: boolean) =>
    editable ? (
      <DocumentPropertyAddRow
        rootLayout={rootLayout}
        siblingNames={controller.propertyNames}
        onAddProperty={controller.addNewProperty}
      />
    ) : null;

  if (path === "#") {
    return (
      <div>
        <Accordion
          type="single"
          collapsible
          defaultValue="properties"
          className="border-border w-full rounded-lg border px-4 pb-0"
        >
          <AccordionItem value="properties" className="border-none">
            <AccordionTrigger className="text-muted-foreground text-sm font-medium">
              Properties ({properties.length})
            </AccordionTrigger>
            <AccordionContent className="px-1 pt-2">
              <div>
                {properties.length === 0 && (
                  <p className="text-muted-foreground py-2 text-sm">
                    Define the data structure for this object.
                  </p>
                )}
                {properties.map((property) => renderProperty(property, true))}
                {addPropertyControl(true)}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  return (
    <div className="pl-2">
      <div>
        {properties.map((property) => renderProperty(property, false))}
        {addPropertyControl(false)}
      </div>
    </div>
  );
}
