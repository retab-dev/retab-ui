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
import { getDataCellTextSelectionOffset } from "@/registry/new-york-v4/ui/data-cell-text-hit-test"
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

function focusDataCellTextInput(
  input: HTMLInputElement | null,
  intent: DataCellActivationIntent | undefined
) {
  if (!input) return null
  input.focus({ preventScroll: true })

  if (input.type !== "text" && input.type !== "search") return

  const selectionIndex =
    intent?.type === "pointer"
      ? (intent.selectionOffset ??
        getDataCellTextSelectionOffset({
          clientX: intent.clientX,
          input,
          value: input.value,
        }))
      : input.value.length
  input.setSelectionRange(selectionIndex, selectionIndex)
}

function initialInputValueForActivation({
  activationIntent,
  kind,
  value,
}: {
  activationIntent: DataCellActivationIntent | undefined
  kind: DataCellKind
  value: DataCellProps["value"]
}) {
  if (
    activationIntent?.type !== "keyboard" ||
    activationIntent.key.length !== 1
  ) {
    return formatDataCellEditValue(kind, value)
  }
  if (kind === "text") return activationIntent.key
  if (
    (kind === "number" || kind === "integer") &&
    /^[0-9.+-]$/.test(activationIntent.key)
  ) {
    return activationIntent.key
  }
  return formatDataCellEditValue(kind, value)
}

export function DataCellInputControl({
  kind,
  value,
  editable: _editable,
  active: _active,
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
  onActiveChange: _onActiveChange,
  onPickerOpenChange: _onPickerOpenChange,
  onEditorHandleChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onMouseUp,
  onDoubleClick,
  ...props
}: DataCellInputControlProps) {
  const initialInputValue = initialInputValueForActivation({
    activationIntent,
    kind,
    value,
  })
  const [uncontrolledDraftValue, setUncontrolledDraftValue] =
    React.useState(initialInputValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const initialInputValueRef = React.useRef(initialInputValue)
  const lastInputValueRef = React.useRef(initialInputValue)
  const didFinishEditingRef = React.useRef(false)
  const inputValue = draftValue ?? uncontrolledDraftValue

  React.useEffect(() => {
    if (draftValue !== undefined) return
    setUncontrolledDraftValue(
      initialInputValueForActivation({
        activationIntent,
        kind,
        value,
      })
    )
  }, [activationIntent, draftValue, kind, value])

  React.useEffect(() => {
    lastInputValueRef.current = inputValue
  }, [inputValue])

  React.useLayoutEffect(() => {
    if (!autoFocus && !activationIntent) return
    focusDataCellTextInput(inputRef.current, activationIntent)
  }, [activationIntent, autoFocus])

  const commitCurrentInputValue = React.useCallback(
    (
      input: HTMLInputElement | null,
      {
        endEditing = true,
        markFinished = true,
        onlyIfChanged = false,
      }: {
        endEditing?: boolean
        markFinished?: boolean
        onlyIfChanged?: boolean
      } = {}
    ) => {
      if (didFinishEditingRef.current) return
      const rawValue = input?.value ?? lastInputValueRef.current
      if (onlyIfChanged && rawValue === initialInputValueRef.current) return
      if (markFinished) didFinishEditingRef.current = true
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
          isBadInput: input?.validity.badInput ?? false,
        })
      )
      if (endEditing) onEditingEnd?.()
    },
    [dateTimeZone, kind, onCommit, onEditingEnd, value]
  )

  const cancelCurrentInputValue = React.useCallback(() => {
    if (didFinishEditingRef.current) return
    didFinishEditingRef.current = true
    onEditingEnd?.()
  }, [onEditingEnd])

  React.useLayoutEffect(() => {
    onEditorHandleChange?.({
      finish: () => commitCurrentInputValue(inputRef.current),
      cancel: cancelCurrentInputValue,
    })
    return () => onEditorHandleChange?.(null)
  }, [cancelCurrentInputValue, commitCurrentInputValue, onEditorHandleChange])

  React.useEffect(
    () => () => {
      commitCurrentInputValue(inputRef.current, {
        endEditing: false,
        markFinished: false,
        onlyIfChanged: true,
      })
    },
    [commitCurrentInputValue]
  )

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
        lastInputValueRef.current = nextValue
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
        commitCurrentInputValue(event.currentTarget)
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented) return
        if (event.key === "Enter") {
          commitCurrentInputValue(event.currentTarget)
          event.currentTarget.blur()
          event.preventDefault()
          return
        }
        if (event.key === "Escape") {
          cancelCurrentInputValue()
          event.currentTarget.blur()
          event.preventDefault()
          return
        }
      }}
      onMouseUp={(event) => {
        onMouseUp?.(event)
      }}
      onClick={(event) => {
        onClick?.(event)
      }}
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
