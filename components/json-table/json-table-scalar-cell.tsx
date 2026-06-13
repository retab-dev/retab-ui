import { DataCell, type DataCellProps } from "@/components/ui/data-cell"
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler"

export const jsonTableScalarDataCellClass =
  "h-full rounded-none border-0 !text-xs"

export function JsonTableScalarCell(props: DataCellProps) {
  recordJsonTableRender("JsonTableScalarCell", `${props.kind}:${props.mode}`, {
    editable: props.editable,
    kind: props.kind,
    mode: props.mode ?? null,
    valueType: props.value === null ? "null" : typeof props.value,
  })

  return <DataCell {...props} className={jsonTableScalarDataCellClass} />
}
