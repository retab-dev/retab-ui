"use client"

import * as React from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import { useDocumentObjectNodeEditorController } from "@/components/schema-editor/document-object-node-editor-controller"
import { DocumentPropertyAddRow } from "@/components/schema-editor/document-property-add-row"
import { DocumentPropertyRow } from "@/components/schema-editor/document-property-row"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type {
  DocumentNodeView,
  DocumentPropertyView,
} from "@/components/schema-editor/document/view-model"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

interface DocumentObjectNodeEditorProps {
  dispatch: DocumentSchemaNodeEditorProps["dispatch"]
  doc: SchemaDocument
  nodeId: string
  nodeView: DocumentNodeView
  path: string
  setDefsAccordionOpen: (open: boolean) => void
  draggedParentRef: DocumentSchemaNodeEditorProps["draggedParentRef"]
  draggedPropertyRef: DocumentSchemaNodeEditorProps["draggedPropertyRef"]
  editMode: SchemaEditorMode
  features: ResolvedSchemaBuilderFeatures
  renderNode: RenderDocumentNodeEditor
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
  editMode,
  features,
  renderNode,
}: DocumentObjectNodeEditorProps) {
  const isEditable = editMode === "editable"
  const objectNodeId = nodeView.effectiveNode.id ?? nodeId
  const properties = nodeView.properties
  const controller = useDocumentObjectNodeEditorController({
    dispatch,
    objectNodeId,
    path,
    properties,
    draggedParentRef,
    draggedPropertyRef,
  })

  const renderProperty = (
    property: DocumentPropertyView,
    rootLayout: boolean
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
        editMode={editMode}
        features={features}
        isEditable={isEditable}
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
    )
  }

  const addPropertyControl = (rootLayout: boolean) =>
    isEditable ? (
      <DocumentPropertyAddRow
        rootLayout={rootLayout}
        siblingNames={controller.propertyNames}
        onAddProperty={controller.addNewProperty}
      />
    ) : null

  if (path === "#") {
    return (
      <div>
        <Accordion
          defaultValue={["properties"]}
          className="w-full rounded-lg border border-border px-4 pb-0"
        >
          <AccordionItem value="properties" className="border-none">
            <AccordionTrigger className="text-sm font-medium text-muted-foreground">
              Properties ({properties.length})
            </AccordionTrigger>
            <AccordionContent className="px-1 pt-2">
              <div>
                {properties.length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">
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
    )
  }

  return (
    <div className="pl-2">
      <div>
        {properties.map((property) => renderProperty(property, false))}
        {addPropertyControl(false)}
      </div>
    </div>
  )
}
