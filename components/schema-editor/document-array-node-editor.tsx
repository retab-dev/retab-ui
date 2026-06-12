"use client"

import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type { DocumentNodeView } from "@/components/schema-editor/document/view-model"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

interface DocumentArrayNodeEditorProps {
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
  dispatch: DocumentSchemaNodeEditorProps["dispatch"]
}

export function DocumentArrayNodeEditor({
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
}: DocumentArrayNodeEditorProps) {
  const itemView = nodeView.items
  if (!itemView) {
    throw new Error(`Missing document node id for array items at "${path}"`)
  }

  return (
    <div className="ml-4">
      <div className="ml-4 border-l border-border">
        {renderNode({
          dispatch,
          doc,
          draggedParentRef,
          draggedPropertyRef,
          editMode,
          features,
          name: "items",
          nodeId: itemView.nodeId,
          nodeView: itemView,
          path: `${path}.items`,
          canDelete: false,
          hidePencilButton: true,
          setDefsAccordionOpen,
        })}
      </div>
    </div>
  )
}
