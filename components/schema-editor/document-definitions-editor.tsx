"use client"

import * as React from "react"

import { useDocumentDefinitionsEditorController } from "@/components/schema-editor/document-definitions-editor-controller"
import type { SchemaEditorMode } from "@/components/schema-editor/document-node-editor-types"
import {
  definitionElementId,
  DEFINITIONS_SECTION_ID,
} from "@/components/schema-editor/document-node-reveal"
import { DocumentSchemaNodeEditor } from "@/components/schema-editor/document-schema-node-editor"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type {
  ResolvedSchemaBuilderFeatures,
  SchemaDispatch,
} from "@/components/schema-editor/schema-builder-types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DocumentDefinitionsEditorProps {
  dispatch: SchemaDispatch
  doc: SchemaDocument
  editMode: SchemaEditorMode
  definitionsEnabled: boolean
  features: ResolvedSchemaBuilderFeatures
  accordionOpen: boolean
  setAccordionOpen: (open: boolean) => void
  draggedParentRef: React.RefObject<string | null>
  draggedPropertyRef: React.RefObject<string | null>
}

export function DocumentDefinitionsEditor({
  dispatch,
  doc,
  editMode,
  definitionsEnabled,
  features,
  accordionOpen,
  setAccordionOpen,
  draggedParentRef,
  draggedPropertyRef,
}: DocumentDefinitionsEditorProps) {
  const controller = useDocumentDefinitionsEditorController({
    dispatch,
    doc,
    editMode,
    definitionsEnabled,
    accordionOpen,
    setAccordionOpen,
  })

  if (controller.shouldShowClosedPrompt) {
    return editMode === "descriptionOnly" ? null : (
      <div className="mt-6 flex pb-4">
        <div
          className="rounded-md transition-colors duration-300"
          id={DEFINITIONS_SECTION_ID}
        >
          {definitionsEnabled ? (
            <Button
              type="button"
              variant="outline"
              onClick={controller.openDefinitions}
              className="rounded-md bg-transparent"
            >
              Add definition
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <Accordion
      id={DEFINITIONS_SECTION_ID}
      className="mt-6 w-full rounded-lg border border-border px-4 pb-0 shadow-sm"
      value={[controller.accordionValue]}
    >
      <AccordionItem value="defs" className="border-none bg-transparent">
        <AccordionTrigger className="bg-transparent font-medium text-muted-foreground">
          <div className="flex items-center">
            Definitions ({doc.defs.length})
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-transparent pt-2">
          <div className="space-y-4">
            {doc.defs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Create reusable schema components to avoid duplication with a
                new definition.
              </p>
            )}
            {controller.definitionViews.map((definitionView) => {
              const { definition } = definitionView
              return (
                <div
                  key={definition.id}
                  className="py-2 transition-colors duration-300"
                  id={definitionElementId(definition.id)}
                >
                  <DocumentSchemaNodeEditor
                    dispatch={dispatch}
                    doc={doc}
                    draggedParentRef={draggedParentRef}
                    draggedPropertyRef={draggedPropertyRef}
                    editMode={definitionsEnabled ? editMode : "readOnly"}
                    features={features}
                    name={definition.name}
                    nodeId={definition.node.id}
                    nodeView={definitionView.nodeView}
                    onNameChange={(newName, updatedDefinition) =>
                      controller.updateDefinition(
                        definition,
                        newName,
                        updatedDefinition
                      )
                    }
                    path={definitionView.path}
                    canDelete={definitionView.canDelete}
                    onDelete={() => controller.deleteDefinition(definition)}
                    setDefsAccordionOpen={setAccordionOpen}
                  />
                </div>
              )
            })}
            {controller.isEditable && definitionsEnabled && (
              <div className="flex items-center gap-3">
                <Input
                  placeholder="New definition name"
                  className="w-40"
                  value={controller.newDefinitionName}
                  onChange={(event) =>
                    controller.setNewDefinitionName(event.target.value)
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={controller.addNewDefinition}
                  className="p-1!"
                >
                  Add Definition
                </Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
