"use client"

import * as React from "react"

import { buildCommittedDraft } from "@/components/schema-editor/property-form/model/property-draft-commit"
import { normalizeValidationForCapabilities } from "@/components/schema-editor/property-form/model/property-validation"
import type {
  PropertyCapabilities,
  PropertyDraft,
  PropertyFormProps,
  PropertyFormSchemaContext,
  PropertyValidation,
} from "@/components/schema-editor/property-form/types"
import { validatePropertyDraft } from "@/components/schema-editor/property-form/validation"

interface UsePropertyFormSubmitInput {
  capabilities: PropertyCapabilities
  propertyDraftRef: React.MutableRefObject<PropertyDraft>
  schemaContext: PropertyFormSchemaContext
  validation?: PropertyValidation
  onCommitPropertyDraft: PropertyFormProps["onCommitPropertyDraft"]
}

export function usePropertyFormSubmit({
  capabilities,
  propertyDraftRef,
  schemaContext,
  validation,
  onCommitPropertyDraft,
}: UsePropertyFormSubmitInput) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isSubmittingRef = React.useRef(false)

  const commitPropertyDraft = React.useCallback(async () => {
    if (isSubmittingRef.current) return false
    if (capabilities.mode === "readOnly") return false

    const currentPropertyDraft = propertyDraftRef.current
    const currentValidation = normalizeValidationForCapabilities({
      validation:
        validation ??
        validatePropertyDraft({
          propertyDraft: currentPropertyDraft,
          schemaContext,
        }),
      capabilities,
    })
    if (!currentValidation.canCommit) return false

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      await onCommitPropertyDraft(buildCommittedDraft(currentPropertyDraft))
      return true
    } catch {
      return false
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }, [
    capabilities,
    onCommitPropertyDraft,
    propertyDraftRef,
    schemaContext,
    validation,
  ])

  return {
    commitPropertyDraft,
    isSubmitting,
  }
}
