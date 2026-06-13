import type { JSONSchema7 } from "json-schema"

import type { JsonTableEditSession } from "@/components/json-table/json-table-edit-session"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export interface JsonTableEditorCell {
  docId: string
  fieldPath: string
  schema: JSONSchema7
  fieldMetadata: FieldMetadata
  value: unknown
  effectiveValue: unknown
  isEditable: boolean
}

export interface CellEditorProps {
  cell: JsonTableEditorCell
  editSession: JsonTableEditSession
  draftValue: string
  setDraftValue: (value: string) => void
  setOverlayOpen: (open: boolean) => void
  closeEditSession: () => void
  commitValue: (value: unknown) => void
}
