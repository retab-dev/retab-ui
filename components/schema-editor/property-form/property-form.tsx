"use client"

import { usePropertyFormController } from "@/components/schema-editor/property-form/property-form-controller"
import { PropertyFormShell } from "@/components/schema-editor/property-form/property-form-shell"
import type { PropertyFormProps } from "@/components/schema-editor/property-form/types"

export function PropertyForm(props: PropertyFormProps) {
  const mode = props.mode ?? "editable"

  const viewModel = usePropertyFormController({
    propertyDraft: props.propertyDraft,
    schemaContext: props.schemaContext,
    capabilities: props.capabilities,
    validation: props.validation,
    mode,
    submitLabel: props.submitLabel ?? "Save Changes",
    canDelete: Boolean(props.onDelete),
    onPropertyDraftChange: props.onPropertyDraftChange,
    onCommitPropertyDraft: props.onCommitPropertyDraft,
    onCancel: props.onCancel,
    onDelete: props.onDelete,
  })

  return <PropertyFormShell viewModel={viewModel} />
}
