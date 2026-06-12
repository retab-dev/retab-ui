import * as React from "react"

export function useElevatedVirtualRow({
  cellRootRef,
  isInputFocused,
  isSelectOpen,
}: {
  cellRootRef: React.RefObject<HTMLDivElement | null>
  isInputFocused: boolean
  isSelectOpen: boolean
}) {
  React.useEffect(() => {
    const editing = isInputFocused || isSelectOpen
    const rowEl = cellRootRef.current?.closest<HTMLElement>("[data-index]")
    if (!rowEl) return
    rowEl.style.zIndex = editing ? "20" : ""
    return () => {
      rowEl.style.zIndex = ""
    }
  }, [cellRootRef, isInputFocused, isSelectOpen])
}
