import * as React from "react"

import type { PdfViewerHandle } from "@/components/ui/pdf-viewer"

import {
  deriveEditViewerModes,
  groupLocatedEditViewerFieldsByPage,
  isEditFieldFilled,
  normalizeEditViewerResult,
  resolveEditViewerMode,
  resolveEditViewerOptions,
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
  options,
}: Pick<
  EditViewerProps,
  | "result"
  | "sourceDocument"
  | "filledDocument"
  | "mode"
  | "onModeChange"
  | "selectedFieldKey"
  | "onSelectedFieldKeyChange"
  | "options"
> & {
  status: NonNullable<EditViewerProps["status"]>
}) {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const resolvedOptions = React.useMemo(
    () => resolveEditViewerOptions(options),
    [options]
  )
  const editResult = React.useMemo(
    () => normalizeEditViewerResult(result),
    [result]
  )
  const fields = editResult.fields
  const fieldsByPage = React.useMemo(
    () => groupLocatedEditViewerFieldsByPage(fields),
    [fields]
  )
  const availableModes = React.useMemo(
    () =>
      deriveEditViewerModes({
        fields,
        sourceDocument,
        filledDocument,
        options: resolvedOptions,
      }),
    [fields, filledDocument, resolvedOptions, sourceDocument]
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
      viewerRef.current?.scrollToPageArea({
        pageNumber: field.bbox.page,
        top: field.bbox.top * 100,
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
    fieldsByPage,
    filledCount,
    filter,
    hasOutput:
      status.state === "error" ||
      availableModes.length > 0 ||
      fields.length > 0,
    query,
    resolvedOptions,
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
