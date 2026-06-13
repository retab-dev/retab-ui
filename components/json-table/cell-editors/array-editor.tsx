import * as React from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { transferContext } from "@/components/json-table/cell-editors/object-editor"
import { ArrayEditor as JsonArrayEditor } from "@/components/json-table/object-editor"

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
  cell,
  editSession,
  setOverlayOpen,
  closeEditSession,
  commitValue,
}: CellEditorProps) {
  const property = cell.fieldMetadata.rawSchema

  React.useLayoutEffect(() => {
    setOverlayOpen(true)
  }, [editSession.id, setOverlayOpen])

  return (
    <Popover
      open={editSession.isOverlayOpen}
      onOpenChange={(open) => {
        setOverlayOpen(open)
        if (!open) closeEditSession()
      }}
    >
      <PopoverTrigger asChild>
        <button className="h-full w-full justify-start overflow-hidden px-1 text-xs leading-none text-inherit select-none hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
          {cell.effectiveValue ? (
            <div className="max-w-[80px] truncate text-left">
              {formatArraySummary(cell.effectiveValue)}
            </div>
          ) : (
            <div className="max-w-[80px] truncate text-left text-muted-foreground">
              {`${property.title || cell.fieldPath}`}
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
        {editSession.isOverlayOpen && (
          <JsonArrayEditor
            name={cell.fieldPath}
            disabled={!cell.isEditable}
            property={transferContext(property, cell.schema)}
            currentValue={cell.effectiveValue}
            onSubmit={(values) => {
              commitValue(values)
              closeEditSession()
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
