import * as React from "react"

import {
  buildJsonTableEditableCellModel,
  type JsonTableEditableCellModel,
} from "@/components/json-table/json-table-cell-model"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { useJsonTableCellField } from "@/components/json-table/use-json-table-cell-field"
import { useJsonTableCellProfiler } from "@/components/json-table/use-json-table-cell-profiler"
import { useJsonTableFocusReturn } from "@/components/json-table/use-json-table-focus-return"
import { useJsonTablePrimitiveControl } from "@/components/json-table/use-json-table-primitive-control"
import { useJsonTableShellHandlers } from "@/components/json-table/use-json-table-shell-handlers"

export type { JsonTableEditableCellModel }

export function useJsonTableEditableCellModel(
  props: JsonTableCellProps
): JsonTableEditableCellModel {
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
    primitiveControl,
  })

  return buildJsonTableEditableCellModel({
    props,
    cellField,
    primitiveControl,
    shellHandlers,
    shellRef,
  })
}
