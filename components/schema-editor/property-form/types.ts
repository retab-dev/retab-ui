import type * as React from "react"
import type { JSONSchema7Definition, JSONSchema7Type } from "json-schema"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type {
  SchemaTypeMenuSection,
  SchemaTypeMenuTrailingContent,
  SchemaTypeMenuValue,
} from "@/components/schema-editor/primitives/schema-type-menu"

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
  resetKey?: string
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

export interface PropertyTypeFieldModel {
  ariaLabel: string
  editable: boolean
  sections: SchemaTypeMenuSection[]
  trailingContent?: SchemaTypeMenuTrailingContent
  value: SchemaTypeMenuValue
}

export interface PropertyEnumValuesFieldModel {
  values: JSONSchema7Type[]
  resetKey: string
  disabled: boolean
  onChange: (values: JSONSchema7Type[]) => void
}

export interface PropertySchemaPlanAccess {
  arrayItems: boolean
  enumValues: boolean
  objectProperties: boolean
  type: boolean
}

export interface PropertyObjectPropertiesPlan {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  mode: PropertyFormMode
  access: PropertySchemaPlanAccess
  editable: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export interface PropertySchemaPlan {
  items: PropertySchemaPlanItem[]
}

export type PropertySchemaPlanItem =
  | PropertyTypePlanItem
  | PropertyEnumPlanItem
  | PropertyObjectPropertiesPlanItem
  | PropertyArrayItemsPlanItem

export interface PropertyTypePlanItem {
  kind: "type"
  field: PropertyTypeFieldModel
}

export interface PropertyEnumPlanItem {
  kind: "enumValues"
  field: PropertyEnumValuesFieldModel
}

export interface PropertyObjectPropertiesPlanItem {
  kind: "objectProperties"
  plan: PropertyObjectPropertiesPlan
}

export interface PropertyArrayItemsPlanItem {
  kind: "arrayItems"
  itemSchemaPlan: PropertySchemaPlan
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
    type: PropertyTypeFieldModel
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
    schemaPlan?: PropertySchemaPlan
  }
  footer: PropertyFormFooterModel
  events: {
    submit: () => Promise<boolean>
    keyDown: (event: React.KeyboardEvent) => void
  }
}
