import * as React from "react"

import { replaceNodeJson } from "@/components/schema-editor/document/json-node"
import {
  setNodeDescription,
  setNodeTitle,
  stripDescriptions,
} from "@/components/schema-editor/document/node-metadata"
import type { SchemaDocument } from "@/components/schema-editor/document/types"
import { getDocumentNodeView } from "@/components/schema-editor/document/view-model"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type {
  ResolvedSchemaBuilderFeatures,
  SchemaDispatch,
  SchemaValidationResult,
} from "@/components/schema-editor/schema-builder-types"
import { resolveSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"
import { validationErrorsText } from "@/components/schema-editor/validation"

interface DocumentSchemaEditorControllerOptions {
  doc: SchemaDocument
  validation: SchemaValidationResult
  dispatch: SchemaDispatch
  features?: ResolvedSchemaBuilderFeatures
}

export function useDocumentSchemaEditorController({
  doc,
  validation,
  dispatch,
  features: featuresProp,
}: DocumentSchemaEditorControllerOptions) {
  const features = featuresProp ?? resolveSchemaBuilderFeatures()
  const [defsAccordionOpen, setDefsAccordionOpen] = React.useState(false)
  const draggedParentRef = React.useRef<string | null>(null)
  const draggedPropertyRef = React.useRef<string | null>(null)
  const validationErrors = React.useMemo(
    () => validationErrorsText(validation),
    [validation]
  )
  const rootNodeView = React.useMemo(
    () => getDocumentNodeView(doc, doc.root),
    [doc]
  )

  const setRootTitle = React.useCallback(
    (title: string) => {
      dispatch((current) => setNodeTitle(current, current.root.id, title))
    },
    [dispatch]
  )

  const setRootDescription = React.useCallback(
    (description: string) => {
      dispatch((current) =>
        setNodeDescription(current, current.root.id, description)
      )
    },
    [dispatch]
  )

  const eraseRootSchema = React.useCallback(() => {
    dispatch((current) =>
      replaceNodeJson(current, current.root.id, {
        title: "",
        type: "object",
        properties: {},
      })
    )
  }, [dispatch])

  const eraseDescriptions = React.useCallback(() => {
    dispatch((current) => stripDescriptions(current))
  }, [dispatch])

  const replaceRoot = React.useCallback(
    (newNode: ExtendedJSONSchema7) => {
      dispatch((current) => replaceNodeJson(current, current.root.id, newNode))
    },
    [dispatch]
  )

  return {
    features,
    defsAccordionOpen,
    setDefsAccordionOpen,
    draggedParentRef,
    draggedPropertyRef,
    validationErrors,
    rootNodeView,
    setRootTitle,
    setRootDescription,
    eraseRootSchema,
    eraseDescriptions,
    replaceRoot,
  }
}
