import type * as React from "react"

import type { DataCellActivationSource } from "@/registry/new-york-v4/ui/data-cell-activation"
import type {
  DataCellCommitHandler,
  DataCellCommitValue,
  DataCellDateTimeZone,
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

type DataCellDraftHandler<Kind extends DataCellDraftKind> = NonNullable<
  DataCellPropsForKind<Kind>["onDraftValueChange"]
>

type DataCellTypedCommitHandler<Value extends DataCellCommitValue> = (
  value: Value,
  meta: DataCellValueMeta
) => void

type DataCellDraftEditState<Kind extends DataCellDraftKind> = {
  value?: string
  onChange?: DataCellDraftHandler<Kind>
}

type DataCellOpenEditState = {
  value?: boolean
  onChange?: (open: boolean) => void
}

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
  onCommit?: DataCellCommitHandler
  editorProps: DataCellEditorProps
}

export type DataCellTextEditModel = DataCellEditModelBase<"text"> & {
  placeholder?: string
  draft?: DataCellDraftEditState<"text">
}

type DataCellNumericEditModel<Kind extends "number" | "integer"> =
  DataCellEditModelBase<Kind> & {
    placeholder?: string
    draft?: DataCellDraftEditState<Kind>
  }

export type DataCellNumberEditModel = DataCellNumericEditModel<"number">

export type DataCellIntegerEditModel = DataCellNumericEditModel<"integer">

export type DataCellBooleanEditModel = DataCellEditModelBase<"boolean">

export type DataCellSelectEditModel = DataCellEditModelBase<"select"> & {
  placeholder?: string
  formatValue?: DataCellFormatValue<"select">
  openState?: DataCellOpenEditState
  options: DataCellSelectOption[]
}

type DataCellPickerEditModelForKind<Kind extends DataCellPickerKind> =
  DataCellEditModelBase<Kind> & {
    placeholder?: string
    dateTimeZone?: DataCellDateTimeZone
    showPickerIcon?: boolean
    formatValue?: DataCellPickerFormatValue
    draft?: DataCellDraftEditState<Kind>
    openState?: DataCellOpenEditState
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

function dataCellCommitHandler<Value extends DataCellCommitValue>(
  onCommit: DataCellTypedCommitHandler<Value> | undefined,
  isValue: (value: DataCellCommitValue) => value is Value
): DataCellCommitHandler | undefined {
  if (!onCommit) return undefined
  return (value, meta) => {
    if (!isValue(value)) {
      throw new Error(`Invalid ${meta.kind} commit value`)
    }
    onCommit(value, meta)
  }
}

function isDataCellStringCommitValue(
  value: DataCellCommitValue
): value is string | null {
  return typeof value === "string" || value === null
}

function isDataCellNumberCommitValue(
  value: DataCellCommitValue
): value is number | null {
  return typeof value === "number" || value === null
}

function isDataCellBooleanCommitValue(
  value: DataCellCommitValue
): value is boolean {
  return typeof value === "boolean"
}

function dataCellEditShellState(
  props: DataCellProps,
  shellState: DataCellEditShellState
): DataCellResolvedShellState {
  return {
    disabled: shellState.disabled,
    autoFocus: shellState.autoFocus ?? props.autoFocus,
    activationSource: shellState.activationSource,
    onEditingEnd: shellState.onEditingEnd ?? props.onEditingEnd,
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
    draft: {
      value: props.draftValue,
      onChange: props.onDraftValueChange,
    },
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellStringCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
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
    draft: {
      value: props.draftValue,
      onChange: props.onDraftValueChange,
    },
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellNumberCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
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
    draft: {
      value: props.draftValue,
      onChange: props.onDraftValueChange,
    },
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellNumberCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
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
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellBooleanCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
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
    openState: {
      value: props.open,
      onChange: props.onOpenChange,
    },
    options: props.selectOptions,
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellStringCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
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
    draft: {
      value: props.draftValue,
      onChange: props.onDraftValueChange,
    },
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    openState: {
      value: props.open,
      onChange: props.onOpenChange,
    },
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellStringCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
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
    draft: {
      value: props.draftValue,
      onChange: props.onDraftValueChange,
    },
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    openState: {
      value: props.open,
      onChange: props.onOpenChange,
    },
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellStringCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
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
    draft: {
      value: props.draftValue,
      onChange: props.onDraftValueChange,
    },
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    openState: {
      value: props.open,
      onChange: props.onOpenChange,
    },
    onCommit: dataCellCommitHandler(
      props.onCommit,
      isDataCellStringCommitValue
    ),
    onEditingEnd: editState.onEditingEnd,
    editorProps: dataCellEditorProps(props),
  }
}
