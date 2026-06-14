"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { dataCellPickerTriggerClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import type { DataCellSelectControlProps } from "@/registry/new-york-v4/ui/data-cell-control-contract"
import { useDataCellSelectActivation } from "@/registry/new-york-v4/ui/data-cell-select-activation"
import { useDataCellSelectKeyboard } from "@/registry/new-york-v4/ui/data-cell-select-keyboard"
import { DataCellSelectPopup } from "@/registry/new-york-v4/ui/data-cell-select-popup"
import { useDataCellSelectState } from "@/registry/new-york-v4/ui/data-cell-select-state"

export function DataCellSelectControl({
  kind,
  value,
  disabled = false,
  name,
  placeholder = "Select...",
  className,
  formatValue,
  autoFocus,
  activationSource,
  open,
  options,
  onCommit,
  onEditingEnd,
  onOpenChange,
  onEditorHandleChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onDoubleClick,
  ...props
}: DataCellSelectControlProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popupId = React.useId()
  const select = useDataCellSelectState({
    popupId,
    value,
    placeholder,
    formatValue,
    open,
    selectOptions: options,
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
  const selectOnKeyDown = useDataCellSelectKeyboard({
    activeOption: select.activeOption,
    open: select.open,
    options,
    openEditor: openActivatedEditor,
    closeEditor: closeActivatedEditor,
    commitValue,
    setActiveOptionIndex: select.setActiveOptionIndex,
    shouldCancelDismiss,
  })

  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        name={name}
        role="combobox"
        aria-expanded={select.open}
        aria-controls={select.open ? popupId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={select.activeDescendantId}
        disabled={disabled}
        data-slot="data-cell"
        data-kind={kind}
        data-mode="edit"
        className={cn(dataCellPickerTriggerClass, className)}
        onFocus={onFocus}
        onBlur={(event) => {
          onBlur?.(event)
          const nextFocusTarget = event.relatedTarget
          const isPopupFocus =
            nextFocusTarget instanceof Node &&
            document.getElementById(popupId)?.contains(nextFocusTarget)
          if (!isPopupFocus && !shouldCancelDismiss("focus-out", undefined)) {
            closeActivatedEditor()
          }
        }}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return
          if (!select.open) {
            openActivatedEditor()
            return
          }
          if (!shouldCancelDismiss("trigger-press", event.nativeEvent)) {
            closeActivatedEditor()
          }
        }}
        onDoubleClick={onDoubleClick}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented) return
          selectOnKeyDown(event)
        }}
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
          options={options}
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
