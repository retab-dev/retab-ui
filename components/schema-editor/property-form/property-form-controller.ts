"use client"

import * as React from "react"

import { getEffectiveType } from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import { resolvePropertyCapabilities } from "@/components/schema-editor/property-form/model/property-capabilities"
import { buildCommittedDraft } from "@/components/schema-editor/property-form/model/property-draft-commit"
import { propertyDraftReducer } from "@/components/schema-editor/property-form/reducer"
import type {
  PropertyDraftOperation,
  PropertyFormMode,
  PropertyFormProps,
  PropertyFormViewModel,
} from "@/components/schema-editor/property-form/types"
import { validatePropertyDraft } from "@/components/schema-editor/property-form/validation"

type PropertyFormControllerInput = Omit<
  PropertyFormProps,
  "mode" | "submitLabel"
> & {
  mode: PropertyFormMode
  submitLabel: string
  canDelete: boolean
}

export function usePropertyFormController({
  propertyDraft: initialPropertyDraft,
  schemaContext,
  capabilities: capabilitiesProp,
  validation: validationProp,
  mode,
  submitLabel,
  canDelete,
  onPropertyDraftChange,
  onCommitPropertyDraft,
  onCancel,
  onDelete,
}: PropertyFormControllerInput): PropertyFormViewModel {
  const [propertyDraft, setPropertyDraft] =
    React.useState(initialPropertyDraft)
  const propertyDraftRef = React.useRef(initialPropertyDraft)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isSubmittingRef = React.useRef(false)

  React.useEffect(() => {
    propertyDraftRef.current = initialPropertyDraft
    setPropertyDraft(initialPropertyDraft)
  }, [initialPropertyDraft])

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
      schemaContext,
    })
  const effectiveSchemaNode = getEffectiveNode(propertyDraft.schemaNode)
  const effectiveType = getEffectiveType(propertyDraft.schemaNode)

  const updatePropertyDraft = React.useCallback(
    (operation: PropertyDraftOperation) => {
      const nextPropertyDraft = propertyDraftReducer(
        propertyDraftRef.current,
        operation
      )
      propertyDraftRef.current = nextPropertyDraft
      setPropertyDraft(nextPropertyDraft)
      onPropertyDraftChange?.(nextPropertyDraft)
    },
    [onPropertyDraftChange]
  )

  const commitPropertyDraft = React.useCallback(async () => {
    if (isSubmittingRef.current) return false

    const currentPropertyDraft = propertyDraftRef.current
    const currentValidation = validatePropertyDraft({
      propertyDraft: currentPropertyDraft,
      schemaContext,
    })
    if (!currentValidation.canCommit) return false

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      await onCommitPropertyDraft(buildCommittedDraft(currentPropertyDraft))
      return true
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }, [onCommitPropertyDraft, schemaContext])

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
  const showEnumValues =
    capabilities.canEditEnumValues && effectiveType.type === "enum"
  const showSchemaNodeDetails =
    showEnumValues || showObjectFields || showArrayItems

  return {
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
        schemaNode: propertyDraft.schemaNode,
        schemaContext,
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
      schemaNodeDetails: showSchemaNodeDetails
        ? {
            schemaNode: propertyDraft.schemaNode,
            schemaContext,
            mode: editMode,
            disabled:
              !capabilities.canEditEnumValues &&
              !capabilities.canEditNestedObject &&
              !capabilities.canEditArrayItems,
            onChange: (schemaNode) =>
              updatePropertyDraft({
                type: "replacePropertySchemaNode",
                schemaNode,
              }),
          }
        : undefined,
    },
    footer: {
      canDelete: capabilities.canDelete,
      isSubmitting,
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
