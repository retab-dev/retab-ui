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
import { JsonTableDisplayCell } from "@/components/json-table/json-table-display-cell"
import { recordJsonTableRender } from "@/components/json-table/json-table-profiler"

export function CellEditor(props: CellEditorProps) {
  recordJsonTableRender("CellEditor", props.cell.fieldPath, {
    editSessionId: props.editSession.id,
    fieldKind: props.cell.fieldMetadata.kind,
    isEditable: props.cell.isEditable,
    isSelectOpen: props.editSession.isOverlayOpen,
  })

  switch (props.cell.fieldMetadata.kind) {
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
        <JsonTableDisplayCell
          fieldMetadata={props.cell.fieldMetadata}
          value={props.cell.effectiveValue}
        />
      )
  }
}
