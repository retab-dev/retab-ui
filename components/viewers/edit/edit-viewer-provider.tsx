"use client"

import * as React from "react"

import type {
  PageOverlayProps,
  PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import { SegmentedDocumentProvider } from "@/components/ui/segmented-document-provider"
import { useSegmentedItemLink } from "@/components/ui/segmented-item-link"

import {
  createEditViewerFieldProjection,
  createEditViewerSegmentedDocumentModel,
  deriveEditViewerModes,
  normalizeEditViewerResult,
  resolveEditViewerDocumentTarget,
  resolveEditViewerMode,
  resolveEditViewerOptions,
  type EditViewerDocumentTarget,
  type EditViewerFieldGroup,
  type EditViewerFieldProjection,
  type EditViewerFilter,
} from "./edit-viewer-model"
import { EditFieldOverlayLayer } from "./edit-viewer-overlays"
import type {
  EditViewerDocumentSource,
  EditViewerField,
  EditViewerMode,
  EditViewerOptions,
  EditViewerProps,
  EditViewerResult,
  EditViewerStatus,
} from "./edit-viewer-types"

export type EditViewerProviderProps = Omit<EditViewerProps, "className"> & {
  children: React.ReactNode
}

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

type EditViewerFrameState = {
  hasFieldPanel: boolean
  hasOutput: boolean
  busyStatus: Extract<
    EditViewerStatus,
    { state: "detecting" } | { state: "filling" }
  > | null
}

export type EditViewerChromeState = {
  hasFieldPanel: boolean
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  setMode: (mode: EditViewerMode) => void
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
}

const EditViewerContext = React.createContext<EditViewerContextValue | null>(
  null
)

function useEditViewerContext(): EditViewerContextValue {
  const context = React.useContext(EditViewerContext)
  if (!context) {
    throw new Error("EditViewer parts must be used within EditViewerProvider.")
  }
  return context
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

export function useEditViewerFrameState(): EditViewerFrameState {
  const edit = useEditViewerContext()
  const status = edit.state.status
  return {
    busyStatus:
      status.state === "detecting" || status.state === "filling"
        ? status
        : null,
    hasFieldPanel: edit.options.fieldPanel,
    hasOutput: edit.state.hasOutput,
  }
}

export function useEditViewerChromeState(): EditViewerChromeState {
  const edit = useEditViewerContext()
  return {
    hasFieldPanel: edit.options.fieldPanel,
    mode: edit.mode.mode,
    modes: edit.mode.modes,
    setMode: edit.mode.setMode,
    status: edit.state.status.state === "idle" ? null : edit.state.status,
  }
}

export function EditViewerProvider({
  result,
  sourceDocument = null,
  filledDocument = null,
  mode,
  onModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
  status = { state: "idle" },
  options,
  children,
}: EditViewerProviderProps) {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const resolvedOptions = React.useMemo(
    () => resolveEditViewerOptions(options),
    [options]
  )
  const editResult = React.useMemo(
    () => normalizeEditViewerResult(result),
    [result]
  )
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<EditViewerFilter>("all")
  const fieldProjection = React.useMemo(
    () =>
      createEditViewerFieldProjection({
        fields: editResult.fields,
        query,
        filter,
      }),
    [editResult.fields, filter, query]
  )
  const modeState = useEditViewerModeState({
    fields: fieldProjection.fields,
    sourceDocument,
    filledDocument,
    options: resolvedOptions,
    mode,
    onModeChange,
  })
  const documentTarget = React.useMemo(
    () =>
      resolveEditViewerDocumentTarget({
        filledDocument,
        mode: modeState.mode,
        sourceDocument,
        status,
      }),
    [filledDocument, modeState.mode, sourceDocument, status]
  )
  const segmentedDocument = React.useMemo(
    () => createEditViewerSegmentedDocumentModel(fieldProjection.fields),
    [fieldProjection.fields]
  )

  return (
    <SegmentedDocumentProvider model={segmentedDocument}>
      <EditViewerResolvedProvider
        documentTarget={documentTarget}
        editResult={editResult}
        filledDocument={filledDocument}
        filter={filter}
        fieldProjection={fieldProjection}
        modeState={modeState}
        onSelectedFieldKeyChange={onSelectedFieldKeyChange}
        options={resolvedOptions}
        query={query}
        selectedFieldKey={selectedFieldKey}
        setFilter={setFilter}
        setQuery={setQuery}
        sourceDocument={sourceDocument}
        status={status}
        viewerRef={viewerRef}
      >
        {children}
      </EditViewerResolvedProvider>
    </SegmentedDocumentProvider>
  )
}

function useEditViewerModeState({
  fields,
  filledDocument,
  mode,
  onModeChange,
  options,
  sourceDocument,
}: {
  fields: readonly EditViewerField[]
  filledDocument: EditViewerDocumentSource | null
  mode?: EditViewerMode | null
  onModeChange?: EditViewerProps["onModeChange"]
  options: Required<EditViewerOptions>
  sourceDocument: EditViewerDocumentSource | null
}): EditViewerModeState {
  const modes = React.useMemo(
    () =>
      deriveEditViewerModes({
        fields,
        sourceDocument,
        filledDocument,
        options,
      }),
    [fields, filledDocument, options, sourceDocument]
  )
  const isModeControlled = mode !== undefined
  const [uncontrolledMode, setUncontrolledMode] =
    React.useState<EditViewerMode | null>(null)
  const resolvedMode = resolveEditViewerMode({
    availableModes: modes,
    requestedMode: mode,
    currentMode: isModeControlled ? null : uncontrolledMode,
  })

  React.useEffect(() => {
    if (isModeControlled || uncontrolledMode === resolvedMode) return
    setUncontrolledMode(resolvedMode)
  }, [isModeControlled, resolvedMode, uncontrolledMode])

  const setMode = React.useCallback(
    (nextMode: EditViewerMode) => {
      if (!modes.includes(nextMode)) return
      if (!isModeControlled) {
        setUncontrolledMode(nextMode)
      }
      onModeChange?.(nextMode)
    },
    [isModeControlled, modes, onModeChange]
  )

  return React.useMemo(
    () => ({
      mode: resolvedMode,
      modes,
      setMode,
    }),
    [modes, resolvedMode, setMode]
  )
}

function EditViewerResolvedProvider({
  children,
  documentTarget,
  editResult,
  filledDocument,
  filter,
  fieldProjection,
  modeState,
  onSelectedFieldKeyChange,
  options,
  query,
  selectedFieldKey,
  setFilter,
  setQuery,
  sourceDocument,
  status,
  viewerRef,
}: {
  children: React.ReactNode
  documentTarget: EditViewerDocumentTarget
  editResult: EditViewerResult
  fieldProjection: EditViewerFieldProjection
  filledDocument: EditViewerDocumentSource | null
  filter: EditViewerFilter
  modeState: EditViewerModeState
  onSelectedFieldKeyChange?: EditViewerProps["onSelectedFieldKeyChange"]
  options: Required<EditViewerOptions>
  query: string
  selectedFieldKey?: string | null
  setFilter: (filter: EditViewerFilter) => void
  setQuery: (query: string) => void
  sourceDocument: EditViewerDocumentSource | null
  status: EditViewerStatus
  viewerRef: React.RefObject<PdfViewerHandle | null>
}) {
  const {
    fieldByKey,
    fieldGroups,
    fields,
    fieldsByPage,
    filledCount,
    locatedFields,
    unlocatedFields,
    visibleFields,
  } = fieldProjection
  const selection = useEditViewerSelectionBridge({
    fieldByKey,
    onSelectedFieldKeyChange,
    selectedFieldKey,
  })
  const renderPageOverlay = useEditViewerPageOverlay({
    activeFieldKey: selection.activeFieldKey,
    fieldsByPage,
    mode: modeState.mode,
    previewField: selection.previewField,
    selectField: selection.selectField,
  })
  const state = React.useMemo<EditViewerProviderState>(
    () => ({
      status,
      result: editResult,
      fields,
      fieldByKey,
      fieldsByPage,
      filledCount,
      hasOutput:
        status.state === "error" ||
        modeState.modes.length > 0 ||
        fields.length > 0,
    }),
    [
      editResult,
      fieldByKey,
      fields,
      fieldsByPage,
      filledCount,
      modeState.modes.length,
      status,
    ]
  )
  const fieldsState = React.useMemo<EditViewerFieldsState>(
    () => ({
      fields,
      visibleFields,
      fieldGroups,
      locatedFields,
      unlocatedFields,
      filledCount,
      fieldCount: fieldProjection.fieldCount,
      visibleFieldCount: fieldProjection.visibleFieldCount,
      query,
      setQuery,
      filter,
      setFilter,
      canSearch: options.search,
      canFilter: options.filters,
    }),
    [
      fieldGroups,
      fieldProjection.fieldCount,
      fieldProjection.visibleFieldCount,
      fields,
      filledCount,
      filter,
      locatedFields,
      options.filters,
      options.search,
      query,
      setFilter,
      setQuery,
      unlocatedFields,
      visibleFields,
    ]
  )
  const selectionState = React.useMemo<EditViewerSelectionState>(
    () => selection,
    [selection]
  )
  const documentState = React.useMemo<EditViewerDocumentState>(
    () => ({
      target: documentTarget,
      mode: modeState.mode,
      sourceDocument,
      filledDocument,
      viewerRef,
      renderPageOverlay,
    }),
    [
      documentTarget,
      filledDocument,
      modeState.mode,
      renderPageOverlay,
      sourceDocument,
      viewerRef,
    ]
  )
  const value = React.useMemo(
    () => ({
      state,
      mode: modeState,
      fields: fieldsState,
      selection: selectionState,
      document: documentState,
      options,
    }),
    [documentState, fieldsState, modeState, options, selectionState, state]
  )

  return (
    <EditViewerContext.Provider value={value}>
      {children}
    </EditViewerContext.Provider>
  )
}

function useEditViewerSelectionBridge({
  fieldByKey,
  onSelectedFieldKeyChange,
  selectedFieldKey,
}: {
  fieldByKey: ReadonlyMap<string, EditViewerField>
  onSelectedFieldKeyChange?: EditViewerProps["onSelectedFieldKeyChange"]
  selectedFieldKey?: string | null
}): EditViewerSelectionState {
  const {
    activeItemId,
    navigateItem,
    previewItem,
    selectItem,
    selectedItemId,
  } = useSegmentedItemLink({ initialItemId: selectedFieldKey })

  React.useEffect(() => {
    if (selectedFieldKey === undefined) return
    if (selectedFieldKey && !fieldByKey.has(selectedFieldKey)) {
      selectItem(null)
      onSelectedFieldKeyChange?.(null)
      return
    }
    selectItem(selectedFieldKey ?? null)
  }, [fieldByKey, onSelectedFieldKeyChange, selectItem, selectedFieldKey])

  const selectField = React.useCallback(
    (fieldKey: string) => {
      if (!fieldByKey.has(fieldKey)) return
      selectItem(fieldKey)
      navigateItem(fieldKey, { behavior: "smooth" })
      onSelectedFieldKeyChange?.(fieldKey)
    },
    [fieldByKey, navigateItem, onSelectedFieldKeyChange, selectItem]
  )
  const clearFieldSelection = React.useCallback(() => {
    selectItem(null)
    onSelectedFieldKeyChange?.(null)
  }, [onSelectedFieldKeyChange, selectItem])
  const previewField = React.useCallback(
    (fieldKey: string | null) => {
      if (fieldKey && !fieldByKey.has(fieldKey)) return
      previewItem(fieldKey)
      if (fieldKey) {
        navigateItem(fieldKey, { behavior: "auto", clearPreview: false })
      }
    },
    [fieldByKey, navigateItem, previewItem]
  )

  return React.useMemo(
    () => ({
      selectedFieldKey: selectedItemId,
      activeFieldKey: activeItemId,
      selectField,
      clearFieldSelection,
      previewField,
    }),
    [
      activeItemId,
      clearFieldSelection,
      previewField,
      selectField,
      selectedItemId,
    ]
  )
}

function useEditViewerPageOverlay({
  activeFieldKey,
  fieldsByPage,
  mode,
  previewField,
  selectField,
}: {
  activeFieldKey: string | null
  fieldsByPage: ReadonlyMap<number, readonly EditViewerField[]>
  mode: EditViewerMode | null
  previewField: (fieldKey: string | null) => void
  selectField: (fieldKey: string) => void
}) {
  return React.useCallback(
    ({ pageNumber }: PageOverlayProps) => (
      <EditFieldOverlayLayer
        fieldsByPage={fieldsByPage}
        pageNumber={pageNumber}
        mode={mode}
        effectiveFieldKey={activeFieldKey}
        onFieldHover={previewField}
        onFieldSelect={selectField}
      />
    ),
    [activeFieldKey, fieldsByPage, mode, previewField, selectField]
  )
}
