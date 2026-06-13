"use client"

import * as React from "react"

import { DocumentArrayNodeEditor } from "@/components/schema-editor/document-array-node-editor"
import { DocumentEnumNodeEditor } from "@/components/schema-editor/document-enum-node-editor"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
} from "@/components/schema-editor/document-node-editor-types"
import { DocumentNodeHeader } from "@/components/schema-editor/document-node-header"
import { DocumentObjectNodeEditor } from "@/components/schema-editor/document-object-node-editor"
import { replaceNodeJson } from "@/components/schema-editor/document/json-node"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
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
  mode = "editable",
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
        mode={mode}
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
          mode={mode}
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
          mode={mode}
          features={features}
          renderNode={renderNode}
        />
      )}

      {localType === "enum" && (
        <DocumentEnumNodeEditor
          dispatch={dispatch}
          mode={mode}
          nodeId={nodeId}
          enumEntries={nodeView.enumEntries}
        />
      )}
    </div>
  )
}
