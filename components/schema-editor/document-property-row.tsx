"use client"

import type * as React from "react"

import type {
  DocumentNodeView,
  SchemaDocument,
} from "@/components/schema-editor/document"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

interface DocumentPropertyRowProps {
  propertyId: string
  dispatch: DocumentSchemaNodeEditorProps["dispatch"]
  doc: SchemaDocument
  propertyName: string
  nodeView: DocumentNodeView
  rootLayout: boolean
  path: string
  setDefsAccordionOpen: (open: boolean) => void
  draggedParentRef: DocumentSchemaNodeEditorProps["draggedParentRef"]
  draggedPropertyRef: DocumentSchemaNodeEditorProps["draggedPropertyRef"]
  editMode: SchemaEditorMode
  features: ResolvedSchemaBuilderFeatures
  isEditable: boolean
  isRequired: boolean
  siblingNames: string[]
  renderNode: RenderDocumentNodeEditor
  onRequiredChange: (required: boolean) => void
  onNameChange: DocumentSchemaNodeEditorProps["onNameChange"]
  onDelete: () => void
  onDragStart: React.DragEventHandler<HTMLDivElement>
  onDragOver: React.DragEventHandler<HTMLDivElement>
  onDragLeave: React.DragEventHandler<HTMLDivElement>
  onDrop: React.DragEventHandler<HTMLDivElement>
}

export function DocumentPropertyRow({
  propertyId,
  dispatch,
  doc,
  propertyName,
  nodeView,
  rootLayout,
  path,
  setDefsAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
  editMode,
  features,
  isEditable,
  isRequired,
  siblingNames,
  renderNode,
  onRequiredChange,
  onNameChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: DocumentPropertyRowProps) {
  return (
    <div
      className={rootLayout ? "" : "ml-4 border-l border-border"}
      draggable={isEditable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-property-id={propertyId}
      data-property-name={propertyName}
    >
      {renderNode({
        dispatch,
        doc,
        draggedParentRef,
        draggedPropertyRef,
        editMode,
        features,
        isRequired,
        siblingNames,
        onRequiredChange,
        name: propertyName,
        nodeId: nodeView.nodeId,
        nodeView,
        onNameChange,
        path: `${path}.${propertyName}`,
        canDelete: true,
        onDelete,
        setDefsAccordionOpen,
      })}
    </div>
  )
}
