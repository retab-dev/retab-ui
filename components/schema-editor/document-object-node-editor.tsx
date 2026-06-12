"use client"

import * as React from "react"

import {
  addProperty,
  createNode,
  moveProperty,
  removeProperty,
  renameProperty,
  replaceNodeJson,
  setRequired,
  type DocumentNodeView,
  type DocumentPropertyView,
  type SchemaDocument,
} from "@/components/schema-editor/document"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import { DocumentPropertyAddRow } from "@/components/schema-editor/document-property-add-row"
import {
  applyPropertyDropClasses,
  clearPropertyDropClasses,
  getPropertyDropIndicator,
  getPropertyDropTargetIndex,
} from "@/components/schema-editor/document-property-reorder"
import { DocumentPropertyRow } from "@/components/schema-editor/document-property-row"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-retab/accordion"

import { formatTitle } from "./schema-title"

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

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    propertyId: string,
    propertyName: string
  ) => {
    event.stopPropagation()
    event.dataTransfer.setData("text/plain", propertyId)
    event.dataTransfer.effectAllowed = "move"
    draggedParentRef.current = path
    draggedPropertyRef.current = propertyId

    const dragElement = document.createElement("div")
    const rect = event.currentTarget.getBoundingClientRect()

    dragElement.style.width = `${rect.width}px`
    dragElement.style.padding = "8px"
    dragElement.style.border = "1px solid var(--ring)"
    dragElement.style.borderRadius = "4px"
    dragElement.style.backgroundColor = "var(--background)"
    dragElement.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)"
    dragElement.style.opacity = "0.8"
    dragElement.style.position = "fixed"
    dragElement.style.zIndex = "9999"
    dragElement.style.pointerEvents = "none"
    dragElement.innerHTML = `<span style="font-weight: medium">${propertyName}</span>`
    document.body.appendChild(dragElement)

    event.dataTransfer.setDragImage(dragElement, 10, 10)
    setTimeout(() => {
      document.body.removeChild(dragElement)
    }, 0)
  }

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    targetPropertyId: string
  ) => {
    event.preventDefault()
    const indicator = getPropertyDropIndicator({
      propertyIds,
      sourcePropertyId: draggedPropertyRef.current,
      targetPropertyId,
    })

    event.dataTransfer.dropEffect = "move"
    applyPropertyDropClasses(
      event.currentTarget,
      draggedParentRef.current === path ? indicator : null
    )
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation()
    clearPropertyDropClasses(event.currentTarget)
  }

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetPropertyId: string
  ) => {
    event.stopPropagation()
    event.preventDefault()
    const sourcePropertyId = event.dataTransfer.getData("text/plain")
    clearPropertyDropClasses(event.currentTarget)

    if (
      !sourcePropertyId ||
      sourcePropertyId === targetPropertyId ||
      draggedParentRef.current !== path
    ) {
      return
    }

    const targetIndex = getPropertyDropTargetIndex({
      propertyIds,
      targetPropertyId,
    })
    dispatch((current) =>
      moveProperty(current, sourcePropertyId, objectNodeId, targetIndex)
    )
  }

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
        siblingNames={propertyNames}
        renderNode={renderNode}
        onRequiredChange={(required) => {
          dispatch((current) =>
            setRequired(current, property.propertyId, required)
          )
        }}
        onNameChange={(newName, updatedNode) => {
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
        }}
        onDelete={() => {
          dispatch((current) => removeProperty(current, property.propertyId))
        }}
        onDragStart={(event) =>
          handleDragStart(
            event,
            property.propertyId,
            property.propertyName
          )
        }
        onDragOver={(event) => handleDragOver(event, property.propertyId)}
        onDragLeave={handleDragLeave}
        onDrop={(event) => handleDrop(event, property.propertyId)}
      />
    )
  }

  const addPropertyControl = (rootLayout: boolean) =>
    isEditable ? (
      <DocumentPropertyAddRow
        rootLayout={rootLayout}
        siblingNames={propertyNames}
        onAddProperty={addNewProperty}
      />
    ) : null

  if (path === "#") {
    return (
      <div className="px-0">
        <Accordion
          defaultValue="properties"
          type="single"
          collapsible
          className="w-full rounded-lg border border-border px-4 pb-0 shadow-sm"
        >
          <AccordionItem value="properties" className="border-none">
            <AccordionTrigger className="text-sm font-medium text-muted-foreground">
              Properties ({properties.length})
            </AccordionTrigger>
            <AccordionContent>
              <div>
                {properties.length === 0 && (
                  <p className="ml-4 py-2 text-sm text-muted-foreground">
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
