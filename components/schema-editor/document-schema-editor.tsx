"use client"

import * as React from "react"

import { DocumentDefinitionsEditor } from "@/components/schema-editor/document-definitions-editor"
import type { SchemaEditorMode } from "@/components/schema-editor/document-node-editor-types"
import { useDocumentSchemaEditorController } from "@/components/schema-editor/document-schema-editor-controller"
import { DocumentSchemaNodeEditor } from "@/components/schema-editor/document-schema-node-editor"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type {
  ResolvedSchemaBuilderFeatures,
  SchemaDispatch,
  SchemaValidationResult,
} from "@/components/schema-editor/schema-builder-types"
import { TopLevelEditor } from "@/components/schema-editor/top-level-editor"
import { ValidationErrorDisplay } from "@/components/schema-editor/validation-error-display"

interface DocumentSchemaEditorProps {
  doc: SchemaDocument
  schema: ExtendedJSONSchema7
  validation: SchemaValidationResult
  dispatch: SchemaDispatch
  mode?: SchemaEditorMode
  features?: ResolvedSchemaBuilderFeatures
}

export function DocumentSchemaEditor({
  doc,
  schema,
  validation,
  dispatch,
  mode = "editable",
  features: featuresProp,
}: DocumentSchemaEditorProps) {
  const controller = useDocumentSchemaEditorController({
    doc,
    validation,
    dispatch,
    features: featuresProp,
  })

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
      <div className="group flex w-full flex-col">
        <ValidationErrorDisplay
          validationErrors={controller.validationErrors}
          variant="full"
        />
        <TopLevelEditor
          node={schema}
          mode={mode}
          showImportExportActions={controller.features.importExport}
          onTitleChange={controller.setRootTitle}
          onDescriptionChange={controller.setRootDescription}
          onEraseAll={controller.eraseRootSchema}
          onEraseDescriptions={controller.eraseDescriptions}
          onReplaceRoot={controller.replaceRoot}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <DocumentSchemaNodeEditor
          dispatch={dispatch}
          doc={doc}
          name="root"
          nodeId={doc.root.id}
          nodeView={controller.rootNodeView}
          path="#"
          mode={mode}
          features={controller.features}
          canDelete={false}
          setDefsAccordionOpen={controller.setDefsAccordionOpen}
          draggedParentRef={controller.draggedParentRef}
          draggedPropertyRef={controller.draggedPropertyRef}
        />
        <DocumentDefinitionsEditor
          dispatch={dispatch}
          doc={doc}
          mode={mode}
          definitionsEnabled={controller.features.definitions}
          features={controller.features}
          accordionOpen={controller.defsAccordionOpen}
          setAccordionOpen={controller.setDefsAccordionOpen}
          draggedParentRef={controller.draggedParentRef}
          draggedPropertyRef={controller.draggedPropertyRef}
        />
      </div>
    </div>
  )
}
