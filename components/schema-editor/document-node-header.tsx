"use client"

import * as React from "react"
import { useState } from "react"
import type { JSONSchema7Definition } from "json-schema"
import { GripVertical } from "lucide-react"

import {
  projectNode,
  setEnumValues,
  setNodeDescription,
  setNodeEditorType,
  setRefByName,
  type DocumentNodeView,
  type SchemaDocument,
  type SchemaEditorType,
} from "@/components/schema-editor/document"
import { DocumentNodeActions } from "@/components/schema-editor/document-node-actions"
import { DocumentNodeDescriptionControl } from "@/components/schema-editor/document-node-description-control"
import { DocumentNodeNameControl } from "@/components/schema-editor/document-node-name-control"
import { DocumentNodeTypeMenu } from "@/components/schema-editor/document-node-type-menu"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { NodeDialog } from "@/components/schema-editor/node-dialog"
import type {
  DocumentSchemaNodeEditorProps,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import {
  Tooltip,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip"

import { EnumCreationDialog } from "./enum-creation-dialog"

interface DocumentNodeHeaderProps
  extends Omit<
    DocumentSchemaNodeEditorProps,
    "draggedParentRef" | "draggedPropertyRef"
  > {
  doc: SchemaDocument
  nodeView: DocumentNodeView
  editMode: SchemaEditorMode
  features: NonNullable<DocumentSchemaNodeEditorProps["features"]>
  onChange: (newNode: ExtendedJSONSchema7) => void
}

export function DocumentNodeHeader({
  dispatch,
  doc,
  name,
  nodeView,
  nodeId,
  path,
  canDelete = false,
  onDelete,
  onNameChange,
  setDefsAccordionOpen,
  editMode,
  hidePencilButton = false,
  siblingNames = [],
  features,
  onChange,
}: DocumentNodeHeaderProps) {
  const isEditable = editMode === "editable"
  const schemaNode = projectNode(doc, nodeView.docNode) as ExtendedJSONSchema7
  const defs: Record<string, JSONSchema7Definition> = {}
  for (const definition of doc.defs) {
    defs[definition.name] = projectNode(doc, definition.node)
  }
  const localType = nodeView.type
  const description = nodeView.description || ""

  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false)
  const [enumCreationDialogOpen, setEnumCreationDialogOpen] = useState(false)

  const handleTypeChange = (newType: SchemaEditorType | "enum") => {
    if (newType === "enum") {
      if (localType !== "enum") {
        setEnumCreationDialogOpen(true)
      }
      return
    }
    dispatch((current) =>
      setNodeEditorType(current, nodeId, newType as SchemaEditorType)
    )
  }

  const handleEnumConfirm = (enumValues: string[]) => {
    dispatch((current) => setEnumValues(current, nodeId, enumValues))
  }

  const handleDescriptionSubmit = (nextDescription: string) => {
    dispatch((current) =>
      setNodeDescription(current, nodeId, nextDescription || undefined)
    )
  }

  const showDefinition = React.useCallback(
    (definitionName: string) => {
      setDefsAccordionOpen(true)
      setTimeout(() => {
        const definitionElement = document.getElementById(
          `def-${definitionName}`
        )
        if (definitionElement) {
          definitionElement.scrollIntoView({ behavior: "smooth" })
          definitionElement.classList.add("bg-accent")
          setTimeout(
            () => definitionElement.classList.remove("bg-accent"),
            2500
          )
        }
      }, 600)
    },
    [setDefsAccordionOpen]
  )

  const showDefinitionsSection = React.useCallback(() => {
    setDefsAccordionOpen(true)
    setTimeout(() => {
      const definitionsSection = document.getElementById("definitions-section")
      if (definitionsSection) {
        definitionsSection.scrollIntoView({ behavior: "smooth" })
        definitionsSection.style.backgroundColor = "var(--accent)"
        setTimeout(() => {
          definitionsSection.style.backgroundColor = ""
        }, 2500)
      }
    }, 600)
  }, [setDefsAccordionOpen])

  const handleObjectTemplateSelect = React.useCallback(
    (templateName: string) => {
      void import("./optional/object-templates/object-template-reference").then(
        ({ applyObjectTemplateReferenceToDocument }) => {
          dispatch((current) =>
            applyObjectTemplateReferenceToDocument(
              current,
              nodeId,
              templateName
            )
          )
        }
      )
    },
    [dispatch, nodeId]
  )

  const handlePropertyFormCommand = React.useCallback<
    NonNullable<React.ComponentProps<typeof NodeDialog>["formContext"]["onCommand"]>
  >(
    async (command) => {
      if (command.type === "createDefinition") {
        showDefinitionsSection()
        return
      }

      if (command.type === "installObjectTemplate") {
        const { addObjectTemplateDefinitionsToDocument } = await import(
          "./optional/object-templates/object-template-reference"
        )
        dispatch((current) =>
          addObjectTemplateDefinitionsToDocument(current, command.templateName)
        )
      }
    },
    [dispatch, showDefinitionsSection]
  )

  const refName = localType === "$ref" ? nodeView.refName : undefined

  return (
    <>
      {path !== "#" && (
        <div
          id={`schema-field-${path.replace(/^#\.?/, "").split(".").join("-")}`}
          className="group flex flex-col items-start justify-between py-0 pl-0 hover:bg-accent sm:flex-row sm:items-center"
        >
          {isEditable ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <GripVertical className="h-12 w-6 cursor-pointer px-1 py-4 text-transparent group-hover:text-muted-foreground" />
              </TooltipTrigger>
            </Tooltip>
          ) : (
            <div className="h-12 w-6 px-1 py-4" />
          )}

          <div className="flex min-w-0 flex-1 items-center space-x-2">
            <DocumentNodeNameControl
              isEditable={isEditable}
              name={name}
              siblingNames={siblingNames}
              canRename={Boolean(onNameChange)}
              isReference={localType === "$ref"}
              refName={refName}
              onNameChange={onNameChange}
              onShowDefinition={showDefinition}
            />
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <DocumentNodeDescriptionControl
                description={description}
                editMode={editMode}
                onOpenMetadata={() => setMetadataDialogOpen(true)}
                onSubmitDescription={handleDescriptionSubmit}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DocumentNodeActions
              canDelete={canDelete}
              editMode={editMode}
              hidePencilButton={hidePencilButton}
              isEditable={isEditable}
              onDelete={onDelete}
              onOpenMetadata={() => setMetadataDialogOpen(true)}
            />
            <DocumentNodeTypeMenu
              defs={defs}
              features={features}
              isEditable={isEditable}
              localType={localType}
              refName={refName}
              onCreateDefinition={showDefinitionsSection}
              onSelectDefinition={(definitionName) => {
                dispatch((current) =>
                  setRefByName(current, nodeId, definitionName)
                )
              }}
              onSelectObjectTemplate={handleObjectTemplateSelect}
              onSelectType={handleTypeChange}
            />
          </div>
        </div>
      )}

      {path !== "#" && metadataDialogOpen ? (
        <NodeDialog
          isOpen={metadataDialogOpen}
          onClose={() => setMetadataDialogOpen(false)}
          onChange={onChange}
          onNameChange={onNameChange || (() => {})}
          onDelete={
            isEditable && canDelete
              ? () => {
                  if (onDelete) {
                    onDelete()
                    setMetadataDialogOpen(false)
                  }
                }
              : undefined
          }
          node={schemaNode}
          name={name}
          editMode={editMode}
          siblingNames={siblingNames}
          formContext={{
            schemaDefinitions: defs || {},
            fieldPath: path,
            objectTemplatesEnabled: features.objectTemplates,
            onCommand: handlePropertyFormCommand,
          }}
        />
      ) : null}

      <EnumCreationDialog
        isOpen={enumCreationDialogOpen}
        onClose={() => setEnumCreationDialogOpen(false)}
        onConfirm={handleEnumConfirm}
        onCancel={() => undefined}
      />
    </>
  )
}
