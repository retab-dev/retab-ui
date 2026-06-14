import * as React from "react"

import {
  disabledJsonTableCellShellProps,
  editableJsonTableCellShellProps,
} from "@/components/json-table/json-table-cell-shell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { useJsonTableCellField } from "@/components/json-table/use-json-table-cell-field"
import { useJsonTableCellProfiler } from "@/components/json-table/use-json-table-cell-profiler"
import { useJsonTableFocusReturn } from "@/components/json-table/use-json-table-focus-return"
import { useJsonTablePrimitiveControl } from "@/components/json-table/use-json-table-primitive-control"
import { useJsonTableShellHandlers } from "@/components/json-table/use-json-table-shell-handlers"

export function useJsonTableEditableCellModel(props: JsonTableCellProps) {
  const cellField = useJsonTableCellField(props)
  const shellRef = React.useRef<HTMLTableCellElement>(null)
  const primitiveControl = useJsonTablePrimitiveControl({ props, cellField })

  useJsonTableFocusReturn({
    shellRef,
    isCellEditing: cellField.isCellEditing,
    primitiveActiveCell: cellField.primitiveActiveCell,
    structuredEditSession: props.structuredEditSession,
  })

  useJsonTableCellProfiler({ props, cellField })

  const shellHandlers = useJsonTableShellHandlers({
    props,
    cellField,
  })

  if (!cellField.materializedFieldPath || !cellField.fieldMetadata) {
    return {
      kind: "disabled" as const,
      shellProps: disabledJsonTableCellShellProps({
        ariaColumnIndex: props.ariaColumnIndex,
        cellWidth: cellField.cellWidth,
        materializedFieldPath: cellField.materializedFieldPath,
      }),
    }
  }

  const shellProps = editableJsonTableCellShellProps({
    ariaColumnIndex: props.ariaColumnIndex,
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

  if (cellField.isStructuredActive && props.structuredEditSession) {
    return {
      kind: "structured-active" as const,
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
    kind: "display" as const,
    shellProps,
    shellRef,
  }
}
