import { cn } from "@/lib/utils"
import type { DataCellKind } from "@/components/ui/data-cell"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import { DataCellBooleanIndicator } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import { dataCellCheckboxDisplayClass } from "@/registry/new-york-v4/ui/data-cell-classes"

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
      <div
        data-slot="data-cell"
        data-kind="boolean"
        data-mode="display"
        aria-readonly
        className={cn(
          jsonTableDataCellClass,
          "flex items-center justify-center"
        )}
      >
        <span
          role="checkbox"
          data-slot="checkbox"
          data-state={checked ? "checked" : "unchecked"}
          aria-checked={checked}
          aria-label={checked ? "true" : "false"}
          className={cn(
            dataCellCheckboxDisplayClass,
            "pointer-events-none flex items-center justify-center"
          )}
        >
          <DataCellBooleanIndicator checked={checked} />
        </span>
        <span data-slot="json-table-read-only-cell-text" className="sr-only">
          {text}
        </span>
      </div>
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
