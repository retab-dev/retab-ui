// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useDataCellSelectState } from "@/registry/new-york-v4/ui/data-cell-select-state"
import type { DataCellPrimitiveSession } from "@/registry/new-york-v4/ui/data-cell-session"
import type {
  DataCellCommitValue,
  DataCellSelectOption,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

const options: DataCellSelectOption[] = [
  { value: "a", label: "A", disabled: true },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
]

function anchorElement() {
  const anchor = document.createElement("button")
  anchor.getBoundingClientRect = () =>
    ({
      bottom: 40,
      left: 10,
      top: 8,
      width: 120,
    }) as DOMRect
  return anchor
}

function createTestSelectSession({
  onCommit = vi.fn(),
  onEditingEnd = vi.fn(),
}: {
  onCommit?: (value: DataCellCommitValue, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
} = {}): DataCellPrimitiveSession {
  let didFinish = false
  return {
    commit(value, meta) {
      if (didFinish) return
      didFinish = true
      onCommit(value, meta)
      onEditingEnd()
    },
    cancel() {
      if (didFinish) return
      didFinish = true
      onEditingEnd()
    },
    end() {
      if (didFinish) return
      didFinish = true
      onEditingEnd()
    },
    reset() {
      didFinish = false
    },
  }
}

describe("DataCell select state", () => {
  it("opens from an anchor and activates the selected option", () => {
    const { result } = renderHook(() =>
      useDataCellSelectState({
        popupId: "select",
        value: "b",
        selectOptions: options,
        session: createTestSelectSession(),
      })
    )

    act(() => result.current.openEditor(anchorElement()))

    expect(result.current.open).toBe(true)
    expect(result.current.activeOptionIndex).toBe(1)
    expect(result.current.activeDescendantId).toBe("select-option-1")
    expect(result.current.popupPosition).toMatchObject({ left: 10, width: 120 })
  })

  it("commits a changed value once and finishes editing once", () => {
    const onCommit = vi.fn()
    const onEditingEnd = vi.fn()
    const { result } = renderHook(() =>
      useDataCellSelectState({
        popupId: "select",
        value: "b",
        selectOptions: options,
        session: createTestSelectSession({ onCommit, onEditingEnd }),
      })
    )

    act(() => result.current.openEditor(anchorElement()))
    act(() => result.current.commitValue("c"))
    act(() => result.current.commitValue("c"))

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith("c", {
      kind: "select",
      rawValue: "c",
      isEmpty: false,
      isValid: true,
    })
    expect(onEditingEnd).toHaveBeenCalledTimes(1)
    expect(result.current.open).toBe(false)
  })

  it("closes without committing when the current value is chosen", () => {
    const onCommit = vi.fn()
    const onEditingEnd = vi.fn()
    const { result } = renderHook(() =>
      useDataCellSelectState({
        popupId: "select",
        value: "b",
        selectOptions: options,
        session: createTestSelectSession({ onCommit, onEditingEnd }),
      })
    )

    act(() => result.current.openEditor(anchorElement()))
    act(() => result.current.commitValue("b"))

    expect(onCommit).not.toHaveBeenCalled()
    expect(onEditingEnd).toHaveBeenCalledTimes(1)
    expect(result.current.open).toBe(false)
  })
})
