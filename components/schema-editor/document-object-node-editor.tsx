"use client"

import * as React from "react"
import { useMemo, useState } from "react"
import { AlertCircle, PlusIcon } from "lucide-react"

import {
  addProperty,
  createNode,
  getChildNodeId,
  getChildPropertyId,
  getEffectiveDocNode,
  getNode,
  moveProperty,
  removeProperty,
  renameProperty,
  replaceNodeJson,
  setRequired,
  type SchemaDocument,
} from "@/components/schema-editor/document"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import type {
  DocumentSchemaNodeEditorProps,
  RenderDocumentNodeEditor,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"
import { DocumentPropertyRow } from "@/components/schema-editor/document-property-row"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-retab/accordion"
import { Button } from "@/components/ui-retab/button"
import { Input } from "@/components/ui-retab/input"

import { formatTitle } from "./schema-title"

interface DocumentObjectNodeEditorProps {
  applyDocOp: DocumentSchemaNodeEditorProps["applyDocOp"]
  doc: SchemaDocument
  nodeId: string
  effective: ExtendedJSONSchema7
  path: string
  defs: DocumentSchemaNodeEditorProps["defs"]
  setDefsAccordionOpen: (open: boolean) => void
  draggedParentRef: DocumentSchemaNodeEditorProps["draggedParentRef"]
  draggedPropertyRef: DocumentSchemaNodeEditorProps["draggedPropertyRef"]
  editMode: SchemaEditorMode
  features: ResolvedSchemaBuilderFeatures
  renderNode: RenderDocumentNodeEditor
}

function isJSONSchema(value: unknown): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null
}

