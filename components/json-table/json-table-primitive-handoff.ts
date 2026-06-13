import type * as React from "react"
import { flushSync } from "react-dom"

import type { DataCellEditorHandle } from "@/components/ui/data-cell"
import type {
  JsonTableCellId,
  JsonTablePrimitiveActiveCell,
} from "@/components/json-table/json-table-edit-session"

export function finishPreviousPrimitiveEditor({
  currentCellId,
  primitiveActiveCell,
  primitiveEditorHandleRef,
  setPrimitiveActiveCell,
}: {
  currentCellId: JsonTableCellId | null
  primitiveActiveCell: JsonTablePrimitiveActiveCell | null
  primitiveEditorHandleRef: React.RefObject<DataCellEditorHandle | null>
  setPrimitiveActiveCell: (
    activeCell: JsonTablePrimitiveActiveCell | null
  ) => void
}) {
  if (primitiveActiveCell?.cellId === currentCellId) {
    return
  }
  if (!primitiveActiveCell && !primitiveEditorHandleRef.current) {
    return
  }

  // Same-event cell switching must finish the dirty editor before React swaps
  // active identity; otherwise blur/unmount ordering can drop the draft.
  flushSync(() => {
    primitiveEditorHandleRef.current?.finish()
    primitiveEditorHandleRef.current = null
    setPrimitiveActiveCell(null)
  })
}
