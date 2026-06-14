import { render } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { vi } from "vitest"

import { DataCell, type DataCellValueMeta } from "@/components/ui/data-cell"
import { createJsonTableDataCellProps } from "@/components/json-table/json-table-data-cell-model"
import type { JsonTableStructuredEditSession } from "@/components/json-table/json-table-edit-session"
import { JsonTableStructuredCell } from "@/components/json-table/json-table-structured-cell"
import type {
  FieldKind,
  FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata"

const schema: JSONSchema7 = {
  type: "object",
  properties: {},
}

export interface JsonTableCellHarnessProps {
  fieldMetadata?: FieldMetadata
  fieldPath?: string
  schema?: JSONSchema7
  value?: unknown
  effectiveValue?: unknown
  structuredEditSession?: JsonTableStructuredEditSession
  setStructuredEditSessionOverlayOpen?: (open: boolean) => void
  closeStructuredEditSession?: () => void
  onOpenChange?: (open: boolean) => void
  onEditingEnd?: () => void
  commitValue?: (value: unknown, meta?: unknown) => void
}

export function baseField(kind: FieldKind): FieldMetadata {
  return {
    fieldPath: "field",
    rawSchema: { type: kind === "integer" ? "integer" : "string" },
    schema: { type: kind === "integer" ? "integer" : "string" },
    effectiveSchema: { type: kind === "integer" ? "integer" : "string" },
    isNullable: false,
    kind,
    enumValues: [],
  }
}

export function renderDataCell(
  kind: FieldKind,
  overrides: JsonTableCellHarnessProps = {}
) {
  const fieldMetadata = overrides.fieldMetadata ?? baseField(kind)
  const dataCellProps = createJsonTableDataCellProps({
    active: true,
    autoFocus: true,
    fieldMetadata,
    isEditable: true,
    onCommit: (value: unknown, meta: DataCellValueMeta) =>
      overrides.commitValue?.(value, meta),
    onEditingEnd: overrides.onEditingEnd ?? vi.fn(),
    onOpenChange: overrides.onOpenChange ?? vi.fn(),
    value: overrides.effectiveValue ?? overrides.value ?? "value",
  })

  return render(<DataCell {...dataCellProps} />)
}

export function renderEnumCell(overrides: JsonTableCellHarnessProps = {}) {
  const fieldMetadata = overrides.fieldMetadata ?? baseField("enum")
  const dataCellProps = createJsonTableDataCellProps({
    active: true,
    autoFocus: true,
    fieldMetadata,
    isEditable: true,
    onCommit: (value: unknown, meta: DataCellValueMeta) =>
      overrides.commitValue?.(value, meta),
    onEditingEnd: overrides.onEditingEnd ?? vi.fn(),
    onOpenChange: overrides.onOpenChange ?? vi.fn(),
    value: overrides.effectiveValue ?? overrides.value ?? "value",
  })

  return render(<DataCell {...dataCellProps} />)
}

export function renderStructuredCell(
  kind: "object" | "array",
  overrides: JsonTableCellHarnessProps = {}
) {
  const fieldMetadata = overrides.fieldMetadata ?? baseField(kind)
  const fieldPath = overrides.fieldPath ?? "field"
  return render(
    <JsonTableStructuredCell
      fieldPath={fieldPath}
      fieldMetadata={fieldMetadata}
      schema={overrides.schema ?? schema}
      effectiveValue={overrides.effectiveValue ?? overrides.value ?? "value"}
      isEditable
      structuredEditSession={
        overrides.structuredEditSession ?? baseSession({ fieldPath })
      }
      setStructuredEditSessionOverlayOpen={
        overrides.setStructuredEditSessionOverlayOpen ?? vi.fn()
      }
      closeStructuredEditSession={
        overrides.closeStructuredEditSession ?? vi.fn()
      }
      commitValue={overrides.commitValue ?? vi.fn()}
    />
  )
}

export function baseSession(
  overrides: Partial<JsonTableStructuredEditSession> = {}
): JsonTableStructuredEditSession {
  return {
    id: 1,
    cellId: "doc_1:field",
    docId: "doc_1",
    fieldPath: "field",
    intent: { type: "programmatic" },
    isOverlayOpen: false,
    ...overrides,
  }
}

export function renderCell(
  kind: FieldKind,
  overrides: JsonTableCellHarnessProps = {}
) {
  if (kind === "enum") return renderEnumCell(overrides)
  if (kind === "object" || kind === "array") {
    return renderStructuredCell(kind, overrides)
  }
  return renderDataCell(kind, overrides)
}
