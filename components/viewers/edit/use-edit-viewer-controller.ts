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
  status,
  options,
}: Pick<
  EditViewerProps,
  | "result"
  | "sourceDocument"
  | "filledDocument"
  | "mode"
  | "onModeChange"
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

  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<EditViewerFilter>("all")

  const fieldByKey = React.useMemo(() => createFieldMap(fields), [fields])

  const filledCount = React.useMemo(
    () => fields.filter(isEditFieldFilled).length,
    [fields]
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
    fieldByKey,
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
    setFilter,
    setQuery,
    viewerRef,
  }
}

function createFieldMap(fields: EditViewerField[]) {
  const fieldByKey = new Map<string, EditViewerField>()
  for (const field of fields) fieldByKey.set(field.key, field)
  return fieldByKey
}
