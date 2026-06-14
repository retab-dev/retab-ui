"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { createDataCellPointerActivationSource } from "@/registry/new-york-v4/ui/data-cell-activation"
import { dataCellDisplayClass } from "@/registry/new-york-v4/ui/data-cell-classes"
import {
  formatDataCellEditValue,
  getDataCellValueMeta,
  parseDataCellInputValue,
} from "@/registry/new-york-v4/ui/data-cell-format"
import {
  getDataCellDisplayTextSelectionOffset,
  getDataCellTextSelectionOffset,
} from "@/registry/new-york-v4/ui/data-cell-text-hit-test"
import type {
  DataCellActivationSource,
  DataCellEditorHandle,
  DataCellKind,
  DataCellValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellInputNativeProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | "children"
  | "className"
  | "defaultValue"
  | "disabled"
  | "name"
  | "onChange"
  | "placeholder"
  | "type"
  | "value"
>

type DataCellInputControlBaseProps<
  Kind extends DataCellKind,
  Value,
> = DataCellInputNativeProps & {
  kind: Kind
  value?: Value
  disabled?: boolean
  name?: string
  placeholder?: string
  className?: string
  draftValue?: string
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

export type DataCellTextControlProps = DataCellInputControlBaseProps<
  "text",
  string | null
> & {
  onCommit?: (value: string | null, meta: DataCellValueMeta) => void
}

export type DataCellNumberControlProps = DataCellInputControlBaseProps<
  "number" | "integer",
  number | string | null
> & {
  onCommit?: (value: number | null, meta: DataCellValueMeta) => void
}

export type DataCellInputControlProps =
  | DataCellTextControlProps
  | DataCellNumberControlProps

export function getDataCellTextPointerActivationSource({
  clientX,
  clientY,
  detail,
  displayElement,
  event,
  value,
}: {
  clientX: number
  clientY: number
  detail: number
  displayElement: HTMLElement | null
  event?: Event
  value: DataCellTextControlProps["value"]
}): Extract<DataCellActivationSource, { kind: "pointer" }> {
  const activationSource = createDataCellPointerActivationSource({
    clientX,
    clientY,
    detail,
    event,
  })
  const textElement = displayElement?.querySelector<HTMLElement>(
    '[data-slot="data-cell-value"]'
  )
  if (!textElement) return activationSource
  activationSource.selectionOffset = getDataCellDisplayTextSelectionOffset({
    clientX,
    clientY,
    textElement,
    value: value === null || value === undefined ? "" : String(value),
  })
  return activationSource
}

export function DataCellTextControl(props: DataCellTextControlProps) {
  return <DataCellInputControl {...props} />
}

function focusDataCellTextInput(
  input: HTMLInputElement | null,
  activationSource: DataCellActivationSource | undefined
) {
  if (!input) return null
  input.focus({ preventScroll: true })

  if (input.type !== "text" && input.type !== "search") return

  const selectionIndex =
    activationSource?.kind === "pointer"
      ? (activationSource.selectionOffset ??
        getDataCellTextSelectionOffset({
          clientX: activationSource.clientX,
          input,
          value: input.value,
        }))
      : input.value.length
  input.setSelectionRange(selectionIndex, selectionIndex)
}

function initialInputValueForActivation({
  activationSource,
  kind,
  value,
}: {
  activationSource: DataCellActivationSource | undefined
  kind: DataCellKind
  value: DataCellValue
}) {
  if (
    activationSource?.kind !== "keyboard" ||
    activationSource.key.length !== 1
  ) {
    return formatDataCellEditValue(kind, value)
  }
  if (kind === "text") return activationSource.key
  if (
    (kind === "number" || kind === "integer") &&
    /^[0-9.+-]$/.test(activationSource.key)
  ) {
    return activationSource.key
  }
  return formatDataCellEditValue(kind, value)
}

export function DataCellInputControl({
  kind,
  value,
  disabled = false,
  name,
  placeholder,
  className,
  draftValue,
  autoFocus,
  activationSource,
  onDraftValueChange,
  onCommit,
  onEditingEnd,
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
    activationSource,
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
        activationSource,
        kind,
        value,
      })
    )
  }, [activationSource, draftValue, kind, value])

  React.useEffect(() => {
    lastInputValueRef.current = inputValue
  }, [inputValue])

  React.useLayoutEffect(() => {
    if (!autoFocus && !activationSource) return
    focusDataCellTextInput(inputRef.current, activationSource)
  }, [activationSource, autoFocus])

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
      const commitValue = parseDataCellInputValue({
        kind,
        value: rawValue,
        dateTimeZone: "local",
        previousValue: value,
      }) as string | number | null
      ;(
        onCommit as
          | ((value: string | number | null, meta: DataCellValueMeta) => void)
          | undefined
      )?.(
        commitValue,
        getDataCellValueMeta({
          kind,
          value: rawValue,
          isBadInput: input?.validity.badInput ?? false,
        })
      )
      if (endEditing) onEditingEnd?.()
    },
    [kind, onCommit, onEditingEnd, value]
  )
  const commitCurrentInputValueRef = React.useRef(commitCurrentInputValue)

  React.useEffect(() => {
    commitCurrentInputValueRef.current = commitCurrentInputValue
  }, [commitCurrentInputValue])

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
      commitCurrentInputValueRef.current(inputRef.current, {
        endEditing: false,
        markFinished: false,
        onlyIfChanged: true,
      })
    },
    []
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
