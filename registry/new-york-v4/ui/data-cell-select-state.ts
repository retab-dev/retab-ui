"use client"

import * as React from "react"

import { selectedDataCellSelectOptionIndex } from "@/registry/new-york-v4/ui/data-cell-select-navigation"
import {
  getDataCellSelectPopupPosition,
  type DataCellSelectPopupPosition,
} from "@/registry/new-york-v4/ui/data-cell-select-popup-position"
import type {
  DataCellSelectOption,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellSelectFormatValue = (
  value: string | null | undefined,
  meta: { kind: "select" }
) => React.ReactNode

export type DataCellSelectState = {
  activeDescendantId: string | undefined
  activeOption: DataCellSelectOption | undefined
  activeOptionIndex: number
  closeEditor: () => void
  commitValue: (nextValue: string) => void
  displayValue: React.ReactNode
  isEmpty: boolean
  keepOpen: () => void
  open: boolean
  openEditor: (trigger: HTMLElement | null) => void
  placeholder: string
  popupPosition: DataCellSelectPopupPosition | null
  selectedValue: string | null
  setActiveOptionIndex: React.Dispatch<React.SetStateAction<number>>
}

export function useDataCellSelectState({
  popupId,
  value,
  placeholder = "Select...",
  formatValue,
  open: controlledOpen,
  selectOptions,
  onCommit,
  onEditingEnd,
  onOpenChange,
}: {
  popupId: string
  value?: string | null
  placeholder?: string
  formatValue?: DataCellSelectFormatValue
  open?: boolean
  selectOptions: DataCellSelectOption[]
  onCommit?: (value: string | null, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onOpenChange?: (open: boolean) => void
}): DataCellSelectState {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = React.useState(-1)
  const popupPositionRef = React.useRef<DataCellSelectPopupPosition | null>(
    null
  )
  const [popupPosition, setPopupPosition] =
    React.useState<DataCellSelectPopupPosition | null>(null)
  const lastCommittedValueRef = React.useRef<string | null>(null)
  const didFinishEditingRef = React.useRef(false)

  const open = controlledOpen ?? uncontrolledOpen
  const selectedValue = value ?? null
  const selectedOption = selectOptions.find((option) => option.value === value)
  const activeOption = selectOptions[activeOptionIndex]
  const activeDescendantId =
    open && activeOptionIndex >= 0
      ? `${popupId}-option-${activeOptionIndex}`
      : undefined
  const displayValue =
    formatValue?.(selectedValue, { kind: "select" }) ??
    selectedOption?.label ??
    ""
  const isEmpty = displayValue === ""

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        popupPositionRef.current = null
        setPopupPosition(null)
      }
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [controlledOpen, onOpenChange]
  )

  const keepOpen = React.useCallback(() => {
    if (controlledOpen === undefined) setUncontrolledOpen(true)
    onOpenChange?.(true)
  }, [controlledOpen, onOpenChange])

  const finishEditing = React.useCallback(() => {
    if (didFinishEditingRef.current) return
    didFinishEditingRef.current = true
    onEditingEnd?.()
  }, [onEditingEnd])

  const closeEditor = React.useCallback(() => {
    setOpen(false)
    finishEditing()
  }, [finishEditing, setOpen])

  const openEditor = React.useCallback(
    (trigger: HTMLElement | null) => {
      if (!trigger) return
      if (!popupPositionRef.current) {
        popupPositionRef.current = getDataCellSelectPopupPosition({
          anchorRect: trigger.getBoundingClientRect(),
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        })
      }
      setPopupPosition(popupPositionRef.current)
      setActiveOptionIndex(
        selectedDataCellSelectOptionIndex({
          options: selectOptions,
          value: selectedValue,
        })
      )
      lastCommittedValueRef.current = null
      didFinishEditingRef.current = false
      setOpen(true)
    },
    [selectOptions, selectedValue, setOpen]
  )

  const commitValue = React.useCallback(
    (nextValue: string) => {
      if (selectedValue === nextValue) {
        closeEditor()
        return
      }
      if (lastCommittedValueRef.current === nextValue) return
      lastCommittedValueRef.current = nextValue
      setOpen(false)
      onCommit?.(nextValue, selectValueMeta(nextValue))
      finishEditing()
    },
    [closeEditor, finishEditing, onCommit, selectedValue, setOpen]
  )

  return {
    activeDescendantId,
    activeOption,
    activeOptionIndex,
    closeEditor,
    commitValue,
    displayValue,
    isEmpty,
    keepOpen,
    open,
    openEditor,
    placeholder,
    popupPosition,
    selectedValue,
    setActiveOptionIndex,
  }
}

function selectValueMeta(value: string | null): DataCellValueMeta {
  return {
    kind: "select",
    rawValue: value ?? "",
    isEmpty: value === null || value === "",
    isValid: true,
  }
}
