"use client"

import {
  getItemsNodeId,
  type SchemaDocument,
} from "@/components/schema-editor/document"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

interface DocumentArrayNodeEditorProps {
  doc: SchemaDocument
  nodeId: string
  items: unknown
  path: string
  defs: DocumentSchemaNodeEditorProps["defs"]
  setDefsAccordionOpen: (open: boolean) => void
  draggedParentRef: DocumentSchemaNodeEditorProps["draggedParentRef"]
  draggedPropertyRef: DocumentSchemaNodeEditorProps["draggedPropertyRef"]
  editMode: SchemaEditorMode
  features: ResolvedSchemaBuilderFeatures
  renderNode: RenderDocumentNodeEditor
  applyDocOp: DocumentSchemaNodeEditorProps["applyDocOp"]
}

function isJSONSchema(value: unknown): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null
}

export function DocumentArrayNodeEditor({
  applyDocOp,
  doc,
  nodeId,
  items,
  path,
  defs,
  setDefsAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
  editMode,
  features,
  renderNode,
}: DocumentArrayNodeEditorProps) {
  if (items === undefined || Array.isArray(items) || !isJSONSchema(items)) {
    return null
  }

  const itemNodeId = getItemsNodeId(doc, nodeId)
  if (!itemNodeId) {
    throw new Error(`Missing document node id for array items at "${path}"`)
  }

  return (
    <div className="ml-4">
      <div className="ml-4 border-l border-border">
        {renderNode({
          applyDocOp,
          doc,
          draggedParentRef,
          draggedPropertyRef,
          editMode,
          features,
          name: "items",
          nodeId: itemNodeId,
          node: items,
          path: `${path}.items`,
          defs,
          canDelete: false,
          hidePencilButton: true,
          setDefsAccordionOpen,
        })}
      </div>
    </div>
  )
}
