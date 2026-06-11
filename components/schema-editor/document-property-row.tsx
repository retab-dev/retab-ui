"use client"

import type * as React from "react"

import type { SchemaDocument } from "@/components/schema-editor/document"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

interface DocumentPropertyRowProps {
  applyDocOp: DocumentSchemaNodeEditorProps["applyDocOp"]
  doc: SchemaDocument
  propertyName: string
  propertyNode: ExtendedJSONSchema7
  propertyNodeId: string
  rootLayout: boolean
  path: string
  defs: DocumentSchemaNodeEditorProps["defs"]
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
  onNameChange: (
    newName: string,
    updatedNode?: ExtendedJSONSchema7
  ) => void
  onDelete: () => void
  onDragStart: React.DragEventHandler<HTMLDivElement>
  onDragOver: React.DragEventHandler<HTMLDivElement>
  onDragLeave: React.DragEventHandler<HTMLDivElement>
  onDrop: React.DragEventHandler<HTMLDivElement>
}

export function DocumentPropertyRow({
  applyDocOp,
  doc,
  propertyName,
  propertyNode,
  propertyNodeId,
  rootLayout,
  path,
  defs,
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
      data-prop-key={propertyName}
    >
      {renderNode({
        applyDocOp,
        doc,
        draggedParentRef,
        draggedPropertyRef,
        editMode,
        features,
        isRequired,
        siblingNames,
        onRequiredChange,
        name: propertyName,
        nodeId: propertyNodeId,
        node: propertyNode,
        onNameChange,
        path: `${path}.${propertyName}`,
        defs,
        canDelete: true,
        onDelete,
        setDefsAccordionOpen,
      })}
    </div>
  )
}
