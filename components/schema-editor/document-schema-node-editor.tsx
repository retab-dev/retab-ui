"use client"

import * as React from "react"

import {
  getEffectiveDocNode,
  getNode,
  replaceNodeJson,
  type SchemaDocument,
} from "@/components/schema-editor/document"
import { DocumentArrayNodeEditor } from "@/components/schema-editor/document-array-node-editor"
import { DocumentEnumNodeEditor } from "@/components/schema-editor/document-enum-node-editor"
import { DocumentNodeHeader } from "@/components/schema-editor/document-node-header"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
} from "@/components/schema-editor/document-node-editor-types"
import { DocumentObjectNodeEditor } from "@/components/schema-editor/document-object-node-editor"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { resolveSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

import { getEffectiveType } from "./draft/draft-node-edits"

function changeNodeJson(
  doc: SchemaDocument,
  nodeId: string,
  nextNode: ExtendedJSONSchema7
) {
  return replaceNodeJson(doc, nodeId, nextNode)
}

export function DocumentSchemaNodeEditor({
  applyDocOp,
  doc,
  name,
  node,
  nodeId,
  path,
  defs,
  canDelete = false,
  onDelete,
  onNameChange,
  setDefsAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
  editMode = "editable",
  hidePencilButton = false,
  isRequired,
  onRequiredChange,
  siblingNames = [],
  features: featuresProp,
}: DocumentSchemaNodeEditorProps) {
  const features =
    featuresProp ??
    resolveSchemaBuilderFeatures({
      definitions: true,
      objectTemplates: true,
      jsonMode: true,
      importExport: true,
    })
  const dispatch = applyDocOp
  const effective = getEffectiveNode(node)
  const docNode = getNode(doc, nodeId)
  const effectiveDocNode = docNode ? getEffectiveDocNode(docNode) : undefined
  const { type: localType } = getEffectiveType(node)

  const onChange = React.useCallback(
    (newNode: ExtendedJSONSchema7) => {
      dispatch((current) => changeNodeJson(current, nodeId, newNode))
    },
    [dispatch, nodeId]
  )

  const renderNode = React.useCallback<RenderDocumentNodeEditor>(
    (props) => <DocumentSchemaNodeEditor {...props} />,
    []
  )

  return (
    <div>
      <DocumentNodeHeader
        applyDocOp={dispatch}
        name={name}
        node={node}
        nodeId={nodeId}
        path={path}
        defs={defs}
        canDelete={canDelete}
        onDelete={onDelete}
        onNameChange={onNameChange}
        setDefsAccordionOpen={setDefsAccordionOpen}
        editMode={editMode}
        hidePencilButton={hidePencilButton}
        isRequired={isRequired}
        onRequiredChange={onRequiredChange}
        siblingNames={siblingNames}
        features={features}
        effective={effective}
        localType={localType}
        onChange={onChange}
      />

      {localType === "object" && (
        <DocumentObjectNodeEditor
          applyDocOp={dispatch}
          doc={doc}
          nodeId={nodeId}
          effective={effective}
          path={path}
          defs={defs}
          setDefsAccordionOpen={setDefsAccordionOpen}
          draggedParentRef={draggedParentRef}
          draggedPropertyRef={draggedPropertyRef}
          editMode={editMode}
          features={features}
          renderNode={renderNode}
        />
      )}

      {localType === "array" && (
        <DocumentArrayNodeEditor
          applyDocOp={dispatch}
          doc={doc}
          nodeId={nodeId}
          items={effective.items}
          path={path}
          defs={defs}
          setDefsAccordionOpen={setDefsAccordionOpen}
          draggedParentRef={draggedParentRef}
          draggedPropertyRef={draggedPropertyRef}
          editMode={editMode}
          features={features}
          renderNode={renderNode}
        />
      )}

      {localType === "enum" && (
        <DocumentEnumNodeEditor
          applyDocOp={dispatch}
          nodeId={nodeId}
          enumEntries={effectiveDocNode?.enum ?? []}
        />
      )}
    </div>
  )
}
