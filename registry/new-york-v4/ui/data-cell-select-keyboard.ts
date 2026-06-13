"use client"

import * as React from "react"

import {
  firstEnabledDataCellSelectOptionIndex,
  lastEnabledDataCellSelectOptionIndex,
  nextEnabledDataCellSelectOptionIndex,
} from "@/registry/new-york-v4/ui/data-cell-select-navigation"
import type { DataCellSelectOption } from "@/registry/new-york-v4/ui/data-cell-types"

export function useDataCellSelectKeyboard({
  activeOption,
  open,
  options,
  openEditor,
  closeEditor,
  commitValue,
  setActiveOptionIndex,
  shouldCancelDismiss,
}: {
  activeOption: DataCellSelectOption | undefined
  open: boolean
  options: DataCellSelectOption[]
  openEditor: () => void
  closeEditor: () => void
  commitValue: (value: string) => void
  setActiveOptionIndex: React.Dispatch<React.SetStateAction<number>>
  shouldCancelDismiss: (kind: "escape", event: Event | undefined) => boolean
}) {
  return React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") {
        event.preventDefault()
        if (!shouldCancelDismiss("escape", event.nativeEvent)) closeEditor()
        return
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        if (!open) {
          openEditor()
          return
        }
        setActiveOptionIndex((currentIndex) =>
          nextEnabledDataCellSelectOptionIndex({
            options,
            currentIndex,
            direction: event.key === "ArrowDown" ? 1 : -1,
          })
        )
        return
      }

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault()
        if (!open) {
          openEditor()
          return
        }
        setActiveOptionIndex(
          event.key === "Home"
            ? firstEnabledDataCellSelectOptionIndex(options)
            : lastEnabledDataCellSelectOptionIndex(options)
        )
        return
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        if (!open) {
          openEditor()
          return
        }
        if (activeOption && !activeOption.disabled) {
          commitValue(activeOption.value)
        }
      }
    },
    [
      activeOption,
      closeEditor,
      commitValue,
      open,
      openEditor,
      options,
      setActiveOptionIndex,
      shouldCancelDismiss,
    ]
  )
}
