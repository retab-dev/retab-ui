import type { JSONSchema7 } from "json-schema"

import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export interface CellIdentity {
  docId: string
  fieldPath: string
}

export interface CellFieldState {
  schema: JSONSchema7
  fieldMetadata: FieldMetadata
  value: unknown
  effectiveValue: unknown
  isEditable: boolean
}

export interface CellTextDraft {
  committedTextValue: string
  activeTextValue: string
  draftTextValue: string
  setDraftTextValue: (value: string) => void
}

export interface CellFocusState {
  focusedField: string | null
  setFocusedField: (value: string | null) => void
  setIsInputFocused: (value: boolean) => void
}

export interface CellOverlayState {
  showInput: boolean
  forceEditMode?: boolean
  isSelectOpen: boolean
  setIsSelectOpen: (value: boolean) => void
  openEditorPath: string | null
  setOpenEditorPath: (key: string | null) => void
}

export interface CellCommitHandlers {
  onCommit: (value: unknown) => void
}

export interface CellEditorProps {
  identity: CellIdentity
  field: CellFieldState
  textDraft: CellTextDraft
  focus: CellFocusState
  overlays: CellOverlayState
  commit: CellCommitHandlers
}

export function fieldFocusId({ docId, fieldPath }: CellIdentity) {
  return `${docId}:${fieldPath}`
}
