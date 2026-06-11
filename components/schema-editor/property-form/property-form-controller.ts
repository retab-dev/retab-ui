"use client"

import * as React from "react"

import { getEffectiveType } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { buildCommittedDraft } from "@/components/schema-editor/property-form/model/property-draft-commit"
import { resolvePropertyCapabilities } from "@/components/schema-editor/property-form/model/property-capabilities"
import { getArrayItemsForDraft } from "@/components/schema-editor/property-form/model/effective-node-edits"
import {
  propertyDraftReducer,
} from "@/components/schema-editor/property-form/reducer"
import type {
  PropertyCapabilities,
  PropertyDraft,
  PropertyDraftOperation,
  PropertyFormMode,
  PropertyFormSchemaContext,
  PropertyFormViewModel,
  PropertyValidation,
} from "@/components/schema-editor/property-form/types"
import { validatePropertyDraft } from "@/components/schema-editor/property-form/validation"

export function usePropertyFormController({
  draft: initialDraft,
  context,
  capabilities: capabilitiesProp,
  validation: validationProp,
  mode,
  submitLabel,
  canDelete,
  onDraftChange,
  onCommit,
  onCancel,
  onDelete,
}: {
  draft: PropertyDraft
  context: PropertyFormSchemaContext
  capabilities?: PropertyCapabilities
  validation?: PropertyValidation
  mode: PropertyFormMode
  submitLabel: string
  canDelete: boolean
  onDraftChange?: (draft: PropertyDraft) => void
  onCommit: (draft: PropertyDraft) => void | Promise<void>
  onCancel?: () => void
  onDelete?: () => void
}): PropertyFormViewModel {
  const [propertyDraft, setPropertyDraft] = React.useState(initialDraft)

  React.useEffect(() => {
    setPropertyDraft(initialDraft)
  }, [initialDraft])

  const capabilities = React.useMemo(
    () =>
      capabilitiesProp ??
      resolvePropertyCapabilities({
        mode,
        canDelete,
      }),
    [canDelete, capabilitiesProp, mode]
  )

  const validation =
    validationProp ??
    validatePropertyDraft({
      propertyDraft,
      schemaContext: context,
    })
  const effectiveSchemaNode = getEffectiveNode(propertyDraft.schemaNode)
  const effectiveType = getEffectiveType(propertyDraft.schemaNode)
  const arrayItemSchemaNode = getArrayItemsForDraft(propertyDraft.schemaNode)

  const updatePropertyDraft = React.useCallback(
    (operation: PropertyDraftOperation) => {
      setPropertyDraft((currentPropertyDraft) => {
        const nextPropertyDraft = propertyDraftReducer(
          currentPropertyDraft,
          operation
        )
        onDraftChange?.(nextPropertyDraft)
        return nextPropertyDraft
      })
    },
    [onDraftChange]
  )

  const commitPropertyDraft = React.useCallback(async () => {
    const currentValidation = validatePropertyDraft({
      propertyDraft,
      schemaContext: context,
    })
    if (!currentValidation.canCommit) return false

    await onCommit(buildCommittedDraft(propertyDraft))
    return true
  }, [onCommit, propertyDraft, context])

  const keyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return
      if (event.target instanceof HTMLTextAreaElement) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          void commitPropertyDraft()
        }
        return
      }
      event.preventDefault()
      void commitPropertyDraft()
    },
    [commitPropertyDraft]
  )

  const editMode = capabilities.mode
  const showObjectFields =
    capabilities.canEditNestedObject &&
    effectiveType.type === "object" &&
    !effectiveSchemaNode.$ref
  const showArrayItems =
    capabilities.canEditArrayItems && effectiveType.type === "array"
  const enumValues = Array.isArray(effectiveSchemaNode.enum)
    ? effectiveSchemaNode.enum
    : []

  return {
    propertyDraft,
    effectiveSchemaNode,
    validation,
    capabilities,
    fields: {
      name: {
        value: propertyDraft.name,
        validation: validation.name,
        disabled: !capabilities.canEditName,
        onChange: (name) =>
          updatePropertyDraft({
            type: "renameProperty",
            name,
          }),
      },
      type: {
        name: propertyDraft.name,
        schemaNode: propertyDraft.schemaNode,
        schemaContext: context,
        mode: editMode,
        disabled: !capabilities.canEditType,
        onChange: (schemaNode: ExtendedJSONSchema7) =>
          updatePropertyDraft({
            type: "replacePropertySchemaNode",
            schemaNode,
          }),
      },
      nullable: {
        isNullable: effectiveType.isNullable,
        disabled: !capabilities.canEditNullable,
        onChange: (isNullable) =>
          updatePropertyDraft({
            type: "setPropertyNullable",
            isNullable,
          }),
      },
      description: {
        value: propertyDraft.schemaNode.description || "",
        disabled: !capabilities.canEditDescription,
        onChange: (description) =>
          updatePropertyDraft({
            type: "setPropertyDescription",
            description,
          }),
      },
      enumValues:
        capabilities.canEditEnumValues && effectiveType.type === "enum"
          ? {
              values: enumValues,
              disabled: !capabilities.canEditEnumValues,
              onChange: (values) =>
                updatePropertyDraft({
                  type: "setEnumValues",
                  values,
                }),
            }
          : undefined,
      objectFields: showObjectFields
          ? {
            name: propertyDraft.name,
            schemaNode: effectiveSchemaNode,
            schemaContext: context,
            onChange: (schemaNode) =>
              updatePropertyDraft({
                type: "replaceEffectiveSchemaNode",
                schemaNode,
              }),
          }
        : undefined,
      arrayItems: showArrayItems
          ? {
            schemaNode: arrayItemSchemaNode,
            schemaContext: context,
            onChange: (schemaNode) =>
              updatePropertyDraft({
                type: "setArrayItemSchemaNode",
                schemaNode,
              }),
          }
        : undefined,
    },
    footer: {
      canDelete: capabilities.canDelete,
      isSubmitDisabled: !validation.canCommit,
      submitLabel,
      onCancel,
      onDelete,
    },
    events: {
      submit: commitPropertyDraft,
      keyDown,
    },
  }
}
