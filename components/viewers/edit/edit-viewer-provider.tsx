"use client"

import * as React from "react"

import {
  AnchoredDocumentProvider,
  useAnchoredDocument,
  type AnchoredItem,
} from "@/components/ui/anchored-document-viewer"
import { usePdfAnchoredTarget } from "@/components/ui/pdf-anchor-target"
import type {
  PageOverlayProps,
  PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

import {
  createEditViewerFieldProjection,
  deriveEditViewerModes,
  normalizeEditViewerResult,
  resolveEditViewerDocumentTarget,
  resolveEditViewerMode,
  resolveEditViewerOptions,
  type EditViewerAnchorItem,
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

export type EditViewerState = {
  status: EditViewerStatus
  result: EditViewerResult
  fields: readonly EditViewerField[]
  fieldByKey: ReadonlyMap<string, EditViewerField>
  fieldsByPage: ReadonlyMap<number, readonly EditViewerField[]>
  filledCount: number
  hasOutput: boolean
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

export type EditViewerHeaderState = {
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  setMode: (mode: EditViewerMode) => void
  filledCount: number
  fieldCount: number
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
  hasFieldPanel: boolean
}

export type EditViewerFieldsPartState = EditViewerFieldsState &
  EditViewerSelectionState

export type EditViewerContextValue = {
  state: EditViewerState
  mode: EditViewerModeState
  fields: EditViewerFieldsState
  selection: EditViewerSelectionState
  document: EditViewerDocumentState
  options: Required<EditViewerOptions>
}

const EditViewerContext = React.createContext<EditViewerContextValue | null>(
  null
)

export function useEditViewer(): EditViewerContextValue {
  const context = React.useContext(EditViewerContext)
  if (!context) {
    throw new Error("useEditViewer must be used within EditViewerProvider.")
  }
  return context
}

export function useEditViewerHeader(): EditViewerHeaderState {
  const edit = useEditViewer()

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
  return useEditViewer().document
}

export function useEditViewerFields(): EditViewerFieldsPartState {
  const edit = useEditViewer()
  return {
    ...edit.fields,
    ...edit.selection,
  }
}

export function useEditViewerSelection(): EditViewerSelectionState {
  return useEditViewer().selection
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
  const target = usePdfAnchoredTarget(viewerRef)
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
  const anchoredItems = React.useMemo(
    () => fieldProjection.anchorItems.map(editAnchorItemToAnchoredItem),
    [fieldProjection.anchorItems]
  )

  return (
    <AnchoredDocumentProvider
      items={anchoredItems}
      target={target}
      initialItemId={selectedFieldKey}
    >
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
    </AnchoredDocumentProvider>
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
  const state = React.useMemo<EditViewerState>(
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
  const value = React.useMemo<EditViewerContextValue>(
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
    activateItem,
    clearSelection,
    previewItem,
    selectItem,
    selectedItemId,
  } = useAnchoredDocument()

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
      activateItem(fieldKey)
      onSelectedFieldKeyChange?.(fieldKey)
    },
    [activateItem, fieldByKey, onSelectedFieldKeyChange]
  )
  const clearFieldSelection = React.useCallback(() => {
    clearSelection()
    onSelectedFieldKeyChange?.(null)
  }, [clearSelection, onSelectedFieldKeyChange])
  const previewField = React.useCallback(
    (fieldKey: string | null) => {
      if (fieldKey && !fieldByKey.has(fieldKey)) return
      previewItem(fieldKey)
    },
    [fieldByKey, previewItem]
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

function editAnchorItemToAnchoredItem(
  item: EditViewerAnchorItem
): AnchoredItem {
  return item
}
