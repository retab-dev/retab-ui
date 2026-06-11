import * as React from "react"

import type { PdfViewerHandle } from "@/components/ui/pdf-viewer"

import {
  deriveEditViewerModes,
  isEditFieldFilled,
  normalizeEditViewerFields,
  resolveEditViewerFeatures,
  resolveEditViewerMode,
  type EditViewerFilter,
} from "./edit-viewer-model"
import type {
  EditViewerField,
  EditViewerMode,
  EditViewerProps,
} from "./edit-viewer-types"

export function useEditViewerController({
  result,
  sourceDocument,
  filledDocument,
  mode,
  onModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
  status,
  features,
}: Pick<
  EditViewerProps,
  | "result"
  | "sourceDocument"
  | "filledDocument"
  | "mode"
  | "onModeChange"
  | "selectedFieldKey"
  | "onSelectedFieldKeyChange"
  | "features"
> & {
  status: NonNullable<EditViewerProps["status"]>
}) {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const resolvedFeatures = React.useMemo(
    () => resolveEditViewerFeatures(features),
    [features]
  )
  const fields = React.useMemo(
    () => normalizeEditViewerFields(result?.fields ?? []),
    [result?.fields]
  )
  const availableModes = React.useMemo(
    () =>
      deriveEditViewerModes({
        result: result ? { ...result, fields } : undefined,
        fields,
        sourceDocument,
        filledDocument,
        features: resolvedFeatures,
      }),
    [fields, filledDocument, resolvedFeatures, result, sourceDocument]
  )

  const [uncontrolledMode, setUncontrolledMode] =
    React.useState<EditViewerMode | null>(null)
  const activeMode = resolveEditViewerMode({
    availableModes,
    requestedMode: mode,
    currentMode: uncontrolledMode,
  })

  React.useEffect(() => {
    if (mode || uncontrolledMode === activeMode) return
    setUncontrolledMode(activeMode)
  }, [activeMode, mode, uncontrolledMode])

  const [internalSelectedFieldKey, setInternalSelectedFieldKey] =
    React.useState<string | null>(null)
  const [hoveredFieldKey, setHoveredFieldKey] = React.useState<string | null>(
    null
  )
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<EditViewerFilter>("all")

  const selectedFieldKeyValue = selectedFieldKey ?? internalSelectedFieldKey
  const effectiveFieldKey = hoveredFieldKey ?? selectedFieldKeyValue
  const fieldByKey = React.useMemo(() => createFieldMap(fields), [fields])

  React.useEffect(() => {
    if (!selectedFieldKeyValue || fieldByKey.has(selectedFieldKeyValue)) return
    if (selectedFieldKey === undefined) setInternalSelectedFieldKey(null)
    onSelectedFieldKeyChange?.(null)
  }, [
    fieldByKey,
    onSelectedFieldKeyChange,
    selectedFieldKey,
    selectedFieldKeyValue,
  ])

  const filledCount = React.useMemo(
    () => fields.filter(isEditFieldFilled).length,
    [fields]
  )
  const setSelectedFieldKey = React.useCallback(
    (nextSelectedFieldKey: string | null) => {
      if (selectedFieldKey === undefined) {
        setInternalSelectedFieldKey(nextSelectedFieldKey)
      }
      onSelectedFieldKeyChange?.(nextSelectedFieldKey)
    },
    [onSelectedFieldKeyChange, selectedFieldKey]
  )
  const selectField = React.useCallback(
    (nextSelectedFieldKey: string) => {
      setSelectedFieldKey(nextSelectedFieldKey)
      const field = fieldByKey.get(nextSelectedFieldKey)
      if (!field?.bbox) return
      viewerRef.current?.scrollToPageArea(field.bbox.page, {
        top: field.bbox.top * 100,
        left: field.bbox.left * 100,
        width: field.bbox.width * 100,
        height: field.bbox.height * 100,
      })
    },
    [fieldByKey, setSelectedFieldKey]
  )
  const changeMode = React.useCallback(
    (nextMode: EditViewerMode) => {
      if (!availableModes.includes(nextMode)) return
      setUncontrolledMode(nextMode)
      onModeChange?.(nextMode)
    },
    [availableModes, onModeChange]
  )

  return {
    activeMode,
    activeStatus: status.state === "idle" ? null : status,
    availableModes,
    changeMode,
    effectiveFieldKey,
    fields,
    filledCount,
    filter,
    hasOutput:
      status.state === "error" ||
      availableModes.length > 0 ||
      fields.length > 0,
    query,
    resolvedFeatures,
    selectedFieldKey: selectedFieldKeyValue,
    selectField,
    setFilter,
    setHoveredFieldKey,
    setQuery,
    viewerRef,
  }
}

function createFieldMap(fields: EditViewerField[]) {
  const fieldByKey = new Map<string, EditViewerField>()
  for (const field of fields) fieldByKey.set(field.key, field)
  return fieldByKey
}
