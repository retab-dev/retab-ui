import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { transferContext } from "@/components/json-table/cell-editors/object-editor"
import { ArrayEditor as JsonArrayEditor } from "@/components/json-table/object-editor"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function formatArraySummary(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} items]`
  if (value === null || value === undefined) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function ArrayCellEditor({
  identity,
  field,
  overlays,
  commit,
}: CellEditorProps) {
  const property = field.fieldMetadata.rawSchema

  return (
    <Popover
      open={overlays.openEditorPath === identity.fieldPath}
      onOpenChange={(open) => {
        overlays.setOpenEditorPath(open ? identity.fieldPath : null)
      }}
    >
      <PopoverTrigger asChild>
        <button className="h-full w-full justify-start overflow-hidden px-1 text-xs leading-none text-inherit select-none hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
          {field.effectiveValue ? (
            <div className="max-w-[80px] truncate text-left">
              {formatArraySummary(field.effectiveValue)}
            </div>
          ) : (
            <div className="max-w-[80px] truncate text-left text-muted-foreground">
              {`${property.title || identity.fieldPath}`}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="m-0 w-96 p-4"
        align="start"
        side="top"
        sideOffset={0}
        alignOffset={-1}
      >
        {overlays.openEditorPath === identity.fieldPath && (
          <JsonArrayEditor
            name={identity.fieldPath}
            disabled={!field.isEditable}
            property={transferContext(property, field.schema)}
            currentValue={field.effectiveValue}
            onSubmit={(values) => {
              commit.onCommit(values)
              overlays.setOpenEditorPath(null)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
