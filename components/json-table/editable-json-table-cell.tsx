import * as React from "react"

import { DataCellDisplay } from "@/components/ui/data-cell"
import { TableCell } from "@/components/ui/table"
import { areEditableJsonTableCellPropsEqual } from "@/components/json-table/json-table-cell-memo"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { JsonTableDisplayCell } from "@/components/json-table/json-table-display-cell"
import { JsonTablePrimitiveCell } from "@/components/json-table/json-table-primitive-cell"
import { JsonTableStructuredActiveCell } from "@/components/json-table/json-table-structured-active-cell"
import { useJsonTableEditableCellModel } from "@/components/json-table/use-json-table-editable-cell-model"

function EditableJsonTableCellContent(props: JsonTableCellProps) {
  const cellModel = useJsonTableEditableCellModel(props)

  if (cellModel.kind === "disabled") {
    return (
      <TableCell {...cellModel.shellProps}>
        <DataCellDisplay kind="text" value={null} placeholder="" />
      </TableCell>
    )
  }

  return (
    <TableCell ref={cellModel.shellRef} {...cellModel.shellProps}>
      {cellModel.kind === "primitive" ? (
        <JsonTablePrimitiveCell {...cellModel.primitiveProps} />
      ) : cellModel.kind === "structured-active" ? (
        <JsonTableStructuredActiveCell {...cellModel.structuredActiveProps} />
      ) : (
        <JsonTableDisplayCell {...cellModel.displayProps} />
      )}
    </TableCell>
  )
}

export const EditableJsonTableCell = React.memo(
  EditableJsonTableCellContent,
  areEditableJsonTableCellPropsEqual
)
EditableJsonTableCell.displayName = "EditableJsonTableCell"
