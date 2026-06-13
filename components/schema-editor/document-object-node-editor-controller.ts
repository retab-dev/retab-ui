import type * as React from "react"

import type { DocumentSchemaNodeEditorProps } from "@/components/schema-editor/document-node-editor-types"
import {
  beginSchemaRowDrag,
  leaveSchemaRowDragTarget,
  resolveSchemaRowDrop,
  updateSchemaRowDragTarget,
} from "@/components/schema-editor/primitives/schema-row-drag"
import { replaceNodeJson } from "@/components/schema-editor/document/json-node"
import {
  addProperty,
  moveProperty,
  removeProperty,
  renameProperty,
  setRequired,
} from "@/components/schema-editor/document/property-operations"
import { createNode } from "@/components/schema-editor/document/type-operations"
import type { DocumentPropertyView } from "@/components/schema-editor/document/view-model"
import { formatTitle } from "@/components/schema-editor/schema-title"

interface DocumentObjectNodeEditorControllerOptions {
  dispatch: DocumentSchemaNodeEditorProps["dispatch"]
  objectNodeId: string
  properties: DocumentPropertyView[]
  draggedPropertyRef: DocumentSchemaNodeEditorProps["draggedPropertyRef"]
}

export function useDocumentObjectNodeEditorController({
  dispatch,
  objectNodeId,
  properties,
  draggedPropertyRef,
}: DocumentObjectNodeEditorControllerOptions) {
  const propertyNames = properties.map((property) => property.propertyName)
  const propertyIds = properties.map((property) => property.propertyId)

  const addNewProperty = (propertyName: string) => {
    dispatch((current) =>
      addProperty(current, objectNodeId, {
        key: propertyName,
        required: true,
        node: { ...createNode("string"), title: formatTitle(propertyName) },
      })
    )
  }

  const setPropertyRequired = (
    property: DocumentPropertyView,
    required: boolean
  ) => {
    dispatch((current) => setRequired(current, property.propertyId, required))
  }

  const updateProperty = (
    property: DocumentPropertyView,
    newName: string,
    updatedNode?: Parameters<
      NonNullable<DocumentSchemaNodeEditorProps["onNameChange"]>
    >[1]
  ) => {
    dispatch((current) => {
      let next = current
      if (newName !== property.propertyName) {
        next = renameProperty(next, property.propertyId, newName)
      }
      if (updatedNode) {
        next = replaceNodeJson(next, property.nodeView.nodeId, updatedNode)
      }
      return next
    })
  }

  const deleteProperty = (property: DocumentPropertyView) => {
    dispatch((current) => removeProperty(current, property.propertyId))
  }

  const startDrag = (
    event: React.DragEvent<HTMLDivElement>,
    property: DocumentPropertyView
  ) => {
    beginSchemaRowDrag({
      event,
      item: {
        id: property.propertyId,
        label: property.propertyName,
      },
      draggedRowIdRef: draggedPropertyRef,
    })
  }

  const dragOver = (
    event: React.DragEvent<HTMLDivElement>,
    property: DocumentPropertyView
  ) => {
    updateSchemaRowDragTarget({
      event,
      rowIds: propertyIds,
      targetRowId: property.propertyId,
      draggedRowIdRef: draggedPropertyRef,
    })
  }

  const drop = (
    event: React.DragEvent<HTMLDivElement>,
    property: DocumentPropertyView
  ) => {
    const move = resolveSchemaRowDrop({
      event,
      rowIds: propertyIds,
      targetRowId: property.propertyId,
      draggedRowIdRef: draggedPropertyRef,
    })
    if (!move) return
    dispatch((current) =>
      moveProperty(
        current,
        move.sourceRowId,
        objectNodeId,
        move.targetIndex
      )
    )
  }

  return {
    propertyNames,
    addNewProperty,
    setPropertyRequired,
    updateProperty,
    deleteProperty,
    startDrag,
    dragOver,
    leaveDragTarget: leaveSchemaRowDragTarget,
    drop,
  }
}
