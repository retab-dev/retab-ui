import type { SchemaAddInputModel } from "@/components/schema-editor/primitives/schema-add-input-model"
import type {
  PropertySchemaPlan,
  PropertyTypeFieldModel,
} from "@/components/schema-editor/property-form/types"

export interface PropertyObjectPropertiesFieldModel {
  addInput: SchemaAddInputModel
  editable: boolean
  rows: ObjectPropertyRowModel[]
}

export interface ObjectPropertyRowModel {
  id: string
  name: string
  schemaPlan: PropertySchemaPlan
  nameField: ObjectPropertyNameFieldModel
  descriptionField: ObjectPropertyDescriptionFieldModel
  reorder: ObjectPropertyRowReorderModel
  typeField: PropertyTypeFieldModel
  deleteAction: {
    label: string
    onDelete: () => void
  }
}

export interface ObjectPropertyNameFieldModel {
  ariaLabel: string
  value: string
  editable: boolean
  validate: (value: string) => string | null
  onCommit: (name: string) => void
}

export interface ObjectPropertyDescriptionFieldModel {
  ariaLabel: string
  value: string
  editable: boolean
  onCommit: (description: string) => void
}

export interface ObjectPropertyRowReorderModel {
  canMoveDown: boolean
  canMoveUp: boolean
  move: (targetIndex: number) => void
  moveDown: () => void
  moveUp: () => void
  moveDownLabel: string
  moveUpLabel: string
  position: number
  rowCount: number
}
