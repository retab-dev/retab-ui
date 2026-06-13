"use client"

import * as React from "react"
import { CalendarIcon, ClockIcon } from "lucide-react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  useDataCellOpeningContext,
  type DataCellDismissCause,
} from "@/registry/new-york-v4/ui/data-cell-activation"
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
import { getDataCellPickerPopupStyleFromAnchor } from "@/registry/new-york-v4/ui/data-cell-picker-position"
import type {
  DataCellActivationSource,
  DataCellDateTimeZone,
  DataCellEditorHandle,
  DataCellKind,
  DataCellValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellPickerNativeProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "children"
  | "className"
  | "defaultValue"
  | "disabled"
  | "name"
  | "onChange"
  | "type"
  | "value"
>

export type DataCellPickerControlProps = DataCellPickerNativeProps & {
  kind: "date" | "time" | "date-time"
  value?: string | null
  disabled?: boolean
  placeholder?: string
  dateTimeZone?: DataCellDateTimeZone
  showPickerIcon?: boolean
  className?: string
  formatValue?: (
    value: string | null | undefined,
    meta: { kind: "date" | "time" | "date-time" }
  ) => React.ReactNode
  draftValue?: string
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  open?: boolean
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onCommit?: (value: string | null, meta: DataCellValueMeta) => void
  onOpenChange?: (open: boolean) => void
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

function dataCellOutsidePointerDismissCause(
  event: PointerEvent
): DataCellDismissCause {
  return {
    kind: "outside-pointer",
    event,
  }
}

function dataCellTriggerPressDismissCause(event: Event): DataCellDismissCause {
  return {
    kind: "trigger-press",
    event,
  }
}

function dataCellEscapeDismissCause(
  event: KeyboardEvent
): DataCellDismissCause {
  return {
    kind: "escape",
    event,
  }
}

export function DataCellPickerControl({
  kind,
  value,
  disabled = false,
  placeholder,
  dateTimeZone = "local",
  showPickerIcon = true,
  className,
  formatValue,
  draftValue,
  autoFocus,
  activationSource,
  open: controlledOpen,
  onDraftValueChange,
  onCommit,
  onOpenChange,
  onEditingEnd,
  onEditorHandleChange,
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
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popupRef = React.useRef<HTMLDivElement>(null)
  const popupStyleRef = React.useRef<React.CSSProperties | null>(null)
  const openingContext = useDataCellOpeningContext(activationSource, {
    enabled: Boolean(autoFocus),
  })
  const [popupStyle, setPopupStyle] = React.useState<React.CSSProperties | null>(
    null
  )
  const popupId = React.useId()
  const open = controlledOpen ?? uncontrolledOpen
  const pickerValue = draftValue ?? uncontrolledDraftValue
  const selectedDate = dateFromPickerValue(kind, pickerValue)
  const timeValue = timeFromPickerValue(kind, pickerValue)
  const content =
    formatValue?.(pickerValue, { kind }) ??
    formatDataCellDisplayValue(kind, pickerValue)
  const isEmpty = content === ""
  const setOpen = React.useCallback(
    (open: boolean) => {
      if (!open) {
        popupStyleRef.current = null
        setPopupStyle(null)
      }
      if (controlledOpen === undefined) setUncontrolledOpen(open)
      onOpenChange?.(open)
    },
    [controlledOpen, onOpenChange]
  )

  React.useEffect(() => {
    if (draftValue !== undefined) return
    setUncontrolledDraftValue(formatDataCellEditValue(kind, value))
  }, [draftValue, kind, value])

  const closePopup = React.useCallback(() => {
    openingContext.release()
    setOpen(false)
    onEditingEnd?.()
  }, [onEditingEnd, openingContext, setOpen])

  const measurePopupStyle = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return null

    return getDataCellPickerPopupStyleFromAnchor({
      anchor: trigger,
      kind,
    })
  }, [kind])

  const openPopup = React.useCallback(() => {
    if (!popupStyleRef.current) {
      popupStyleRef.current = measurePopupStyle()
    }
    if (!popupStyleRef.current) return

    setPopupStyle(popupStyleRef.current)
    setOpen(true)
  }, [measurePopupStyle, setOpen])

  React.useLayoutEffect(() => {
    onEditorHandleChange?.({
      finish: closePopup,
      cancel: closePopup,
    })
    return () => onEditorHandleChange?.(null)
  }, [closePopup, onEditorHandleChange])

  React.useLayoutEffect(() => {
    if (!autoFocus) return
    triggerRef.current?.focus({ preventScroll: true })
    openPopup()
  }, [autoFocus, openPopup])

  React.useLayoutEffect(() => {
    if (!open || popupStyleRef.current) return
    popupStyleRef.current = measurePopupStyle()
    if (popupStyleRef.current) setPopupStyle(popupStyleRef.current)
  }, [measurePopupStyle, open])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        openingContext.shouldCancelDismiss(
          dataCellOutsidePointerDismissCause(event)
        )
      ) {
        return
      }
      if (triggerRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      closePopup()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      openingContext.release()
      if (
        !openingContext.shouldCancelDismiss(dataCellEscapeDismissCause(event))
      ) {
        closePopup()
      }
    }
    const handleViewportChange = () => closePopup()

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
  }, [closePopup, open, openingContext])

  const updatePickerValue = (nextValue: string, commit = false) => {
    if (draftValue === undefined) setUncontrolledDraftValue(nextValue)
    const meta = getDataCellValueMeta({ kind, value: nextValue })
    onDraftValueChange?.(nextValue, meta)
    if (commit) {
      const commitValue = parseDataCellInputValue({
          kind,
          value: nextValue,
          dateTimeZone,
          previousValue: value as DataCellValue,
        }) as string | null
      onCommit?.(commitValue, meta)
    }
  }

  const pickerPopup =
    open && popupStyle && typeof globalThis.document !== "undefined"
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
          if (
            openingContext.shouldCancelDismiss(
              dataCellTriggerPressDismissCause(event.nativeEvent)
            )
          ) {
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
          defaultMonth={selectedDate}
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
