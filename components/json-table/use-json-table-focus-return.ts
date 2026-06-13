import * as React from "react"

import type {
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session"

export function useJsonTableFocusReturn({
  shellRef,
  isCellEditing,
  primitiveActiveCell,
  structuredEditSession,
}: {
  shellRef: React.RefObject<HTMLTableCellElement | null>
  isCellEditing: boolean
  primitiveActiveCell: JsonTablePrimitiveActiveCell | null
  structuredEditSession: JsonTableStructuredEditSession | null
}) {
  const wasEditingRef = React.useRef(isCellEditing)

  React.useLayoutEffect(() => {
    if (
      wasEditingRef.current &&
      !isCellEditing &&
      !primitiveActiveCell &&
      !structuredEditSession
    ) {
      shellRef.current?.focus({ preventScroll: true })
    }
    wasEditingRef.current = isCellEditing
  }, [isCellEditing, primitiveActiveCell, shellRef, structuredEditSession])
}
