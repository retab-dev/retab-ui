"use client"

/**
 * @internal
 * First-party EditViewer part state. Do not import from app code or examples.
 */
import * as React from "react"

import type {
  PageOverlayProps,
  PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

import type {
  EditViewerDocumentTarget,
  EditViewerFieldGroup,
  EditViewerFilter,
} from "./edit-viewer-model"
import type {
  EditViewerDocumentSource,
  EditViewerField,
  EditViewerMode,
  EditViewerOptions,
  EditViewerResult,
  EditViewerStatus,
} from "./edit-viewer-types"

export type EditViewerProviderState = {
  status: EditViewerStatus
  result: EditViewerResult
  fields: readonly EditViewerField[]
  filledCount: number
  hasOutput: boolean
  fieldByKey: ReadonlyMap<string, EditViewerField>
  fieldsByPage: ReadonlyMap<number, readonly EditViewerField[]>
}

export type EditViewerModeState = {
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  setMode: (mode: EditViewerMode) => void
}

export type EditViewerFieldsState = {
  fields: readonly EditViewerField[]
  visibleFields: readonly EditViewerField[]
  fieldGroups: readonly EditViewerFieldGroup[]
  locatedFields: readonly EditViewerField[]
  unlocatedFields: readonly EditViewerField[]
  filledCount: number
  fieldCount: number
  visibleFieldCount: number
  query: string
  setQuery: (query: string) => void
  filter: EditViewerFilter
  setFilter: (filter: EditViewerFilter) => void
  canSearch: boolean
  canFilter: boolean
}

export type EditViewerSelectionState = {
  selectedFieldKey: string | null
  activeFieldKey: string | null
  selectField: (fieldKey: string) => void
  clearFieldSelection: () => void
  previewField: (fieldKey: string | null) => void
}

export type EditViewerDocumentState = {
  target: EditViewerDocumentTarget
  mode: EditViewerMode | null
  sourceDocument: EditViewerDocumentSource | null
  filledDocument: EditViewerDocumentSource | null
  viewerRef: React.RefObject<PdfViewerHandle | null>
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode
}

type EditViewerHeaderState = {
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  setMode: (mode: EditViewerMode) => void
  filledCount: number
  fieldCount: number
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
  hasFieldPanel: boolean
}

type EditViewerLayoutState = {
  hasFieldPanel: boolean
  hasOutput: boolean
}

type EditViewerBusyState = {
  status: Extract<
    EditViewerStatus,
    { state: "detecting" } | { state: "filling" }
  > | null
}

type EditViewerEmptyStatusState = {
  hasOutput: boolean
}

export type EditViewerFieldsPartState = EditViewerFieldsState &
  EditViewerSelectionState

type EditViewerContextValue = {
  state: EditViewerProviderState
  mode: EditViewerModeState
  fields: EditViewerFieldsState
  selection: EditViewerSelectionState
  document: EditViewerDocumentState
  options: Required<EditViewerOptions>
}

export const EditViewerContext =
  React.createContext<EditViewerContextValue | null>(null)

function useEditViewerContext(): EditViewerContextValue {
  const context = React.useContext(EditViewerContext)
  if (!context) {
    throw new Error("useEditViewer must be used within EditViewerProvider.")
  }
  return context
}

export function useInternalEditViewerLayout(): EditViewerLayoutState {
  const edit = useEditViewerContext()

  return {
    hasFieldPanel: edit.options.fieldPanel,
    hasOutput: edit.state.hasOutput,
  }
}

export function useInternalEditViewerBusy(): EditViewerBusyState {
  const edit = useEditViewerContext()
  const status = edit.state.status

  return {
    status:
      status.state === "detecting" || status.state === "filling"
        ? status
        : null,
  }
}

export function useInternalEditViewerEmpty(): EditViewerEmptyStatusState {
  return {
    hasOutput: useEditViewerContext().state.hasOutput,
  }
}

export function useInternalEditViewerHeader(): EditViewerHeaderState {
  const edit = useEditViewerContext()

  return {
    mode: edit.mode.mode,
    modes: edit.mode.modes,
    setMode: edit.mode.setMode,
    filledCount: edit.state.filledCount,
    fieldCount: edit.state.fields.length,
    status: edit.state.status.state === "idle" ? null : edit.state.status,
    hasFieldPanel: edit.options.fieldPanel,
  }
}

export function useEditViewerDocument(): EditViewerDocumentState {
  return useEditViewerContext().document
}

export function useEditViewerFields(): EditViewerFieldsPartState {
  const edit = useEditViewerContext()
  return {
    ...edit.fields,
    ...edit.selection,
  }
}
