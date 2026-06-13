"use client"

import * as React from "react"

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import {
  createObjectPropertySchema,
  isSchemaNode,
  listObjectPropertyNames,
  moveObjectProperty,
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits"
import { createPropertySchemaDetails } from "@/components/schema-editor/property-form/model/property-schema-details"
import type {
  PropertyFormMode,
  PropertyFormSchemaContext,
  PropertySchemaDetailsCapabilities,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation"

interface UseObjectPropertiesModelInput {
  capabilities: PropertySchemaDetailsCapabilities
  editable: boolean
  mode: PropertyFormMode
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}

export interface ObjectPropertyRowModel {
  id: string
  details: PropertySchemaDetailsModel
  name: string
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  type: {
    editable: boolean
    onChange: (schemaNode: ExtendedJSONSchema7) => void
  }
  validation: {
    name: (value: string) => string | null
  }
  actions: {
    rename: (name: string) => void
    remove: () => void
    replaceSchemaNode: (schemaNode: ExtendedJSONSchema7) => void
    move: (targetIndex: number) => void
  }
}

export interface ObjectPropertyAddRowModel {
  error: string | null
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export function useObjectPropertiesModel({
  capabilities,
  editable,
  mode,
  schemaNode,
  schemaContext,
  onChange,
}: UseObjectPropertiesModelInput) {
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

  const rows: ObjectPropertyRowModel[] = propertyNames.flatMap((name) => {
    const propertySchema = schemaNode.properties?.[name]
    if (!isSchemaNode(propertySchema)) return []

    const id = rowIdsByName[name] ?? `external-property-${name}`
    const replaceSchemaNode = (nextSchemaNode: ExtendedJSONSchema7) => {
      replacePropertySchemaNode(name, nextSchemaNode)
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
        details: createPropertySchemaDetails({
          schemaNode: propertySchema,
          schemaContext: rowSchemaContext,
          mode,
          capabilities,
          disabled: !editable,
          showTypeSelector: false,
          onChange: replaceSchemaNode,
        }),
        name,
        schemaNode: propertySchema,
        schemaContext: rowSchemaContext,
        type: {
          editable: editable && capabilities.canEditType,
          onChange: replaceSchemaNode,
        },
        validation: {
          name: (value: string) =>
            validatePropertyFormName({
              name: value,
              siblingNames: propertyNames,
              originalName: name,
            }),
        },
        actions: {
          rename: (nextName: string) => {
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
          remove: () => {
            preserveNewPropertyNameForLocalProperties(
              propertyNames.filter((propertyName) => propertyName !== name)
            )
            removeRowId(name)
            onChange(removeObjectProperty({ schemaNode, propertyName: name }))
          },
          replaceSchemaNode,
          move: (targetIndex: number) => {
            preserveNewPropertyNameForLocalProperties(
              movePropertyName({
                propertyNames,
                propertyName: name,
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
          },
        },
      },
    ]
  })

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

function movePropertyName({
  propertyNames,
  propertyName,
  targetIndex,
}: {
  propertyNames: string[]
  propertyName: string
  targetIndex: number
}) {
  const nextPropertyNames = propertyNames.slice()
  const sourceIndex = nextPropertyNames.indexOf(propertyName)
  if (sourceIndex < 0) return propertyNames

  const [movedPropertyName] = nextPropertyNames.splice(sourceIndex, 1)
  const clampedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, nextPropertyNames.length)
  )
  nextPropertyNames.splice(clampedTargetIndex, 0, movedPropertyName)
  return nextPropertyNames
}

function setRecordValue<T>(record: Record<string, T>, key: string, value: T) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}
