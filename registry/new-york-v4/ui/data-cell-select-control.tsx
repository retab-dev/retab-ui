"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  useDataCellOpeningContext,
  type DataCellDismissCause,
} from "@/registry/new-york-v4/ui/data-cell-activation"
import { dataCellPickerTriggerClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import {
  DataCellSelectPopup,
  getDataCellSelectPopupPosition,
  nextEnabledDataCellSelectOptionIndex,
  selectedDataCellSelectOptionIndex,
  type DataCellSelectPopupPosition,
} from "@/registry/new-york-v4/ui/data-cell-select-popup"
import type {
  DataCellProps,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellSelectControlProps = DataCellProps & { kind: "select" }

function selectValueMeta(value: string | null): DataCellValueMeta {
  return {
    kind: "select",
    rawValue: value ?? "",
    isEmpty: value === null || value === "",
    isValid: true,
  }
}

function dataCellSelectDismissCause(
  kind: DataCellDismissCause["kind"],
  event: Event | undefined
): DataCellDismissCause {
  if (kind === "outside-pointer" && event instanceof PointerEvent) {
    return { kind, event }
  }
  if (kind === "escape" && event instanceof KeyboardEvent)
    return { kind, event }
  if (kind === "trigger-press") return { kind, event }
  if (kind === "focus-out") return { kind, event }
  if (kind === "cancel-open") return { kind, event }
  return { kind: "unknown", event }
}

export function DataCellSelectControl({
  kind,
  value,
  editable: _editable,
  active: _active,
  mode: _mode,
  disabled = false,
  name: _name,
  placeholder = "Select...",
  dateTimeZone: _dateTimeZone,
  showPickerIcon: _showPickerIcon,
  className,
  formatValue,
  draftValue: _draftValue,
  autoFocus,
  activationSource,
  isPickerOpen,
  selectOptions,
  onDraftValueChange: _onDraftValueChange,
  onCommit,
  onEditingEnd,
  onActiveChange: _onActiveChange,
  onPickerOpenChange,
  onEditorHandleChange,
  onFocus: _onFocus,
  onBlur: _onBlur,
  onKeyDown: _onKeyDown,
  onClick: _onClick,
  onDoubleClick: _onDoubleClick,
  ...props
}: DataCellSelectControlProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popupId = React.useId()
  const openingContext = useDataCellOpeningContext(activationSource, {
    enabled: Boolean(autoFocus),
  })
  const lastCommittedValueRef = React.useRef<string | null>(null)
  const didFinishEditingRef = React.useRef(false)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = React.useState(-1)
  const [popupPosition, setPopupPosition] =
    React.useState<DataCellSelectPopupPosition | null>(null)
  const open = isPickerOpen ?? uncontrolledOpen
  const selectedValue = value ?? null
  const selectedOption = selectOptions.find((option) => option.value === value)
  const activeOption = selectOptions[activeOptionIndex]
  const activeDescendantId =
    open && activeOptionIndex >= 0
      ? `${popupId}-option-${activeOptionIndex}`
      : undefined
  const displayValue =
    formatValue?.(selectedValue, { kind }) ?? selectedOption?.label ?? ""
  const isEmpty = displayValue === ""

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setPopupPosition(null)
      if (isPickerOpen === undefined) setUncontrolledOpen(nextOpen)
      onPickerOpenChange?.(nextOpen)
    },
    [isPickerOpen, onPickerOpenChange]
  )

  const openSelectEditor = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    setPopupPosition(
      getDataCellSelectPopupPosition({
        rect: trigger.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
    )
    setActiveOptionIndex(
      selectedDataCellSelectOptionIndex({
        options: selectOptions,
        value: selectedValue,
      })
    )
    setOpen(true)
  }, [selectOptions, selectedValue, setOpen])

  const finishSelectEditing = React.useCallback(() => {
    if (didFinishEditingRef.current) return
    didFinishEditingRef.current = true
    onEditingEnd?.()
  }, [onEditingEnd])

  const closeSelectEditor = React.useCallback(() => {
    openingContext.release()
    setOpen(false)
    finishSelectEditing()
  }, [finishSelectEditing, openingContext, setOpen])

  const commitSelectValue = React.useCallback(
    (nextValue: string) => {
      if (selectedValue === nextValue) {
        closeSelectEditor()
        return
      }
      if (lastCommittedValueRef.current === nextValue) return
      lastCommittedValueRef.current = nextValue
      openingContext.release()
      setOpen(false)
      onCommit?.(nextValue, selectValueMeta(nextValue))
      finishSelectEditing()
    },
    [
      closeSelectEditor,
      finishSelectEditing,
      onCommit,
      openingContext,
      selectedValue,
      setOpen,
    ]
  )

  const cancelDismissDuringOpening = React.useCallback(
    (kind: DataCellDismissCause["kind"], event: Event | undefined) => {
      if (
        !openingContext.shouldCancelDismiss(
          dataCellSelectDismissCause(kind, event)
        )
      ) {
        return false
      }

      event?.preventDefault()
      setOpen(true)
      return true
    },
    [openingContext, setOpen]
  )

  React.useLayoutEffect(() => {
    onEditorHandleChange?.({
      finish: closeSelectEditor,
      cancel: closeSelectEditor,
    })
    return () => onEditorHandleChange?.(null)
  }, [closeSelectEditor, onEditorHandleChange])

  React.useLayoutEffect(() => {
    if (!autoFocus) return
    lastCommittedValueRef.current = null
    didFinishEditingRef.current = false
    triggerRef.current?.focus({ preventScroll: true })
    openSelectEditor()
  }, [autoFocus, openSelectEditor])

  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={activeDescendantId}
        disabled={disabled}
        data-slot="data-cell"
        data-kind={kind}
        data-mode="edit"
        className={cn(dataCellPickerTriggerClass, className)}
        onBlur={(event) => {
          const nextFocusTarget = event.relatedTarget
          if (
            nextFocusTarget instanceof Node &&
            document.getElementById(popupId)?.contains(nextFocusTarget)
          ) {
            return
          }
          if (cancelDismissDuringOpening("focus-out", undefined)) return
          closeSelectEditor()
        }}
        onClick={(event) => {
          if (open) {
            if (
              cancelDismissDuringOpening("trigger-press", event.nativeEvent)
            ) {
              return
            }
            closeSelectEditor()
            return
          }

          openSelectEditor()
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            if (!cancelDismissDuringOpening("escape", event.nativeEvent)) {
              closeSelectEditor()
            }
            return
          }

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            if (!open) {
              openSelectEditor()
              return
            }
            setActiveOptionIndex((currentIndex) =>
              nextEnabledDataCellSelectOptionIndex({
                options: selectOptions,
                currentIndex,
                direction: event.key === "ArrowDown" ? 1 : -1,
              })
            )
            return
          }

          if (event.key === "Home" || event.key === "End") {
            event.preventDefault()
            if (!open) {
              openSelectEditor()
              return
            }
            const enabledOptions = selectOptions
              .map((option, index) => ({ option, index }))
              .filter(({ option }) => !option.disabled)
            const nextOption =
              event.key === "Home"
                ? enabledOptions[0]
                : enabledOptions[enabledOptions.length - 1]
            setActiveOptionIndex(nextOption?.index ?? -1)
            return
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            if (!open) {
              openSelectEditor()
              return
            }
            if (activeOption && !activeOption.disabled) {
              commitSelectValue(activeOption.value)
            }
          }
        }}
      >
        <span
          data-slot="select-value"
          className={cn("flex-1 truncate", isEmpty && "text-muted-foreground")}
        >
          {isEmpty ? placeholder : displayValue}
        </span>
        <ChevronDown className="-me-1 size-4.5 opacity-80 sm:size-4" />
      </button>
      {open && triggerRef.current && popupPosition ? (
        <DataCellSelectPopup
          anchor={triggerRef.current}
          id={popupId}
          position={popupPosition}
          activeDescendantId={activeDescendantId}
          value={selectedValue}
          activeIndex={activeOptionIndex}
          options={selectOptions}
          onActiveIndexChange={setActiveOptionIndex}
          onCommit={commitSelectValue}
          onCancel={closeSelectEditor}
          onOutsidePointerDown={(event) => {
            if (cancelDismissDuringOpening("outside-pointer", event)) return
            closeSelectEditor()
          }}
        />
      ) : null}
    </>
  )
}