export function DocumentObjectNodeEditor({
  applyDocOp,
  doc,
  nodeId,
  effective,
  path,
  defs,
  setDefsAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
  editMode,
  features,
  renderNode,
}: DocumentObjectNodeEditorProps) {
  const isEditable = editMode === "editable"
  const [newPropName, setNewPropName] = useState("")
  const [newPropErr, setNewPropErr] = useState<string | null>(null)
  const propertyNames = useMemo(
    () => Object.keys(effective.properties || {}),
    [effective.properties]
  )
  const objectNodeId = useMemo(() => {
    const docNode = getNode(doc, nodeId)
    return docNode ? getEffectiveDocNode(docNode).id : nodeId
  }, [doc, nodeId])

  const childNodeId = (propName: string): string => {
    const childId = getChildNodeId(doc, nodeId, propName)
    if (!childId) {
      throw new Error(`Missing document node id for property "${propName}"`)
    }
    return childId
  }

  const childPropertyId = (propName: string): string => {
    const propertyId = getChildPropertyId(doc, nodeId, propName)
    if (!propertyId) {
      throw new Error(`Missing document property id for property "${propName}"`)
    }
    return propertyId
  }

  const validateNewPropertyName = (value: string) =>
    validateName(value, propertyNames, undefined, "property")

  const addNewProperty = () => {
    const key = newPropName.trim()
    const err = validateNewPropertyName(key)
    if (err) {
      setNewPropErr(err)
      return
    }
    if (!key) return

    applyDocOp((current) =>
      addProperty(current, objectNodeId, {
        key,
        required: true,
        node: { ...createNode("string"), title: formatTitle(key) },
      })
    )
    setNewPropName("")
    setNewPropErr(null)
  }

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    propName: string
  ) => {
    event.stopPropagation()
    const propertyId = childPropertyId(propName)
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
    dragElement.innerHTML = `<span style="font-weight: medium">${propName}</span>`
    document.body.appendChild(dragElement)

    event.dataTransfer.setDragImage(dragElement, 10, 10)
    setTimeout(() => {
      document.body.removeChild(dragElement)
    }, 0)
  }

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    targetPropName: string
  ) => {
    event.preventDefault()
    const draggedPropertyId = draggedPropertyRef.current
    const sourceIndex = propertyNames.findIndex(
      (name) => childPropertyId(name) === draggedPropertyId
    )
    const targetIndex = propertyNames.indexOf(targetPropName)
    const targetPropertyId = childPropertyId(targetPropName)

    event.dataTransfer.dropEffect = "move"

    if (
      draggedParentRef.current === path &&
      targetPropertyId !== draggedPropertyId
    ) {
      event.currentTarget.classList.add(
        sourceIndex > targetIndex ? "border-t-2" : "border-b-2"
      )
      event.currentTarget.classList.add("border-grey-700")
      event.currentTarget.classList.add("border-dashed")
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.currentTarget.classList.remove("border-t-2")
    event.currentTarget.classList.remove("border-b-2")
    event.currentTarget.classList.remove("border-grey-700")
    event.currentTarget.classList.remove("border-dashed")
  }

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetPropName: string
  ) => {
    event.stopPropagation()
    event.preventDefault()
    const sourcePropertyId = event.dataTransfer.getData("text/plain")

    event.currentTarget.classList.remove("border-t-2")
    event.currentTarget.classList.remove("border-b-2")
    event.currentTarget.classList.remove("border-grey-700")
    event.currentTarget.classList.remove("border-dashed")

    const targetPropertyId = childPropertyId(targetPropName)

    if (
      !sourcePropertyId ||
      sourcePropertyId === targetPropertyId ||
      draggedParentRef.current !== path
    ) {
      return
    }

    const targetIndex = propertyNames.indexOf(targetPropName)
    applyDocOp((current) =>
      moveProperty(current, sourcePropertyId, objectNodeId, targetIndex)
    )
  }

  const renderProperty = (propName: string, rootLayout: boolean) => {
    const propValue = effective.properties?.[propName]
    if (!isJSONSchema(propValue)) return null

    const childId = childNodeId(propName)
    const propertyId = childPropertyId(propName)
    return (
      <DocumentPropertyRow
        key={propName}
        applyDocOp={applyDocOp}
        doc={doc}
        propertyName={propName}
        propertyNode={propValue}
        propertyNodeId={childId}
        rootLayout={rootLayout}
        path={path}
        defs={defs}
        setDefsAccordionOpen={setDefsAccordionOpen}
        draggedParentRef={draggedParentRef}
        draggedPropertyRef={draggedPropertyRef}
        editMode={editMode}
        features={features}
        isEditable={isEditable}
        isRequired={
          Array.isArray(effective.required)
            ? effective.required.includes(propName)
            : false
        }
        siblingNames={propertyNames}
        renderNode={renderNode}
        onRequiredChange={(required) => {
          applyDocOp((current) => setRequired(current, propertyId, required))
        }}
        onNameChange={(newName, updatedNode) => {
          applyDocOp((current) => {
            let next = current
            if (newName !== propName) {
              next = renameProperty(next, propertyId, newName)
            }
            if (updatedNode) {
              next = replaceNodeJson(next, childId, updatedNode)
            }
            return next
          })
        }}
        onDelete={() => {
          applyDocOp((current) => removeProperty(current, propertyId))
        }}
        onDragStart={(event) => handleDragStart(event, propName)}
        onDragOver={(event) => handleDragOver(event, propName)}
        onDragLeave={handleDragLeave}
        onDrop={(event) => handleDrop(event, propName)}
      />
    )
  }

  const addPropertyControl = (rootLayout: boolean) =>
    isEditable ? (
      <div
        className={
          rootLayout
            ? "mt-3 ml-4 flex flex-col gap-1"
            : "mt-2 ml-4 flex items-center gap-3 border-l border-border pl-4"
        }
      >
        <div className="flex items-center gap-3">
          <Input
            placeholder="New property name"
            className={`h-8 w-40 ${newPropErr ? "border-destructive" : ""}`}
            value={newPropName}
            onChange={(event) => {
              const value = event.target.value
              setNewPropName(value)
              setNewPropErr(value ? validateNewPropertyName(value) : null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && newPropName.trim()) {
                addNewProperty()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!newPropErr || !newPropName.trim()}
            className={
              !!newPropErr || !newPropName.trim() ? "cursor-not-allowed" : ""
            }
            onClick={addNewProperty}
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add</span>
          </Button>
        </div>

        {newPropErr && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" /> {newPropErr}
          </p>
        )}
      </div>
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
              Properties ({propertyNames.length})
            </AccordionTrigger>
            <AccordionContent>
              <div>
                {propertyNames.length === 0 && (
                  <p className="ml-4 py-2 text-sm text-muted-foreground">
                    Define the data structure for this object.
                  </p>
                )}
                {propertyNames.map((propName) => renderProperty(propName, true))}
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
        {propertyNames.map((propName) => renderProperty(propName, false))}
        {addPropertyControl(false)}
      </div>
    </div>
  )
}
