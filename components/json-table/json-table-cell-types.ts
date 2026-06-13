import type * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { DataCellEditorHandle } from "@/components/ui/data-cell"
import type { FixedGridColumn } from "@/components/ui/fixed-grid-columns"
import type {
  JsonTableActivationIntent,
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
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
  primitiveActiveCell: JsonTablePrimitiveActiveCell | null
  setPrimitiveActiveCell: (
    activeCell: JsonTablePrimitiveActiveCell | null
  ) => void
  primitiveEditorHandleRef: React.RefObject<DataCellEditorHandle | null>
  structuredEditSession: JsonTableStructuredEditSession | null
  startStructuredEditSession: (
    projectedCell: ProjectedCell,
    intent: JsonTableActivationIntent
  ) => void
  setStructuredEditSessionOverlayOpen: (open: boolean) => void
  closeStructuredEditSession: () => void
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
