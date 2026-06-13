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
  PropertyFormSchemaContext,
  PropertySchemaDetailAccess,
  PropertySchemaDetailsModel,
  PropertyTypeFieldModel,
} from "@/components/schema-editor/property-form/types"
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation"

import { createObjectPropertyRowDetails } from "./object-property-row-details"
import { createPropertyTypeField } from "./property-type-menu-model"

interface UseObjectPropertiesModelInput {
  access: PropertySchemaDetailAccess
  editable: boolean
  mode: PropertyFormMode
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export interface ObjectPropertiesModel {
  addRow: ObjectPropertyAddRowModel
  editable: boolean
  rows: ObjectPropertyRowModel[]
}

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
}: UseObjectPropertiesModelInput): ObjectPropertiesModel {
  const [newPropertyName, setNewPropertyName] = React.useState("")
  const propertyNames = listObjectPropertyNames(schemaNode)
  const propertyNamesKey = getPropertyNamesKey(propertyNames)
  const localPropertyNamesKeyRef = React.useRef<string | null>(null)
  const [rowIdsByName, setRowIdsByName] = React.useState(() =>
    createRowIdsByName(propertyNames)
  )
  const nextRowIdRef = React.useRef(propertyNames.length)
  const trimmedNewPropertyName = newPropertyName.trim()
  const newPropertyNameError = trimmedNewPropertyName
    ? validatePropertyFormName({
        name: trimmedNewPropertyName,
        siblingNames: propertyNames,
        originalName: "",
      })
    : null

  React.useEffect(() => {
    if (localPropertyNamesKeyRef.current === propertyNamesKey) {
      localPropertyNamesKeyRef.current = null
      return
    }
    setNewPropertyName("")
  }, [propertyNamesKey, schemaContext.originalName])

  const preserveNewPropertyNameForLocalProperties = (
    nextPropertyNames: string[]
  ) => {
    localPropertyNamesKeyRef.current = getPropertyNamesKey(nextPropertyNames)
  }

  const createRowId = () => {
    const rowId = `draft-property-${nextRowIdRef.current}`
    nextRowIdRef.current += 1
    return rowId
  }

  const renameRowId = (oldName: string, name: string) => {
    setRowIdsByName((current) => {
      const rowId = current[oldName] ?? createRowId()
      const next = { ...current }
      delete next[oldName]
      setRecordValue(next, name, rowId)
      return next
    })
  }

  const removeRowId = (name: string) => {
    setRowIdsByName((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
  }

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

      const id = rowIdsByName[name] ?? `external-property-${name}`
      const replaceSchemaNode = (nextSchemaNode: ExtendedJSONSchema7) => {
        replacePropertySchemaNode(name, nextSchemaNode)
      }
      const move = (targetIndex: number) => {
        preserveNewPropertyNameForLocalProperties(
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
              preserveNewPropertyNameForLocalProperties(
                propertyNames.map((propertyName) =>
                  propertyName === name ? nextName : propertyName
                )
              )
              renameRowId(name, nextName)
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
          typeField: createPropertyTypeField({
            schemaNode: propertySchema,
            schemaContext: rowSchemaContext,
            disabled: !editable || !access.type,
            onChange: replaceSchemaNode,
          }),
          deleteAction: {
            label: `Remove field ${name}`,
            onDelete: () => {
              preserveNewPropertyNameForLocalProperties(
                propertyNames.filter((propertyName) => propertyName !== name)
              )
              removeRowId(name)
              onChange(removeObjectProperty({ schemaNode, propertyName: name }))
            },
          },
        },
      ]
    }
  )

  const addRow: ObjectPropertyAddRowModel = {
    error: newPropertyNameError,
    value: newPropertyName,
    onChange: setNewPropertyName,
    onSubmit: () => {
      if (!trimmedNewPropertyName || newPropertyNameError) return
      preserveNewPropertyNameForLocalProperties([
        ...propertyNames,
        trimmedNewPropertyName,
      ])
      setRowIdsByName((current) => {
        const next = { ...current }
        setRecordValue(next, trimmedNewPropertyName, createRowId())
        return next
      })
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

function getPropertyNamesKey(propertyNames: string[]) {
  return propertyNames.join("\0")
}

function createRowIdsByName(propertyNames: string[]) {
  const rowIdsByName: Record<string, string> = {}
  propertyNames.forEach((propertyName, index) => {
    setRecordValue(rowIdsByName, propertyName, `draft-property-${index}`)
  })
  return rowIdsByName
}

function setRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}
