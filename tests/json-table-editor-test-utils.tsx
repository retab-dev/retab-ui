import { render } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { vi } from "vitest"

import { CellEditor } from "@/components/json-table/cell-editors/cell-editor"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import type { JsonTableEditSession } from "@/components/json-table/json-table-edit-session"
import type { FieldKind } from "@/components/json-table/lib/schema-field-metadata"

const schema: JSONSchema7 = {
  type: "object",
  properties: {},
}

export function baseField(kind: FieldKind): CellEditorProps["cell"] {
  return {
    docId: "doc_1",
    fieldPath: "field",
    schema,
    fieldMetadata: {
      fieldPath: "field",
      rawSchema: { type: kind === "integer" ? "integer" : "string" },
      schema: { type: kind === "integer" ? "integer" : "string" },
      effectiveSchema: { type: kind === "integer" ? "integer" : "string" },
      isNullable: false,
      kind,
      enumValues: [],
    },
    value: "value",
    effectiveValue: "value",
    isEditable: true,
  }
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

export function renderEditor(
  kind: FieldKind,
  overrides: Partial<CellEditorProps> = {}
) {
  const props: CellEditorProps = {
    cell: baseField(kind),
    editSession: baseSession(),
    draftValue: "value",
    setDraftValue: vi.fn(),
    setOverlayOpen: vi.fn(),
    closeEditSession: vi.fn(),
    commitValue: vi.fn(),
    ...overrides,
  }

  return render(<CellEditor {...props} />)
}
