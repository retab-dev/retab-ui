import type { JSONSchema7 } from "json-schema"

import type { FixedGridColumn } from "@/components/ui/fixed-grid-columns"
import type {
  JsonTableActivationIntent,
  JsonTableEditSession,
} from "@/components/json-table/json-table-edit-session"
import type { ProjectedCell } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export interface VisibleColumn extends FixedGridColumn<FieldMetadata> {
  fieldMetadata?: FieldMetadata
}

export interface JsonTableCellProps {
  column: VisibleColumn
  projectedCell?: ProjectedCell
  schema: JSONSchema7
  document: TableDocument
  docId: string
  editSession: JsonTableEditSession | null
  startEditSession: (
    projectedCell: ProjectedCell,
    intent: JsonTableActivationIntent
  ) => void
  updateEditSessionDraft: (value: unknown) => void
  setEditSessionOverlayOpen: (open: boolean) => void
  closeEditSession: () => void
  onDocumentDataChange: (
    docId: string,
    materializedFieldPath: string,
    value: unknown
  ) => void
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  onCellHoverEnd?: () => void
  isJsonEditable: boolean
}
