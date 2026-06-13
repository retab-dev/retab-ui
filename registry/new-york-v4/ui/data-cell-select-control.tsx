"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { dataCellPickerTriggerClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import { useDataCellSelectActivation } from "@/registry/new-york-v4/ui/data-cell-select-activation"
import { useDataCellSelectKeyboard } from "@/registry/new-york-v4/ui/data-cell-select-keyboard"
import { DataCellSelectPopup } from "@/registry/new-york-v4/ui/data-cell-select-popup"
import { useDataCellSelectState } from "@/registry/new-york-v4/ui/data-cell-select-state"
import type {
  DataCellActivationSource,
  DataCellEditorHandle,
  DataCellSelectOption,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellSelectFormatValue = (
  value: string | null | undefined,
  meta: { kind: "select" }
) => React.ReactNode

export type DataCellSelectControlProps = {
  value?: string | null
  disabled?: boolean
  placeholder?: string
  className?: string
  formatValue?: DataCellSelectFormatValue
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  open?: boolean
  selectOptions: DataCellSelectOption[]
  onCommit?: (value: string | null, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onOpenChange?: (open: boolean) => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

export function DataCellSelectControl({
  value,
  disabled = false,
  placeholder = "Select...",
  className,
  formatValue,
  autoFocus,
  activationSource,
  open,
  selectOptions,
  onCommit,
  onEditingEnd,
  onOpenChange,
  onEditorHandleChange,
}: DataCellSelectControlProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popupId = React.useId()
  const select = useDataCellSelectState({
    popupId,
    value,
    placeholder,
    formatValue,
    open,
    selectOptions,
    onCommit,
    onEditingEnd,
    onOpenChange,
  })
  const openEditor = React.useCallback(() => {
    select.openEditor(triggerRef.current)
  }, [select.openEditor])
  const activation = useDataCellSelectActivation({
    activationSource,
    autoFocus,
    triggerRef,
    openEditor,
    closeEditor: select.closeEditor,
    keepOpen: select.keepOpen,
    onEditorHandleChange,
  })
  const {
    shouldCancelDismiss,
    closeEditor: closeActivatedEditor,
    openEditor: openActivatedEditor,
    release,
  } = activation
  const commitValue = React.useCallback(
    (nextValue: string) => {
      release()
      select.commitValue(nextValue)
    },
    [release, select.commitValue]
  )
  const onKeyDown = useDataCellSelectKeyboard({
    activeOption: select.activeOption,
    open: select.open,
    options: selectOptions,
    openEditor: openActivatedEditor,
    closeEditor: closeActivatedEditor,
    commitValue,
    setActiveOptionIndex: select.setActiveOptionIndex,
    shouldCancelDismiss,
  })

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={select.open}
        aria-controls={select.open ? popupId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={select.activeDescendantId}
        disabled={disabled}
        data-slot="data-cell"
        data-kind="select"
        data-mode="edit"
        className={cn(dataCellPickerTriggerClass, className)}
        onBlur={(event) => {
          const nextFocusTarget = event.relatedTarget
          const isPopupFocus =
            nextFocusTarget instanceof Node &&
            document.getElementById(popupId)?.contains(nextFocusTarget)
          if (!isPopupFocus && !shouldCancelDismiss("focus-out", undefined)) {
            closeActivatedEditor()
          }
        }}
        onClick={(event) => {
          if (!select.open) {
            openActivatedEditor()
            return
          }
          if (!shouldCancelDismiss("trigger-press", event.nativeEvent)) {
            closeActivatedEditor()
          }
        }}
        onKeyDown={onKeyDown}
      >
        <span
          data-slot="select-value"
          className={cn(
            "flex-1 truncate",
            select.isEmpty && "text-muted-foreground"
          )}
        >
          {select.isEmpty ? select.placeholder : select.displayValue}
        </span>
        <ChevronDown className="-me-1 size-4.5 opacity-80 sm:size-4" />
      </button>
      {select.open && triggerRef.current && select.popupPosition ? (
        <DataCellSelectPopup
          anchor={triggerRef.current}
          id={popupId}
          position={select.popupPosition}
          activeDescendantId={select.activeDescendantId}
          value={select.selectedValue}
          activeIndex={select.activeOptionIndex}
          options={selectOptions}
          onActiveIndexChange={select.setActiveOptionIndex}
          onCommit={commitValue}
          onCancel={closeActivatedEditor}
          onOutsidePointerDown={(event) => {
            if (shouldCancelDismiss("outside-pointer", event)) {
              return
            }
            closeActivatedEditor()
          }}
        />
      ) : null}
    </>
  )
}
