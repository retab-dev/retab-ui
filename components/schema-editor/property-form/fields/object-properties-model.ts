"use client"

import * as React from "react"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { moveOrderedItem } from "@/components/schema-editor/primitives/schema-order"
import {
  createObjectPropertySchema,
  isSchemaNode,
  listObjectPropertyNames,
  moveObjectProperty,
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import type {
  PropertyFormMode,
  PropertyObjectPropertiesFieldModel,
  PropertyObjectPropertiesSourceModel,
  PropertyFormSchemaContext,
  PropertySchemaDetailAccess,
  PropertySchemaDetailsModel,
  PropertyTypeFieldModel,
} from "@/components/schema-editor/property-form/types"
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation"

import { createObjectPropertyRowDetails } from "./object-property-row-details"
import { useObjectPropertyRowIdentity } from "./object-property-row-identity"
import { createPropertyTypeFieldWithObjectTemplates } from "./property-object-template-type-field"

export interface ObjectPropertyRowModel {
  id: string
  name: string
  rowSchemaDetails: PropertySchemaDetailsModel
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

export interface ObjectPropertyAddRowModel {
  error: string | null
  inputLabel: string
  placeholder: string
  submitLabel: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export function useObjectPropertiesModel({
  access,
  editable,
  mode,
  schemaNode,
  schemaContext,
  onChange,
}: PropertyObjectPropertiesSourceModel): PropertyObjectPropertiesFieldModel {
  const [newPropertyName, setNewPropertyName] = React.useState("")
  const propertyNames = listObjectPropertyNames(schemaNode)
  const resetNewPropertyName = React.useCallback(() => {
    setNewPropertyName("")
  }, [])
  const rowIdentity = useObjectPropertyRowIdentity({
    onExternalPropertyNamesChange: resetNewPropertyName,
    propertyNames,
    resetKey: schemaContext.resetKey ?? schemaContext.originalName,
  })
  const trimmedNewPropertyName = newPropertyName.trim()
  const newPropertyNameError = trimmedNewPropertyName
    ? validatePropertyFormName({
        name: trimmedNewPropertyName,
        siblingNames: propertyNames,
        originalName: "",
      })
    : null

  const replacePropertySchemaNode = (
    name: string,
    propertySchema: ExtendedJSONSchema7
  ) => {
    onChange(
      replaceObjectProperty({
        schemaNode,
        propertyName: name,
        propertySchema,
      })
    )
  }

  const rows: ObjectPropertyRowModel[] = propertyNames.flatMap(
    (name, index) => {
      const propertySchema = schemaNode.properties?.[name]
      if (!isSchemaNode(propertySchema)) return []

      const id = rowIdentity.getRowId(name)
      const replaceSchemaNode = (nextSchemaNode: ExtendedJSONSchema7) => {
        replacePropertySchemaNode(name, nextSchemaNode)
      }
      const move = (targetIndex: number) => {
        rowIdentity.preserveAddRowForLocalPropertyNames(
          moveOrderedItem({
            items: propertyNames,
            sourceIndex: index,
            targetIndex,
          })
        )
        onChange(
          moveObjectProperty({
            schemaNode,
            propertyName: name,
            targetIndex,
          })
        )
      }
      const rowSchemaContext = {
        ...schemaContext,
        siblingNames: propertyNames,
        originalName: name,
        fieldPath: [
          schemaContext.fieldPath ?? schemaContext.originalName,
          id,
        ].join("."),
        resetKey: [
          schemaContext.resetKey ??
            schemaContext.fieldPath ??
            schemaContext.originalName,
          id,
        ].join("."),
      }

      return [
        {
          id,
          rowSchemaDetails: createObjectPropertyRowDetails({
            access,
            editable,
            mode,
            schemaNode: propertySchema,
            schemaContext: rowSchemaContext,
            onChange: replaceSchemaNode,
          }),
          name,
          nameField: {
            ariaLabel: `Field name ${name}`,
            value: name,
            editable,
            validate: (value: string) =>
              validatePropertyFormName({
                name: value,
                siblingNames: propertyNames,
                originalName: name,
              }),
            onCommit: (nextName: string) => {
              rowIdentity.preserveAddRowForLocalPropertyNames(
                propertyNames.map((propertyName) =>
                  propertyName === name ? nextName : propertyName
                )
              )
              rowIdentity.renameRowId(name, nextName)
              onChange(
                renameObjectProperty({
                  schemaNode,
                  oldName: name,
                  newName: nextName,
                })
              )
            },
          },
          descriptionField: {
            ariaLabel: `Description for ${name}`,
            value: propertySchema.description || "",
            editable,
            onCommit: (description: string) => {
              replaceSchemaNode({
                ...propertySchema,
                description: description || undefined,
              })
            },
          },
          reorder: {
            canMoveDown: editable && index < propertyNames.length - 1,
            canMoveUp: editable && index > 0,
            move,
            moveDown: () => {
              if (index < propertyNames.length - 1) move(index + 1)
            },
            moveUp: () => {
              if (index > 0) move(index - 1)
            },
            moveDownLabel: `Move field ${name} down`,
            moveUpLabel: `Move field ${name} up`,
            position: index + 1,
            rowCount: propertyNames.length,
          },
          typeField: createPropertyTypeFieldWithObjectTemplates({
            schemaNode: propertySchema,
            schemaContext: rowSchemaContext,
            editable: editable && access.type,
            onChange: replaceSchemaNode,
          }),
          deleteAction: {
            label: `Remove field ${name}`,
            onDelete: () => {
              rowIdentity.preserveAddRowForLocalPropertyNames(
                propertyNames.filter((propertyName) => propertyName !== name)
              )
              rowIdentity.removeRowId(name)
              onChange(removeObjectProperty({ schemaNode, propertyName: name }))
            },
          },
        },
      ]
    }
  )

  const addRow: ObjectPropertyAddRowModel = {
    error: newPropertyNameError,
    inputLabel: "New object field",
    placeholder: "New property name",
    submitLabel: "Add",
    value: newPropertyName,
    onChange: setNewPropertyName,
    onSubmit: () => {
      if (!trimmedNewPropertyName || newPropertyNameError) return
      rowIdentity.preserveAddRowForLocalPropertyNames([
        ...propertyNames,
        trimmedNewPropertyName,
      ])
      rowIdentity.addRowId(trimmedNewPropertyName)
      replacePropertySchemaNode(
        trimmedNewPropertyName,
        createObjectPropertySchema(trimmedNewPropertyName)
      )
      setNewPropertyName("")
    },
  }

  return {
    addRow,
    editable,
    rows,
  }
}
