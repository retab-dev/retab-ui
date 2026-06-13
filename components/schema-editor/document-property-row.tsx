"use client"

import type * as React from "react"

import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type { DocumentNodeView } from "@/components/schema-editor/document/view-model"
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
  mode: SchemaEditorMode
  features: ResolvedSchemaBuilderFeatures
  editable: boolean
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
  mode,
  features,
  editable,
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
      draggable={editable}
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
        mode,
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
