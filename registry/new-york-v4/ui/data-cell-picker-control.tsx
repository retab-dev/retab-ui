"use client"

import * as React from "react"
import { CalendarIcon, ClockIcon } from "lucide-react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { dataCellPickerTriggerClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import {
  dateFromPickerValue,
  formatDataCellDisplayValue,
  formatDataCellEditValue,
  getDataCellValueMeta,
  parseDataCellInputValue,
  pickerValueWithDate,
  pickerValueWithTime,
  timeFromPickerValue,
} from "@/registry/new-york-v4/ui/data-cell-format"
import { getDataCellPickerPopupStyle } from "@/registry/new-york-v4/ui/data-cell-picker-position"
import type {
  DataCellCommitHandler,
  DataCellDateTimeZone,
  DataCellKind,
  DataCellProps,
  DataCellValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellPickerControlProps = DataCellProps & {
  kind: "date" | "time" | "date-time"
  value?: string | null
}

export function DataCellPickerControl({
  kind,
  value,
  editable: _editable,
  mode: _mode,
  disabled = false,
  name: _name,
  placeholder,
  dateTimeZone = "local",
  showPickerIcon = true,
  className,
  formatValue: _formatValue,
  draftValue,
  autoFocus,
  activationIntent,
  isPickerOpen,
  onDraftValueChange,
  onCommit,
  onPickerOpenChange,
  onEditingEnd,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onDoubleClick,
  ...props
}: DataCellPickerControlProps) {
  const initialPickerValue = formatDataCellEditValue(kind, value)
  const [uncontrolledDraftValue, setUncontrolledDraftValue] =
    React.useState(initialPickerValue)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    Boolean(autoFocus)
  )
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const shouldSkipAutoFocusClick =
    Boolean(autoFocus) && activationIntent?.type === "pointer"
  const skipAutoFocusClickRef = React.useRef(shouldSkipAutoFocusClick)
  const openingPointerDownRef = React.useRef(
    activationIntent?.type === "pointer"
      ? { clientX: activationIntent.clientX, clientY: activationIntent.clientY }
      : null
  )
  const openingPointerDownTimerRef = React.useRef<ReturnType<
    typeof globalThis.setTimeout
  > | null>(null)
  const [popupStyle, setPopupStyle] = React.useState<React.CSSProperties>()
  const popupId = React.useId()
  const open = isPickerOpen ?? uncontrolledOpen
  const pickerValue = draftValue ?? uncontrolledDraftValue
  const selectedDate = dateFromPickerValue(kind, pickerValue)
  const timeValue = timeFromPickerValue(kind, pickerValue)
  const content = formatDataCellDisplayValue(kind, pickerValue)
  const isEmpty = content === ""
  const setOpen = React.useCallback(
    (open: boolean) => {
      if (isPickerOpen === undefined) setUncontrolledOpen(open)
      onPickerOpenChange?.(open)
    },
    [isPickerOpen, onPickerOpenChange]
  )

  React.useEffect(() => {
    if (draftValue !== undefined) return
    setUncontrolledDraftValue(formatDataCellEditValue(kind, value))
  }, [draftValue, kind, value])

  React.useEffect(() => {
    skipAutoFocusClickRef.current = shouldSkipAutoFocusClick
  }, [shouldSkipAutoFocusClick])

  const closePopup = React.useCallback(() => {
    setOpen(false)
    onEditingEnd?.()
  }, [onEditingEnd, setOpen])

  const updatePopupPosition = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    setPopupStyle(
      getDataCellPickerPopupStyle({
        kind,
        rect: trigger.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
    )
  }, [kind])

  const openPopup = React.useCallback(() => {
    updatePopupPosition()
    setOpen(true)
  }, [setOpen, updatePopupPosition])

  React.useLayoutEffect(() => {
    if (!autoFocus) return
    if (openingPointerDownTimerRef.current !== null) {
      globalThis.clearTimeout(openingPointerDownTimerRef.current)
      openingPointerDownTimerRef.current = null
    }
    skipAutoFocusClickRef.current = shouldSkipAutoFocusClick
    openingPointerDownRef.current =
      activationIntent?.type === "pointer"
        ? {
            clientX: activationIntent.clientX,
            clientY: activationIntent.clientY,
          }
        : null
    openingPointerDownTimerRef.current = globalThis.setTimeout(() => {
      openingPointerDownRef.current = null
      openingPointerDownTimerRef.current = null
    }, 0)
    updatePopupPosition()
    setOpen(true)
  }, [
    activationIntent,
    autoFocus,
    setOpen,
    shouldSkipAutoFocusClick,
    updatePopupPosition,
  ])

  React.useEffect(
    () => () => {
      if (openingPointerDownTimerRef.current === null) return
      globalThis.clearTimeout(openingPointerDownTimerRef.current)
      openingPointerDownTimerRef.current = null
    },
    []
  )

  React.useLayoutEffect(() => {
    if (open) updatePopupPosition()
  }, [open, updatePopupPosition])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const openingPointerDown = openingPointerDownRef.current
      if (
        openingPointerDown &&
        openingPointerDown.clientX === event.clientX &&
        openingPointerDown.clientY === event.clientY
      ) {
        openingPointerDownRef.current = null
        return
      }
      if (triggerRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      closePopup()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopup()
    }
    const handleViewportChange = () => updatePopupPosition()

    globalThis.document.addEventListener("pointerdown", handlePointerDown)
    globalThis.document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)
    return () => {
      globalThis.document.removeEventListener("pointerdown", handlePointerDown)
      globalThis.document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("scroll", handleViewportChange, true)
    }
  }, [closePopup, open, updatePopupPosition])

  const updatePickerValue = (nextValue: string, commit = false) => {
    if (draftValue === undefined) setUncontrolledDraftValue(nextValue)
    const meta = getDataCellValueMeta({ kind, value: nextValue })
    onDraftValueChange?.(nextValue, meta)
    if (commit) {
      ;(onCommit as DataCellCommitHandler | undefined)?.(
        parseDataCellInputValue({
          kind,
          value: nextValue,
          dateTimeZone: dateTimeZone as DataCellDateTimeZone,
          previousValue: value as DataCellValue,
        }),
        meta
      )
    }
  }

  const pickerPopup =
    open && typeof globalThis.document !== "undefined"
      ? createPortal(
          <div
            ref={popupRef}
            id={popupId}
            role="dialog"
            data-slot="data-cell-picker-popup"
            className="fixed rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg/5 outline-none not-dark:bg-clip-padding"
            style={popupStyle}
          >
            <DataCellPickerPopupContent
              kind={kind}
              selectedDate={selectedDate}
              timeValue={timeValue}
              onDateSelect={(nextDate) => {
                if (kind === "time") return
                if (!nextDate) return
                const nextValue = pickerValueWithDate(
                  kind,
                  pickerValue,
                  nextDate
                )
                updatePickerValue(nextValue, true)
                if (kind === "date") closePopup()
              }}
              onTimeChange={(nextTime) => {
                if (kind === "date") return
                updatePickerValue(
                  pickerValueWithTime(kind, pickerValue, nextTime),
                  true
                )
              }}
            />
          </div>,
          globalThis.document.body
        )
      : null

  return (
    <>
      <button
        ref={triggerRef}
        {...props}
        type="button"
        data-slot="data-cell"
        data-kind={kind}
        data-mode="edit"
        data-empty={isEmpty || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(dataCellPickerTriggerClass, className)}
        onFocus={onFocus}
        onBlur={(event) => {
          const relatedTarget = event.relatedTarget
          if (
            relatedTarget instanceof Node &&
            popupRef.current?.contains(relatedTarget)
          ) {
            return
          }
          onBlur?.(event)
        }}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented || disabled) return
          if (skipAutoFocusClickRef.current) {
            skipAutoFocusClickRef.current = false
            return
          }
          if (open) closePopup()
          else openPopup()
        }}
        onDoubleClick={onDoubleClick}
      >
        <span className={cn("truncate", isEmpty && "text-muted-foreground")}>
          {isEmpty ? (placeholder ?? "—") : content}
        </span>
        {showPickerIcon ? <DataCellPickerIcon kind={kind} /> : null}
      </button>
      {pickerPopup}
    </>
  )
}

function DataCellPickerPopupContent({
  kind,
  selectedDate,
  timeValue,
  onDateSelect,
  onTimeChange,
}: {
  kind: "date" | "time" | "date-time"
  selectedDate: Date | undefined
  timeValue: string
  onDateSelect: (date: Date | undefined) => void
  onTimeChange: (time: string) => void
}) {
  return (
    <>
      {(kind === "date" || kind === "date-time") && (
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
        />
      )}
      {(kind === "time" || kind === "date-time") && (
        <div className="border-t p-2 first:border-t-0">
          <Input
            type="time"
            nativeInput
            value={timeValue}
            onChange={(event) => onTimeChange(event.currentTarget.value)}
          />
        </div>
      )}
    </>
  )
}

export function DataCellPickerIcon({ kind }: { kind: DataCellKind }) {
  if (kind === "time") return <ClockIcon />
  return <CalendarIcon />
}
