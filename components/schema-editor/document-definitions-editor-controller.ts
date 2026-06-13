import * as React from "react"
import { toast } from "sonner"

import type {
  DocumentSchemaNodeEditorProps,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
import { nodeFromJson } from "@/components/schema-editor/document/convert"
import {
  addDefinition,
  removeDefinition,
  renameDefinition,
} from "@/components/schema-editor/document/definition-operations"
import { isDefinitionReferenced } from "@/components/schema-editor/document/derive"
import { replaceNodeJson } from "@/components/schema-editor/document/json-node"
import { definitionRef } from "@/components/schema-editor/document/json-pointer"
import type {
  DefinitionEntry,
  SchemaDocument,
} from "@/components/schema-editor/document/types"
import { getDocumentNodeView } from "@/components/schema-editor/document/view-model"
import type { SchemaDispatch } from "@/components/schema-editor/schema-builder-types"

interface DocumentDefinitionsEditorControllerOptions {
  dispatch: SchemaDispatch
  doc: SchemaDocument
  editMode: SchemaEditorMode
  definitionsEnabled: boolean
  accordionOpen: boolean
  setAccordionOpen: (open: boolean) => void
}

export function useDocumentDefinitionsEditorController({
  dispatch,
  doc,
  editMode,
  definitionsEnabled,
  accordionOpen,
  setAccordionOpen,
}: DocumentDefinitionsEditorControllerOptions) {
  const [newDefinitionName, setNewDefinitionName] = React.useState("")
  const isEditable = editMode === "editable"
  const shouldShowClosedPrompt =
    doc.defs.length === 0 && (!accordionOpen || !definitionsEnabled)
  const accordionValue = accordionOpen ? "defs" : ""

  const openDefinitions = React.useCallback(() => {
    setAccordionOpen(true)
  }, [setAccordionOpen])

  const addNewDefinition = React.useCallback(() => {
    const definitionName = newDefinitionName.trim()
    if (!definitionName) return

    dispatch(
      (current) =>
        addDefinition(current, {
          name: definitionName,
          node: nodeFromJson(
            { type: "object", properties: {}, required: [] },
            current
          ),
        }).doc
    )
    setNewDefinitionName("")
    setAccordionOpen(true)
  }, [dispatch, newDefinitionName, setAccordionOpen])

  const deleteDefinition = React.useCallback(
    (definition: DefinitionEntry) => {
      if (
        isDefinitionReferenced(doc, definition.id, {
          exceptDefId: definition.id,
        })
      ) {
        toast.error(
          `Cannot delete "${definition.name}" because it is referenced by one or more $ref properties. Remove or update those references first.`
        )
        return
      }

      dispatch((current) => removeDefinition(current, definition.id))
      if (doc.defs.length <= 1) {
        setAccordionOpen(false)
      }
    },
    [dispatch, doc, setAccordionOpen]
  )

  const updateDefinition = React.useCallback(
    (
      definition: DefinitionEntry,
      newName: string,
      updatedDefinition?: Parameters<
        NonNullable<DocumentSchemaNodeEditorProps["onNameChange"]>
      >[1]
    ) => {
      if (newName === definition.name && !updatedDefinition) return

      dispatch((current) => {
        let next = current
        if (newName !== definition.name) {
          next = renameDefinition(next, definition.id, newName)
        }
        if (updatedDefinition) {
          next = replaceNodeJson(next, definition.node.id, updatedDefinition)
        }
        return next
      })
    },
    [dispatch]
  )

  const definitionViews = React.useMemo(
    () =>
      doc.defs.map((definition) => ({
        definition,
        nodeView: getDocumentNodeView(doc, definition.node),
        path: definitionRef("$defs", definition.name),
        canDelete: !isDefinitionReferenced(doc, definition.id, {
          exceptDefId: definition.id,
        }),
      })),
    [doc]
  )

  return {
    accordionValue,
    definitionViews,
    isEditable,
    newDefinitionName,
    setNewDefinitionName,
    shouldShowClosedPrompt,
    openDefinitions,
    addNewDefinition,
    deleteDefinition,
    updateDefinition,
  }
}
