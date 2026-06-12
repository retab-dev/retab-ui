import * as React from "react"
import type { JSONSchema7Definition } from "json-schema"

import {
  revealDefinitionElement,
  revealDefinitionsSection,
} from "@/components/schema-editor/document-node-reveal"
import { projectNode } from "@/components/schema-editor/document/convert"
import { setRefByName } from "@/components/schema-editor/document/definition-operations"
import { setEnumValues } from "@/components/schema-editor/document/enum-operations"
import { setNodeDescription } from "@/components/schema-editor/document/node-metadata"
import {
  setNodeEditorType,
  type SchemaEditorType,
} from "@/components/schema-editor/document/type-operations"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type { DocumentNodeView } from "@/components/schema-editor/document/view-model"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type { PropertyFormCommand } from "@/components/schema-editor/property-form/types"
import type { SchemaDispatch } from "@/components/schema-editor/schema-builder-types"

interface DocumentNodeHeaderControllerOptions {
  dispatch: SchemaDispatch
  doc: SchemaDocument
  nodeId: string
  nodeView: DocumentNodeView
  setDefsAccordionOpen: (open: boolean) => void
}

export function useDocumentNodeHeaderController({
  dispatch,
  doc,
  nodeId,
  nodeView,
  setDefsAccordionOpen,
}: DocumentNodeHeaderControllerOptions) {
  const schemaNode = projectNode(doc, nodeView.docNode) as ExtendedJSONSchema7
  const defs = React.useMemo(() => {
    const next: Record<string, JSONSchema7Definition> = {}
    for (const definition of doc.defs) {
      next[definition.name] = projectNode(doc, definition.node)
    }
    return next
  }, [doc])
  const localType = nodeView.type
  const description = nodeView.description || ""
  const refName = localType === "$ref" ? nodeView.refName : undefined

  const [metadataDialogOpen, setMetadataDialogOpen] = React.useState(false)
  const [enumCreationDialogOpen, setEnumCreationDialogOpen] =
    React.useState(false)

  const showDefinition = React.useCallback(
    (definitionName: string) => {
      setDefsAccordionOpen(true)
      const definition = doc.defs.find((def) => def.name === definitionName)
      if (definition) {
        revealDefinitionElement(definition.id)
      }
    },
    [doc.defs, setDefsAccordionOpen]
  )

  const showDefinitionsSection = React.useCallback(() => {
    setDefsAccordionOpen(true)
    revealDefinitionsSection()
  }, [setDefsAccordionOpen])

  const selectType = React.useCallback(
    (newType: SchemaEditorType | "enum") => {
      if (newType === "enum") {
        if (localType !== "enum") {
          setEnumCreationDialogOpen(true)
        }
        return
      }
      dispatch((current) =>
        setNodeEditorType(current, nodeId, newType as SchemaEditorType)
      )
    },
    [dispatch, localType, nodeId]
  )

  const confirmEnumValues = React.useCallback(
    (enumValues: string[]) => {
      dispatch((current) => setEnumValues(current, nodeId, enumValues))
    },
    [dispatch, nodeId]
  )

  const submitDescription = React.useCallback(
    (nextDescription: string) => {
      dispatch((current) =>
        setNodeDescription(current, nodeId, nextDescription || undefined)
      )
    },
    [dispatch, nodeId]
  )

  const selectDefinition = React.useCallback(
    (definitionName: string) => {
      dispatch((current) => setRefByName(current, nodeId, definitionName))
    },
    [dispatch, nodeId]
  )

  const selectObjectTemplate = React.useCallback(
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

  const handlePropertyFormCommand = React.useCallback(
    async (command: PropertyFormCommand) => {
      if (command.type === "createDefinition") {
        showDefinitionsSection()
        return
      }

      if (command.type === "installObjectTemplate") {
        const { addObjectTemplateDefinitionsToDocument } =
          await import("./optional/object-templates/object-template-reference")
        dispatch((current) =>
          addObjectTemplateDefinitionsToDocument(current, command.templateName)
        )
      }
    },
    [dispatch, showDefinitionsSection]
  )

  return {
    schemaNode,
    defs,
    localType,
    description,
    refName,
    metadataDialogOpen,
    setMetadataDialogOpen,
    enumCreationDialogOpen,
    setEnumCreationDialogOpen,
    showDefinition,
    showDefinitionsSection,
    selectType,
    confirmEnumValues,
    submitDescription,
    selectDefinition,
    selectObjectTemplate,
    handlePropertyFormCommand,
  }
}
