import type * as React from "react"

import type {
  DataCellActivationSource,
  DataCellDateTimeZone,
  DataCellEditorHandle,
  DataCellKind,
  DataCellProps,
  DataCellPropsForKind,
  DataCellSelectOption,
  DataCellValueForKind,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellPickerKind = "date" | "time" | "date-time"
type DataCellDraftKind = "text" | "number" | "integer" | DataCellPickerKind
type DataCellFormatKind = Exclude<DataCellKind, "boolean">

type DataCellEditShellState = {
  disabled: boolean
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

type DataCellResolvedShellState = Required<
  Pick<DataCellEditShellState, "disabled">
> &
  Omit<DataCellEditShellState, "disabled">

type DataCellDataAttributeValue = string | number | boolean | undefined
type DataCellDataAttributes = {
  [Attribute in `data-${string}`]?: DataCellDataAttributeValue
}
type DataCellAriaAttributeName = Extract<
  keyof React.AriaAttributes,
  `aria-${string}`
>
type DataCellDataAttributeName = keyof DataCellDataAttributes & `data-${string}`

type DataCellEditorEventProps = Pick<
  React.HTMLAttributes<HTMLElement>,
  "onBlur" | "onClick" | "onDoubleClick" | "onFocus" | "onKeyDown" | "onMouseUp"
>

export type DataCellEditorProps = React.AriaAttributes &
  DataCellDataAttributes &
  Pick<
    React.HTMLAttributes<HTMLElement>,
    "id" | "role" | "tabIndex" | "title"
  > &
  DataCellEditorEventProps

type DataCellTextCommitHandler = NonNullable<
  DataCellPropsForKind<"text">["onCommit"]
>
type DataCellBooleanCommitHandler = NonNullable<
  DataCellPropsForKind<"boolean">["onCommit"]
>
type DataCellSelectCommitHandler = NonNullable<
  DataCellPropsForKind<"select">["onCommit"]
>

type DataCellDraftHandler<Kind extends DataCellDraftKind> = NonNullable<
  DataCellPropsForKind<Kind>["onDraftValueChange"]
>

type DataCellFormatValue<Kind extends DataCellFormatKind> = NonNullable<
  DataCellPropsForKind<Kind>["formatValue"]
>

type DataCellPickerFormatValue = (
  value: string | null | undefined,
  meta: { kind: DataCellPickerKind }
) => React.ReactNode

export type DataCellEditModelByKind = {
  text: DataCellTextEditModel
  number: DataCellNumberEditModel
  integer: DataCellIntegerEditModel
  boolean: DataCellBooleanEditModel
  select: DataCellSelectEditModel
  date: DataCellDateEditModel
  time: DataCellTimeEditModel
  "date-time": DataCellDateTimeEditModel
}

export type DataCellEditModel =
  DataCellEditModelByKind[keyof DataCellEditModelByKind]

type DataCellEditModelBase<Kind extends DataCellKind> = {
  kind: Kind
  value?: DataCellValueForKind<Kind>
  disabled: boolean
  name?: string
  className?: string
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
  editorProps: DataCellEditorProps
}

export type DataCellTextEditModel = DataCellEditModelBase<"text"> & {
  placeholder?: string
  draftValue?: string
  onDraftValueChange?: DataCellDraftHandler<"text">
  onCommit?: DataCellTextCommitHandler
}

type DataCellNumericEditModel<Kind extends "number" | "integer"> =
  DataCellEditModelBase<Kind> & {
    placeholder?: string
    draftValue?: string
    onDraftValueChange?: DataCellDraftHandler<Kind>
    onCommit?: NonNullable<DataCellPropsForKind<Kind>["onCommit"]>
  }

export type DataCellNumberEditModel = DataCellNumericEditModel<"number">

export type DataCellIntegerEditModel = DataCellNumericEditModel<"integer">

export type DataCellBooleanEditModel = DataCellEditModelBase<"boolean"> & {
  onCommit?: DataCellBooleanCommitHandler
}

export type DataCellSelectEditModel = DataCellEditModelBase<"select"> & {
  placeholder?: string
  formatValue?: DataCellFormatValue<"select">
  open?: boolean
  options: DataCellSelectOption[]
  onOpenChange?: (open: boolean) => void
  onCommit?: DataCellSelectCommitHandler
}

type DataCellPickerEditModelForKind<Kind extends DataCellPickerKind> =
  DataCellEditModelBase<Kind> & {
    placeholder?: string
    dateTimeZone?: DataCellDateTimeZone
    showPickerIcon?: boolean
    formatValue?: DataCellPickerFormatValue
    draftValue?: string
    open?: boolean
    onDraftValueChange?: DataCellDraftHandler<Kind>
    onOpenChange?: (open: boolean) => void
    onCommit?: NonNullable<DataCellPropsForKind<Kind>["onCommit"]>
  }

export type DataCellDateEditModel = DataCellPickerEditModelForKind<"date">

export type DataCellTimeEditModel = DataCellPickerEditModelForKind<"time">

export type DataCellDateTimeEditModel =
  DataCellPickerEditModelForKind<"date-time">

export type DataCellPickerEditModel =
  | DataCellDateEditModel
  | DataCellTimeEditModel
  | DataCellDateTimeEditModel

export function createDataCellEditModel(
  props: DataCellProps,
  shellState: DataCellEditShellState
): DataCellEditModel {
  if (props.kind === "text")
    return createDataCellTextEditModel(props, shellState)
  if (props.kind === "number") {
    return createDataCellNumberEditModel(props, shellState)
  }
  if (props.kind === "integer") {
    return createDataCellIntegerEditModel(props, shellState)
  }
  if (props.kind === "boolean") {
    return createDataCellBooleanEditModel(props, shellState)
  }
  if (props.kind === "select") {
    return createDataCellSelectEditModel(props, shellState)
  }
  if (props.kind === "date") {
    return createDataCellDateEditModel(props, shellState)
  }
  if (props.kind === "time") {
    return createDataCellTimeEditModel(props, shellState)
  }
  if (props.kind === "date-time") {
    return createDataCellDateTimeEditModel(props, shellState)
  }
  return unsupportedDataCellProps(props)
}

function unsupportedDataCellProps(_props: never): never {
  throw new Error("Unsupported DataCell kind")
}

function dataCellEditShellState(
  props: DataCellProps,
  shellState: DataCellEditShellState
): DataCellResolvedShellState {
  return {
    disabled: shellState.disabled,
    autoFocus: shellState.autoFocus ?? props.autoFocus,
    activationSource: shellState.activationSource ?? props.activationSource,
    onEditingEnd: shellState.onEditingEnd ?? props.onEditingEnd,
    onEditorHandleChange:
      shellState.onEditorHandleChange ?? props.onEditorHandleChange,
  }
}

function dataCellEditorProps(props: DataCellProps): DataCellEditorProps {
  const editorProps: DataCellEditorProps = {
    id: props.id,
    role: props.role,
    tabIndex: props.tabIndex,
    title: props.title,
    onBlur: props.onBlur,
    onClick: props.onClick,
    onDoubleClick: props.onDoubleClick,
    onFocus: props.onFocus,
    onKeyDown: props.onKeyDown,
    onMouseUp: props.onMouseUp,
  }

  for (const propName in props) {
    if (isDataCellAriaAttributeName(propName)) {
      assignDataCellAriaAttribute(editorProps, propName, props[propName])
    }

    if (isDataCellDataAttributeName(propName)) {
      const propValue = Reflect.get(props, propName)
      if (isDataCellDataAttributeValue(propValue)) {
        assignDataCellDataAttribute(editorProps, propName, propValue)
      }
    }
  }

  return editorProps
}

function assignDataCellAriaAttribute<Name extends DataCellAriaAttributeName>(
  editorProps: React.AriaAttributes,
  propName: Name,
  propValue: React.AriaAttributes[Name]
) {
  editorProps[propName] = propValue
}

function assignDataCellDataAttribute(
  editorProps: DataCellDataAttributes,
  propName: DataCellDataAttributeName,
  propValue: DataCellDataAttributeValue
) {
  editorProps[propName] = propValue
}

function isDataCellAriaAttributeName(
  propName: string
): propName is DataCellAriaAttributeName {
  return propName.startsWith("aria-")
}

function isDataCellDataAttributeName(
  propName: string
): propName is DataCellDataAttributeName {
  return propName.startsWith("data-")
}

function isDataCellDataAttributeValue(
  value: unknown
): value is DataCellDataAttributeValue {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
}

function createDataCellTextEditModel(
  props: DataCellPropsForKind<"text">,
  shellState: DataCellEditShellState
): DataCellTextEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    placeholder: props.placeholder,
    className: props.className,
    draftValue: props.draftValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellNumberEditModel(
  props: DataCellPropsForKind<"number">,
  shellState: DataCellEditShellState
): DataCellNumberEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    placeholder: props.placeholder,
    className: props.className,
    draftValue: props.draftValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellIntegerEditModel(
  props: DataCellPropsForKind<"integer">,
  shellState: DataCellEditShellState
): DataCellIntegerEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    placeholder: props.placeholder,
    className: props.className,
    draftValue: props.draftValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellBooleanEditModel(
  props: DataCellPropsForKind<"boolean">,
  shellState: DataCellEditShellState
): DataCellBooleanEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    className: props.className,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    onCommit: props.onCommit,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellSelectEditModel(
  props: DataCellPropsForKind<"select">,
  shellState: DataCellEditShellState
): DataCellSelectEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    placeholder: props.placeholder,
    className: props.className,
    formatValue: props.formatValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    open: props.open,
    options: props.selectOptions,
    onOpenChange: props.onOpenChange,
    onCommit: props.onCommit,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellDateEditModel(
  props: DataCellPropsForKind<"date">,
  shellState: DataCellEditShellState
): DataCellDateEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    placeholder: props.placeholder,
    dateTimeZone: props.dateTimeZone,
    showPickerIcon: props.showPickerIcon,
    className: props.className,
    formatValue: props.formatValue
      ? (value) => props.formatValue?.(value, { kind: "date" })
      : undefined,
    draftValue: props.draftValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    open: props.open,
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onOpenChange: props.onOpenChange,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellTimeEditModel(
  props: DataCellPropsForKind<"time">,
  shellState: DataCellEditShellState
): DataCellTimeEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    placeholder: props.placeholder,
    dateTimeZone: props.dateTimeZone,
    showPickerIcon: props.showPickerIcon,
    className: props.className,
    formatValue: props.formatValue
      ? (value) => props.formatValue?.(value, { kind: "time" })
      : undefined,
    draftValue: props.draftValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    open: props.open,
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onOpenChange: props.onOpenChange,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellDateTimeEditModel(
  props: DataCellPropsForKind<"date-time">,
  shellState: DataCellEditShellState
): DataCellDateTimeEditModel {
  const editState = dataCellEditShellState(props, shellState)
  return {
    kind: props.kind,
    value: props.value,
    disabled: editState.disabled,
    name: props.name,
    placeholder: props.placeholder,
    dateTimeZone: props.dateTimeZone,
    showPickerIcon: props.showPickerIcon,
    className: props.className,
    formatValue: props.formatValue
      ? (value) => props.formatValue?.(value, { kind: "date-time" })
      : undefined,
    draftValue: props.draftValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    open: props.open,
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onOpenChange: props.onOpenChange,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}
