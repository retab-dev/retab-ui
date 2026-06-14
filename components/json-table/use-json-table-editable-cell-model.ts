import * as React from "react"

import {
  disabledJsonTableCellShellProps,
  editableJsonTableCellShellProps,
} from "@/components/json-table/json-table-cell-shell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler"
import { useJsonTableCellField } from "@/components/json-table/use-json-table-cell-field"
import { useJsonTableFocusReturn } from "@/components/json-table/use-json-table-focus-return"
import { useJsonTablePrimitiveControl } from "@/components/json-table/use-json-table-primitive-control"
import { useJsonTableShellHandlers } from "@/components/json-table/use-json-table-shell-handlers"

export function useJsonTableEditableCellModel(props: JsonTableCellProps) {
  const { cellProjection, commit, structuredEditing } = props
  const cellField = useJsonTableCellField(props)
  const shellRef = React.useRef<HTMLTableCellElement>(null)
  const primitiveControl = useJsonTablePrimitiveControl({ props, cellField })

  useJsonTableFocusReturn({
    shellRef,
    isCellEditing: cellField.isCellEditing,
    primitiveActiveCell: cellField.primitiveActiveCell,
    structuredEditSession: structuredEditing.session,
  })

  recordJsonTableRender(
    "EditableJsonTableCell",
    cellField.materializedFieldPath ?? cellProjection.column.key,
    {
      primitiveActiveFieldPath:
        cellField.primitiveActiveCell?.fieldPath ?? null,
      structuredEditSessionFieldPath:
        structuredEditing.session?.fieldPath ?? null,
      fieldKind: cellField.fieldMetadata?.kind ?? null,
      isEditable: cellField.isJsonEditable,
      isEditing: cellField.isCellEditing,
      valueType:
        cellField.cellValue === null ? "null" : typeof cellField.cellValue,
    }
  )

  const shellHandlers = useJsonTableShellHandlers({
    props,
    cellField,
  })

  if (!cellField.materializedFieldPath || !cellField.fieldMetadata) {
    return {
      kind: "disabled" as const,
      shellProps: disabledJsonTableCellShellProps({
        ariaColumnIndex: cellProjection.ariaColumnIndex,
        cellWidth: cellField.cellWidth,
        materializedFieldPath: cellField.materializedFieldPath,
      }),
    }
  }

  const shellProps = editableJsonTableCellShellProps({
    ariaColumnIndex: cellProjection.ariaColumnIndex,
    cellWidth: cellField.cellWidth,
    isCellEditing: cellField.isCellEditing,
    isJsonEditable: cellField.isJsonEditable,
    isPrimitiveCell: cellField.isPrimitiveCell,
    materializedFieldPath: cellField.materializedFieldPath,
    shellHandlers,
  })

  if (cellField.isPrimitiveCell) {
    return {
      kind: "primitive" as const,
      primitiveProps: {
        effectiveValue: primitiveControl.effectiveValue,
        fieldMetadata: cellField.fieldMetadata,
        isActive: cellField.isPrimitiveActive,
        isEditable: cellField.isJsonEditable,
        onActiveChange: primitiveControl.setActive,
        onCommit: primitiveControl.commitValue,
        onEditingEnd: () => primitiveControl.setActive(false),
      },
      shellProps,
      shellRef,
    }
  }

  if (cellField.isStructuredActive && structuredEditing.session) {
    return {
      kind: "structured-active" as const,
      shellProps,
      shellRef,
      structuredActiveProps: {
        closeStructuredEditSession: structuredEditing.closeSession,
        fieldMetadata: cellField.fieldMetadata,
        materializedFieldPath: cellField.materializedFieldPath,
        onCellCommit: commit.onCommit,
        schema: cellProjection.schema,
        setStructuredEditSessionOverlayOpen:
          structuredEditing.setSessionOverlayOpen,
        structuredEditSession: structuredEditing.session,
        value: cellField.cellValue,
      },
    }
  }

  return {
    displayProps: {
      fieldMetadata: cellField.fieldMetadata,
      value: cellField.cellValue,
    },
    kind: "display" as const,
    shellProps,
    shellRef,
  }
}
