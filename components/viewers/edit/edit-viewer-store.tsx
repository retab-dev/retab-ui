"use client"

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

export type EditStore = {
  state: EditViewerProviderState
  mode: EditViewerModeState
  fields: EditViewerFieldsState
  selection: EditViewerSelectionState
  document: EditViewerDocumentState
  options: Required<EditViewerOptions>
}

const EditStoreContext = React.createContext<EditStore | null>(null)

export function EditStoreProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: EditStore
}) {
  return (
    <EditStoreContext.Provider value={value}>
      {children}
    </EditStoreContext.Provider>
  )
}

export function useEditStore(): EditStore {
  const store = React.useContext(EditStoreContext)
  if (!store) {
    throw new Error("EditViewer parts must be used within EditViewerProvider.")
  }
  return store
}
