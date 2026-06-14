import type * as React from "react"

import { DataCellBooleanControl } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import type { DataCellControlPropsByKind } from "@/registry/new-york-v4/ui/data-cell-control-contract"
import { DataCellNumberControl } from "@/registry/new-york-v4/ui/data-cell-number-control"
import { DataCellPickerControl } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import { DataCellSelectControl } from "@/registry/new-york-v4/ui/data-cell-select-control"
import { DataCellTextControl } from "@/registry/new-york-v4/ui/data-cell-text-control"

type DataCellControlComponentByKind = {
  [Kind in keyof DataCellControlPropsByKind]: React.ComponentType<
    DataCellControlPropsByKind[Kind]
  >
}

export const dataCellControlByKind = {
  text: DataCellTextControl,
  number: DataCellNumberControl,
  integer: DataCellNumberControl,
  boolean: DataCellBooleanControl,
  select: DataCellSelectControl,
  date: DataCellPickerControl,
  time: DataCellPickerControl,
  "date-time": DataCellPickerControl,
} satisfies DataCellControlComponentByKind
