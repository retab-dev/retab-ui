import type * as React from "react"
import type { JSONSchema7Definition } from "json-schema"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

export type PropertyFormMode = "descriptionOnly" | "readOnly" | "editable"

export interface PropertyDraft {
  name: string
  schemaNode: ExtendedJSONSchema7
}

export interface FieldValidation {
  status: "valid" | "invalid" | "warning"
  message?: string
  code?: string
}

export interface NodeValidation {
  status: "valid" | "invalid" | "warning"
  message?: string
  code?: string
}

export interface PropertyValidation {
  name: FieldValidation
  schemaNode: NodeValidation
  canCommit: boolean
}

export interface PropertyCapabilities {
  mode: PropertyFormMode
  canEditName: boolean
  canEditType: boolean
  canEditNullable: boolean
  canEditDescription: boolean
  canEditNestedObject: boolean
  canEditArrayItems: boolean
  canEditEnumValues: boolean
  canDelete: boolean
}

export type PropertyFormCommand =
  | { type: "createDefinition" }
  | { type: "selectDefinition"; definitionName: string }
  | { type: "installObjectTemplate"; templateName: string }

export interface PropertyFormSchemaContext {
  siblingNames: string[]
  originalName: string
  schemaDefinitions: Record<string, JSONSchema7Definition>
  fieldPath?: string
  objectTemplatesEnabled?: boolean
  onCommand?: (command: PropertyFormCommand) => void | Promise<void>
}

export interface PropertyFormProps {
  propertyDraft: PropertyDraft
  schemaContext: PropertyFormSchemaContext
  capabilities?: PropertyCapabilities
  validation?: PropertyValidation
  mode?: PropertyFormMode
  submitLabel?: string
  onPropertyDraftChange?: (propertyDraft: PropertyDraft) => void
  onCommitPropertyDraft: (propertyDraft: PropertyDraft) => void | Promise<void>
  onCancel?: () => void
  onDelete?: () => void
}

export type PropertyDraftOperation =
  | { type: "renameProperty"; name: string }
  | { type: "setPropertyDescription"; description: string }
  | { type: "setPropertyNullable"; isNullable: boolean }
  | { type: "replacePropertySchemaNode"; schemaNode: ExtendedJSONSchema7 }

export interface PropertyFormFooterModel {
  canDelete: boolean
  isSubmitting: boolean
  isSubmitDisabled: boolean
  submitLabel: string
  onCancel?: () => void
  onDelete?: () => void
}

export interface PropertyFormViewModel {
  validation: PropertyValidation
  capabilities: PropertyCapabilities
  fields: {
    name: {
      value: string
      validation: FieldValidation
      disabled: boolean
      onChange: (name: string) => void
    }
    type: {
      schemaNode: ExtendedJSONSchema7
      schemaContext: PropertyFormSchemaContext
      mode: PropertyFormMode
      disabled: boolean
      onChange: (schemaNode: ExtendedJSONSchema7) => void
    }
    nullable: {
      isNullable: boolean
      disabled: boolean
      onChange: (isNullable: boolean) => void
    }
    description: {
      value: string
      disabled: boolean
      onChange: (description: string) => void
    }
    schemaNodeDetails?: {
      schemaNode: ExtendedJSONSchema7
      schemaContext: PropertyFormSchemaContext
      mode: PropertyFormMode
      disabled: boolean
      onChange: (schemaNode: ExtendedJSONSchema7) => void
    }
  }
  footer: PropertyFormFooterModel
  events: {
    submit: () => Promise<boolean>
    keyDown: (event: React.KeyboardEvent) => void
  }
}
