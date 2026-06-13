import { render } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { vi } from "vitest"

import { JsonTableDataCell } from "@/components/json-table/json-table-display-cell"
import type { JsonTableEditSession } from "@/components/json-table/json-table-edit-session"
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
  editSession?: JsonTableEditSession
  draftValue?: string
  setDraftValue?: (value: string) => void
  setOverlayOpen?: (open: boolean) => void
  closeEditSession?: () => void
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
  const draftValue = overrides.draftValue ?? "value"
  return render(
    <JsonTableDataCell
      fieldMetadata={fieldMetadata}
      value={overrides.effectiveValue ?? overrides.value ?? "value"}
      mode="edit"
      isEditable
      draftValue={draftValue}
      autoFocus
      isPickerOpen={overrides.editSession?.isOverlayOpen ?? false}
      onDraftValueChange={overrides.setDraftValue ?? vi.fn()}
      onPickerOpenChange={overrides.setOverlayOpen ?? vi.fn()}
      onEditingEnd={overrides.closeEditSession ?? vi.fn()}
      onCommit={(value, meta) => overrides.commitValue?.(value, meta)}
    />
  )
}

export function renderEnumCell(overrides: JsonTableCellHarnessProps = {}) {
  const fieldMetadata = overrides.fieldMetadata ?? baseField("enum")
  const fieldPath = overrides.fieldPath ?? "field"
  const editSession = overrides.editSession ?? baseSession({ fieldPath })
  return render(
    <JsonTableDataCell
      fieldMetadata={fieldMetadata}
      value={overrides.effectiveValue ?? overrides.value ?? "value"}
      mode="edit"
      isEditable={true}
      autoFocus
      isPickerOpen={editSession.isOverlayOpen}
      onPickerOpenChange={overrides.setOverlayOpen ?? vi.fn()}
      onEditingEnd={overrides.closeEditSession ?? vi.fn()}
      onCommit={(value, meta) => overrides.commitValue?.(value, meta)}
    />
  )
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
      editSession={overrides.editSession ?? baseSession({ fieldPath })}
      setOverlayOpen={overrides.setOverlayOpen ?? vi.fn()}
      closeEditSession={overrides.closeEditSession ?? vi.fn()}
      commitValue={overrides.commitValue ?? vi.fn()}
    />
  )
}

export function baseSession(
  overrides: Partial<JsonTableEditSession> = {}
): JsonTableEditSession {
  return {
    id: 1,
    cellId: "doc_1:field",
    docId: "doc_1",
    fieldPath: "field",
    intent: { type: "programmatic" },
    initialValue: "value",
    draftValue: "value",
    status: "editing",
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
