import * as React from "react"

import type {
  JsonTableCellId,
  JsonTablePrimitiveActiveCell,
} from "@/components/json-table/json-table-edit-session"

type PrimitiveActiveCellListener = () => void

export type JsonTablePrimitiveActiveCellStore = {
  getSnapshot: () => JsonTablePrimitiveActiveCell | null
  setSnapshot: (activeCell: JsonTablePrimitiveActiveCell | null) => void
  subscribe: (listener: PrimitiveActiveCellListener) => () => void
}

export function createJsonTablePrimitiveActiveCellStore(): JsonTablePrimitiveActiveCellStore {
  let activeCell: JsonTablePrimitiveActiveCell | null = null
  const listeners = new Set<PrimitiveActiveCellListener>()

  return {
    getSnapshot: () => activeCell,
    setSnapshot(nextActiveCell) {
      if (activeCell?.cellId === nextActiveCell?.cellId) return
      activeCell = nextActiveCell
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function useJsonTablePrimitiveActiveCell({
  cellId,
  store,
}: {
  cellId: JsonTableCellId | null
  store: JsonTablePrimitiveActiveCellStore
}) {
  return React.useSyncExternalStore(
    store.subscribe,
    () => {
      const activeCell = store.getSnapshot()
      return activeCell?.cellId === cellId ? activeCell : null
    },
    () => null
  )
}

