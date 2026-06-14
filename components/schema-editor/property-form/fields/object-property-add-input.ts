import type { SchemaAddInputModel } from "@/components/schema-editor/primitives/schema-add-input-model"
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation"

export interface ObjectPropertyAddInputState {
  propertyNames: string[]
  value: string
  setValue: (value: string) => void
}

export function createObjectPropertyAddInput({
  onSubmit,
  state,
}: {
  onSubmit: (propertyName: string) => void
  state: ObjectPropertyAddInputState
}): SchemaAddInputModel {
  const trimmedValue = state.value.trim()
  const error = trimmedValue
    ? validatePropertyFormName({
        name: trimmedValue,
        siblingNames: state.propertyNames,
        originalName: "",
      })
    : null

  return {
    error,
    inputLabel: "New object field",
    placeholder: "New property name",
    submitLabel: "Add",
    value: state.value,
    onChange: state.setValue,
    onSubmit: () => {
      if (!trimmedValue || error) return
      onSubmit(trimmedValue)
    },
  }
}
