import { flushSync } from "react-dom"

import type { JsonTablePrimitiveActiveCell } from "@/components/json-table/json-table-edit-session"
import type {
  JsonTablePrimitiveActiveCellStore,
  SetJsonTablePrimitiveActiveCell,
} from "@/components/json-table/json-table-primitive-active-cell-store"

export function replaceJsonTablePrimitiveActiveCell({
  nextActiveCell,
  setPrimitiveActiveCell,
  store,
}: {
  nextActiveCell: JsonTablePrimitiveActiveCell
  setPrimitiveActiveCell: SetJsonTablePrimitiveActiveCell
  store: JsonTablePrimitiveActiveCellStore
}) {
  const activeCell = store.getSnapshot()
  if (activeCell && activeCell.cellId !== nextActiveCell.cellId) {
    flushSync(() => setPrimitiveActiveCell(null))
  }
  setPrimitiveActiveCell(nextActiveCell)
}
