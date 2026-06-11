import { render } from "@testing-library/react"
import type { JSONSchema7 } from "json-schema"
import { vi } from "vitest"

import { CellEditor } from "@/components/json-table/cell-editors/cell-editor"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import type { FieldKind } from "@/components/json-table/lib/schema-field-metadata"

const schema: JSONSchema7 = {
  type: "object",
  properties: {},
}

export function baseField(kind: FieldKind): CellEditorProps["field"] {
  return {
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

export function baseTextDraft(): CellEditorProps["textDraft"] {
  return {
    committedTextValue: "value",
    activeTextValue: "value",
    draftTextValue: "value",
    setDraftTextValue: vi.fn(),
  }
}

export function baseOverlays(): CellEditorProps["overlays"] {
  return {
    showInput: false,
    isSelectOpen: false,
    setIsSelectOpen: vi.fn(),
    isDatePopoverOpen: false,
    setIsDatePopoverOpen: vi.fn(),
    isTextEditing: false,
    setIsTextEditing: vi.fn(),
    openEditorPath: null,
    setOpenEditorPath: vi.fn(),
  }
}

export function renderEditor(
  kind: FieldKind,
  overrides: Partial<CellEditorProps> = {}
) {
  const props: CellEditorProps = {
    identity: {
      docId: "doc_1",
      fieldPath: "field",
    },
    field: baseField(kind),
    textDraft: baseTextDraft(),
    focus: {
      focusedField: null,
      setFocusedField: vi.fn(),
      setIsInputFocused: vi.fn(),
    },
    overlays: baseOverlays(),
    commit: { onCommit: vi.fn() },
    ...overrides,
  }

  return render(<CellEditor {...props} />)
}
