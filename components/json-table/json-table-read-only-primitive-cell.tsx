import { cn } from "@/lib/utils"
import { jsonTableDataCellClass } from "@/components/json-table/json-table-data-cell"
import { primitiveKindForField } from "@/components/json-table/json-table-data-cell-model"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { DataCellBooleanIndicator } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import { dataCellCheckboxDisplayClass } from "@/registry/new-york-v4/ui/data-cell-classes"

export function JsonTableReadOnlyPrimitiveDisplayCell({
  displayValue,
  fieldMetadata,
}: {
  displayValue: string
  fieldMetadata: FieldMetadata
}) {
  const isEmpty = displayValue === ""
  const text = isEmpty ? "—" : displayValue

  if (fieldMetadata.kind === "boolean") {
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
      data-kind={primitiveKindForField(fieldMetadata) ?? "text"}
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
