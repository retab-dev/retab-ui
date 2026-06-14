import type * as React from "react"

import type {
  EditableTableCellShellProps,
  JsonTableShellHandlers,
} from "@/components/json-table/json-table-cell-shell"
import {
  disabledJsonTableCellShellProps,
  editableJsonTableCellShellProps,
} from "@/components/json-table/json-table-cell-shell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import type { JsonTableDisplayCellProps } from "@/components/json-table/json-table-display-cell"
import type { JsonTablePrimitiveCellProps } from "@/components/json-table/json-table-primitive-cell"
import type { JsonTableStructuredActiveCellProps } from "@/components/json-table/json-table-structured-active-cell"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"
import type { JsonTablePrimitiveControl } from "@/components/json-table/use-json-table-primitive-control"

type DisabledJsonTableCellModel = {
  kind: "disabled"
  shellProps: EditableTableCellShellProps
}

type PrimitiveJsonTableCellModel = {
  kind: "primitive"
  primitiveProps: JsonTablePrimitiveCellProps
  shellProps: EditableTableCellShellProps
  shellRef: React.RefObject<HTMLTableCellElement | null>
}

type StructuredActiveJsonTableCellModel = {
  kind: "structured-active"
  shellProps: EditableTableCellShellProps
  shellRef: React.RefObject<HTMLTableCellElement | null>
  structuredActiveProps: JsonTableStructuredActiveCellProps
}

type DisplayJsonTableCellModel = {
  displayProps: JsonTableDisplayCellProps
  kind: "display"
  shellProps: EditableTableCellShellProps
  shellRef: React.RefObject<HTMLTableCellElement | null>
}

export type JsonTableEditableCellModel =
  | DisabledJsonTableCellModel
  | PrimitiveJsonTableCellModel
  | StructuredActiveJsonTableCellModel
  | DisplayJsonTableCellModel

export function buildJsonTableEditableCellModel({
  props,
  cellField,
  primitiveControl,
  shellHandlers,
  shellRef,
}: {
  props: JsonTableCellProps
  cellField: JsonTableCellField
  primitiveControl: JsonTablePrimitiveControl
  shellHandlers: JsonTableShellHandlers
  shellRef: React.RefObject<HTMLTableCellElement | null>
}): JsonTableEditableCellModel {
  if (!cellField.materializedFieldPath || !cellField.fieldMetadata) {
    return {
      kind: "disabled",
      shellProps: disabledJsonTableCellShellProps({
        cellWidth: cellField.cellWidth,
        materializedFieldPath: cellField.materializedFieldPath,
      }),
    }
  }

  const shellProps = editableJsonTableCellShellProps({
    cellWidth: cellField.cellWidth,
    isCellEditing: cellField.isCellEditing,
    isJsonEditable: cellField.isJsonEditable,
    isPrimitiveCell: cellField.isPrimitiveCell,
    materializedFieldPath: cellField.materializedFieldPath,
    shellHandlers,
  })

  if (cellField.isPrimitiveCell) {
    return {
      kind: "primitive",
      primitiveProps: {
        effectiveValue: primitiveControl.primitiveEffectiveValue,
        fieldMetadata: cellField.fieldMetadata,
        isActive: cellField.isPrimitiveActive,
        isEditable: cellField.isJsonEditable,
        onActiveChange: primitiveControl.setPrimitiveActive,
        onCommit: primitiveControl.commitPrimitiveValue,
        onEditingEnd: () => primitiveControl.setPrimitiveActive(false),
        onEditorHandleChange: primitiveControl.setPrimitiveEditorHandle,
      },
      shellProps,
      shellRef,
    }
  }

  if (cellField.isStructuredActive && props.structuredEditSession) {
    return {
      kind: "structured-active",
      shellProps,
      shellRef,
      structuredActiveProps: {
        closeStructuredEditSession: props.closeStructuredEditSession,
        fieldMetadata: cellField.fieldMetadata,
        materializedFieldPath: cellField.materializedFieldPath,
        onCellCommit: props.onCellCommit,
        schema: props.schema,
        setStructuredEditSessionOverlayOpen:
          props.setStructuredEditSessionOverlayOpen,
        structuredEditSession: props.structuredEditSession,
        value: cellField.cellValue,
      },
    }
  }

  return {
    displayProps: {
      fieldMetadata: cellField.fieldMetadata,
      value: cellField.cellValue,
    },
    kind: "display",
    shellProps,
    shellRef,
  }
}
