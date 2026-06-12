import { ArrayCellEditor } from "@/components/json-table/cell-editors/array-editor"
import { BooleanEditor } from "@/components/json-table/cell-editors/boolean-editor"
import { DateEditor } from "@/components/json-table/cell-editors/date-editor"
import { DateTimeEditor } from "@/components/json-table/cell-editors/datetime-editor"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { EnumEditor } from "@/components/json-table/cell-editors/enum-editor"
import { NumberEditor } from "@/components/json-table/cell-editors/number-editor"
import { ObjectCellEditor } from "@/components/json-table/cell-editors/object-editor"
import { TextEditor } from "@/components/json-table/cell-editors/text-editor"
import { TimeEditor } from "@/components/json-table/cell-editors/time-editor"
import { JsonTableDataCell } from "@/components/json-table/json-table-data-cell"

export function CellEditor(props: CellEditorProps) {
  switch (props.field.fieldMetadata.kind) {
    case "object":
      return <ObjectCellEditor {...props} />
    case "array":
      return <ArrayCellEditor {...props} />
    case "boolean":
      return <BooleanEditor {...props} />
    case "enum":
      return <EnumEditor {...props} />
    case "date":
      return <DateEditor {...props} />
    case "time":
      return <TimeEditor {...props} />
    case "date-time":
      return <DateTimeEditor {...props} />
    case "number":
    case "integer":
      return <NumberEditor {...props} />
    case "string":
      return <TextEditor {...props} />
    default:
      return (
        <JsonTableDataCell
          kind="text"
          value={
            props.field.effectiveValue == null
              ? ""
              : String(props.field.effectiveValue)
          }
          className="items-start bg-muted/60 py-2"
        />
      )
  }
}
