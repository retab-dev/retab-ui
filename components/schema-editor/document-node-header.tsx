"use client"

import * as React from "react"

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
import { SchemaFieldRow } from "@/components/schema-editor/primitives/schema-field-row"

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
        <SchemaFieldRow
          id={`schema-field-${path.replace(/^#\.?/, "").split(".").join("-")}`}
          grip={isEditable ? "drag" : "empty"}
          name={
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
          }
          description={
            <DocumentNodeDescriptionControl
              description={controller.description}
              editMode={editMode}
              onOpenMetadata={() => controller.setMetadataDialogOpen(true)}
              onSubmitDescription={controller.submitDescription}
            />
          }
          actions={
            <DocumentNodeActions
              canDelete={canDelete}
              editMode={editMode}
              hidePencilButton={hidePencilButton}
              isEditable={isEditable}
              onDelete={onDelete}
              onOpenMetadata={() => controller.setMetadataDialogOpen(true)}
            />
          }
          type={
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
          }
        />
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
