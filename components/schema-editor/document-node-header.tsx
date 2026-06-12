"use client"

import * as React from "react"
import { GripVertical } from "lucide-react"

import { DocumentNodeActions } from "@/components/schema-editor/document-node-actions"
import { DocumentNodeDescriptionControl } from "@/components/schema-editor/document-node-description-control"
import type {
  DocumentSchemaNodeEditorProps,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import { useDocumentNodeHeaderController } from "@/components/schema-editor/document-node-header-controller"
import { DocumentNodeNameControl } from "@/components/schema-editor/document-node-name-control"
import { DocumentNodeTypeMenu } from "@/components/schema-editor/document-node-type-menu"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type { DocumentNodeView } from "@/components/schema-editor/document/view-model"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { NodeDialog } from "@/components/schema-editor/node-dialog"
import { Tooltip, TooltipTrigger } from "@/components/ui-retab/tooltip"

import { EnumCreationDialog } from "./enum-creation-dialog"

interface DocumentNodeHeaderProps extends Omit<
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
  const controller = useDocumentNodeHeaderController({
    dispatch,
    doc,
    nodeId,
    nodeView,
    setDefsAccordionOpen,
  })

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
              isReference={controller.localType === "$ref"}
              refName={controller.refName}
              onNameChange={onNameChange}
              onShowDefinition={controller.showDefinition}
            />
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <DocumentNodeDescriptionControl
                description={controller.description}
                editMode={editMode}
                onOpenMetadata={() => controller.setMetadataDialogOpen(true)}
                onSubmitDescription={controller.submitDescription}
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
              onOpenMetadata={() => controller.setMetadataDialogOpen(true)}
            />
            <DocumentNodeTypeMenu
              defs={controller.defs}
              features={features}
              isEditable={isEditable}
              localType={controller.localType}
              refName={controller.refName}
              onCreateDefinition={controller.showDefinitionsSection}
              onSelectDefinition={controller.selectDefinition}
              onSelectObjectTemplate={controller.selectObjectTemplate}
              onSelectType={controller.selectType}
            />
          </div>
        </div>
      )}

      {path !== "#" && controller.metadataDialogOpen ? (
        <NodeDialog
          isOpen={controller.metadataDialogOpen}
          onClose={() => controller.setMetadataDialogOpen(false)}
          onChange={onChange}
          onNameChange={onNameChange || (() => {})}
          onDelete={
            isEditable && canDelete
              ? () => {
                  if (onDelete) {
                    onDelete()
                    controller.setMetadataDialogOpen(false)
                  }
                }
              : undefined
          }
          node={controller.schemaNode}
          name={name}
          editMode={editMode}
          siblingNames={siblingNames}
          formContext={{
            schemaDefinitions: controller.defs || {},
            fieldPath: path,
            objectTemplatesEnabled: features.objectTemplates,
            onCommand: controller.handlePropertyFormCommand,
          }}
        />
      ) : null}

      <EnumCreationDialog
        isOpen={controller.enumCreationDialogOpen}
        onClose={() => controller.setEnumCreationDialogOpen(false)}
        onConfirm={controller.confirmEnumValues}
        onCancel={() => undefined}
      />
    </>
  )
}
