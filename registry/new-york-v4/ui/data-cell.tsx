"use client"

import { DataCellBooleanControl } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import { DataCellDisplay } from "@/registry/new-york-v4/ui/data-cell-display"
import {
  formatDataCellDisplayValue,
  parseDataCellNumberInput,
} from "@/registry/new-york-v4/ui/data-cell-format"
import { DataCellNumberControl } from "@/registry/new-york-v4/ui/data-cell-number-control"
import { DataCellPickerControl } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import { DataCellSelectControl } from "@/registry/new-york-v4/ui/data-cell-select-control"
import { DataCellTextControl } from "@/registry/new-york-v4/ui/data-cell-text-control"
import type { DataCellProps } from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellBooleanControlProps = DataCellProps & { kind: "boolean" }
type DataCellPickerControlProps = DataCellProps & {
  kind: "date" | "time" | "date-time"
}
type DataCellNumberControlProps = DataCellProps & {
  kind: "number" | "integer"
}
type DataCellSelectControlProps = DataCellProps & { kind: "select" }
type DataCellTextControlProps = DataCellProps & { kind: "text" }

export type {
  DataCellActivationIntent,
  DataCellCommitValue,
  DataCellDateTimeZone,
  DataCellKind,
  DataCellMode,
  DataCellProps,
  DataCellSelectOption,
  DataCellValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"
export { formatDataCellDisplayValue, parseDataCellNumberInput }
export { DataCellBooleanControl }
export { DataCellDisplay }
export { DataCellNumberControl }
export { DataCellPickerControl }
export { DataCellSelectControl }
export { DataCellTextControl }

export function DataCell({ mode = "display", ...props }: DataCellProps) {
  if (mode === "edit") return <DataCellControl {...props} />
  return <DataCellDisplay {...props} />
}

export function DataCellControl(props: DataCellProps) {
  if (props.kind === "boolean") {
    return (
      <DataCellBooleanControl {...(props as DataCellBooleanControlProps)} />
    )
  }
  if (
    props.kind === "date" ||
    props.kind === "time" ||
    props.kind === "date-time"
  ) {
    return <DataCellPickerControl {...(props as DataCellPickerControlProps)} />
  }
  if (props.kind === "number" || props.kind === "integer") {
    return <DataCellNumberControl {...(props as DataCellNumberControlProps)} />
  }
  if (props.kind === "select") {
    return <DataCellSelectControl {...(props as DataCellSelectControlProps)} />
  }
  return <DataCellTextControl {...(props as DataCellTextControlProps)} />
}
