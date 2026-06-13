"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { dataCellDisplayClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import {
  formatDataCellEditValue,
  getDataCellValueMeta,
  parseDataCellInputValue,
} from "@/registry/new-york-v4/ui/data-cell-format"
import type {
  DataCellActivationIntent,
  DataCellCommitHandler,
  DataCellKind,
  DataCellProps,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellTextControlProps = DataCellProps & { kind: "text" }
export type DataCellNumberControlProps = DataCellProps & {
  kind: "number" | "integer"
}

export type DataCellInputControlProps =
  | DataCellTextControlProps
  | DataCellNumberControlProps

export function DataCellTextControl(props: DataCellTextControlProps) {
  return <DataCellInputControl {...props} />
}

function dataCellTextSelectionIndexFromPointer(
  input: HTMLInputElement,
  clientX: number
) {
  const valueLength = input.value.length
  if (valueLength === 0) return 0

  const rect = input.getBoundingClientRect()
  if (rect.width <= 0) return valueLength

  const styles = globalThis.getComputedStyle(input)
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0
  const contentLeft = rect.left + paddingLeft
  const contentWidth = Math.max(1, rect.width - paddingLeft - paddingRight)
  const ratio = Math.min(1, Math.max(0, (clientX - contentLeft) / contentWidth))

  return Math.min(valueLength, Math.max(0, Math.round(ratio * valueLength)))
}

function focusDataCellTextInput(
  input: HTMLInputElement | null,
  intent: DataCellActivationIntent | undefined
) {
  if (!input) return
  input.focus({ preventScroll: true })

  if (input.type !== "text" && input.type !== "search") return

  const selectionIndex =
    intent?.type === "pointer"
      ? dataCellTextSelectionIndexFromPointer(input, intent.clientX)
      : input.value.length
  input.setSelectionRange(selectionIndex, selectionIndex)
}

export function DataCellInputControl({
  kind,
  value,
  editable: _editable,
  mode: _mode,
  disabled = false,
  name,
  placeholder,
  dateTimeZone = "local",
  showPickerIcon: _showPickerIcon,
  className,
  formatValue: _formatValue,
  draftValue,
  autoFocus,
  activationIntent,
  isPickerOpen: _isPickerOpen,
  onDraftValueChange,
  onCommit,
  onEditingEnd,
  onPickerOpenChange: _onPickerOpenChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onDoubleClick,
  ...props
}: DataCellInputControlProps) {
  const initialInputValue = formatDataCellEditValue(kind, value)
  const [uncontrolledDraftValue, setUncontrolledDraftValue] =
    React.useState(initialInputValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const inputValue = draftValue ?? uncontrolledDraftValue

  React.useEffect(() => {
    if (draftValue !== undefined) return
    setUncontrolledDraftValue(formatDataCellEditValue(kind, value))
  }, [draftValue, kind, value])

  React.useLayoutEffect(() => {
    if (!autoFocus && !activationIntent) return
    focusDataCellTextInput(inputRef.current, activationIntent)
  }, [activationIntent, autoFocus])

  const inputType = inputTypeForDataCell(kind)
  const {
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rootProps
  } = props

  return (
    <Input
      ref={inputRef}
      {...rootProps}
      type={inputType}
      className={cn(
        dataCellDisplayClass,
        disabled && "pointer-events-none opacity-64",
        className
      )}
      id={id}
      name={name}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      data-kind={kind}
      data-mode="edit"
      value={inputValue}
      disabled={disabled}
      autoFocus={autoFocus}
      unstyled
      nativeInput
      inputMode={
        kind === "integer"
          ? "numeric"
          : kind === "number"
            ? "decimal"
            : undefined
      }
      step={kind === "integer" ? 1 : kind === "number" ? "any" : undefined}
      placeholder={placeholder}
      onChange={(event) => {
        const nextValue = event.currentTarget.value
        if (draftValue === undefined) setUncontrolledDraftValue(nextValue)
        onDraftValueChange?.(
          nextValue,
          getDataCellValueMeta({
            kind,
            value: nextValue,
            isBadInput: event.currentTarget.validity.badInput,
          })
        )
      }}
      onFocus={onFocus}
      onBlur={(event) => {
        const rawValue = event.currentTarget.value
        ;(onCommit as DataCellCommitHandler | undefined)?.(
          parseDataCellInputValue({
            kind,
            value: rawValue,
            dateTimeZone,
            previousValue: value,
          }),
          getDataCellValueMeta({
            kind,
            value: rawValue,
            isBadInput: event.currentTarget.validity.badInput,
          })
        )
        onEditingEnd?.()
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.currentTarget.blur()
          event.preventDefault()
        }
        onKeyDown?.(event)
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    />
  )
}

function inputTypeForDataCell(
  kind: DataCellKind
): React.HTMLInputTypeAttribute {
  if (kind === "number" || kind === "integer") return "number"
  return "text"
}
