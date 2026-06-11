import type * as React from "react"
import type { JSONSchema7Definition, JSONSchema7Type } from "json-schema"

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

export interface PropertyFormFinalProps {
  draft: PropertyDraft
  context: PropertyFormSchemaContext
  capabilities?: PropertyCapabilities
  validation?: PropertyValidation
  mode?: PropertyFormMode
  submitLabel?: string
  onDraftChange?: (draft: PropertyDraft) => void
  onCommit: (draft: PropertyDraft) => void | Promise<void>
  onCancel?: () => void
  onDelete?: () => void
}

export interface PropertyFormLegacyProps {
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

export type PropertyFormProps = PropertyFormFinalProps | PropertyFormLegacyProps

export type PropertyFormContext = PropertyFormSchemaContext

export type PropertySchemaNodeType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "enum"
  | "object"
  | "array"
  | "date"
  | "time"
  | "datetime"
  | "$ref"

export type PropertyDraftOperation =
  | { type: "resetPropertyDraft"; propertyDraft: PropertyDraft }
  | { type: "renameProperty"; name: string }
  | { type: "setPropertyDescription"; description: string }
  | { type: "setPropertyNullable"; isNullable: boolean }
  | { type: "setPropertyType"; schemaNodeType: PropertySchemaNodeType }
  | { type: "setEnumValues"; values: JSONSchema7Type[] }
  | { type: "setArrayItemSchemaNode"; schemaNode: ExtendedJSONSchema7 }
  | { type: "replaceEffectiveSchemaNode"; schemaNode: ExtendedJSONSchema7 }
  | { type: "replacePropertySchemaNode"; schemaNode: ExtendedJSONSchema7 }

export interface PropertyFormFooterModel {
  canDelete: boolean
  isSubmitDisabled: boolean
  submitLabel: string
  onCancel?: () => void
  onDelete?: () => void
}

export interface PropertyFormViewModel {
  propertyDraft: PropertyDraft
  effectiveSchemaNode: ExtendedJSONSchema7
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
      name: string
      schemaNode: ExtendedJSONSchema7
      schemaContext: PropertyFormSchemaContext
      mode: PropertyFormMode
      disabled: boolean
      onChange: (schemaNode: ExtendedJSONSchema7) => void
    }
    enumValues?: {
      values: JSONSchema7Type[]
      disabled: boolean
      onChange: (values: JSONSchema7Type[]) => void
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
    objectFields?: {
      name: string
      schemaNode: ExtendedJSONSchema7
      schemaContext: PropertyFormSchemaContext
      onChange: (schemaNode: ExtendedJSONSchema7) => void
    }
    arrayItems?: {
      schemaNode: ExtendedJSONSchema7
      schemaContext: PropertyFormSchemaContext
      onChange: (schemaNode: ExtendedJSONSchema7) => void
    }
  }
  footer: PropertyFormFooterModel
  events: {
    submit: () => Promise<boolean>
    keyDown: (event: React.KeyboardEvent) => void
  }
}
