import { DataCell, type DataCellProps } from "@/components/ui/data-cell"

export const jsonTableScalarDataCellClass =
  "h-full rounded-none border-0 text-xs"

export function JsonTableScalarCell(props: DataCellProps) {
  return <DataCell {...props} className={jsonTableScalarDataCellClass} />
}
