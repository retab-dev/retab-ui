"use client"

import { usePropertyFormController } from "@/components/schema-editor/property-form/property-form-controller"
import { PropertyFormShell } from "@/components/schema-editor/property-form/property-form-shell"
import type { PropertyFormProps } from "@/components/schema-editor/property-form/types"

export function PropertyForm(props: PropertyFormProps) {
  const mode = props.mode ?? "editable"
  const isFinalProps = "draft" in props
  const draft = isFinalProps ? props.draft : props.propertyDraft
  const context = isFinalProps ? props.context : props.schemaContext
  const onDraftChange = isFinalProps
    ? props.onDraftChange
    : props.onPropertyDraftChange
  const onCommit = isFinalProps ? props.onCommit : props.onCommitPropertyDraft

  const viewModel = usePropertyFormController({
    draft,
    context,
    capabilities: props.capabilities,
    validation: props.validation,
    mode,
    submitLabel: props.submitLabel ?? "Save Changes",
    canDelete: Boolean(props.onDelete),
    onDraftChange,
    onCommit,
    onCancel: props.onCancel,
    onDelete: props.onDelete,
  })

  return <PropertyFormShell viewModel={viewModel} />
}
