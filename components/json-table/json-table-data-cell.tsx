import { cn } from "@/lib/utils"
import { jsonTableScalarDataCellClass } from "@/components/json-table/json-table-scalar-cell"

export const jsonTableDataCellClass = jsonTableScalarDataCellClass

export const jsonTableSelectDataCellClass = cn(
  jsonTableDataCellClass,
  "min-h-0 w-full min-w-0 justify-between bg-transparent px-3 text-inherit shadow-none",
  "hover:bg-muted/50 disabled:opacity-100",
  "focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30",
  "data-[placeholder]:text-muted-foreground [&_svg]:size-3 [&_svg]:opacity-50"
)
