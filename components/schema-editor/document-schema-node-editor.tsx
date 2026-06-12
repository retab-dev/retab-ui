"use client"

import * as React from "react"

import {
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
import { resolveSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

function changeNodeJson(
  doc: SchemaDocument,
  nodeId: string,
  nextNode: ExtendedJSONSchema7
) {
  return replaceNodeJson(doc, nodeId, nextNode)
}

export function DocumentSchemaNodeEditor({
  dispatch,
  doc,
  name,
  nodeId,
  nodeView,
  path,
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

  const localType = nodeView.type

  return (
    <div>
      <DocumentNodeHeader
        dispatch={dispatch}
        doc={doc}
        name={name}
        nodeView={nodeView}
        nodeId={nodeId}
        path={path}
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
        onChange={onChange}
      />

      {localType === "object" && (
        <DocumentObjectNodeEditor
          dispatch={dispatch}
          doc={doc}
          nodeId={nodeId}
          nodeView={nodeView}
          path={path}
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
          dispatch={dispatch}
          doc={doc}
          nodeId={nodeId}
          nodeView={nodeView}
          path={path}
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
          dispatch={dispatch}
          nodeId={nodeId}
          enumEntries={nodeView.enumEntries}
        />
      )}
    </div>
  )
}
