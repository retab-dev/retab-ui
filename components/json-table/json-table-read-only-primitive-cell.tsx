import { cn } from "@/lib/utils"
import { DataCellDisplay, type DataCellKind } from "@/components/ui/data-cell"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell-classes"

export function JsonTableReadOnlyPrimitiveDisplayCell({
  displayValue,
  primitiveKind,
}: {
  displayValue: string
  primitiveKind: DataCellKind | null
}) {
  const isEmpty = displayValue === ""
  const text = isEmpty ? "—" : displayValue

  if (primitiveKind === "boolean") {
    const checked = displayValue === "true"
    return (
      <>
        <DataCellDisplay
          kind="boolean"
          value={checked}
          className={cn(
            jsonTableDataCellClass,
            "flex items-center justify-center"
          )}
        />
        <span data-slot="json-table-read-only-cell-text" className="sr-only">
          {text}
        </span>
      </>
    )
  }

  return (
    <div
      data-slot="data-cell"
      data-kind={primitiveKind ?? "text"}
      data-mode="display"
      aria-readonly
      className={cn(
        jsonTableDataCellClass,
        "relative inline-flex w-full items-center overflow-hidden bg-transparent px-3 text-inherit"
      )}
    >
      <span
        data-slot="json-table-read-only-cell-text"
        className={cn("truncate", isEmpty && "text-muted-foreground")}
      >
        {text}
      </span>
    </div>
  )
}
