import type * as React from "react"

import type {
  DataCellActivationSource,
  DataCellDateTimeZone,
  DataCellEditorHandle,
  DataCellKind,
  DataCellProps,
  DataCellSelectOption,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellPropsForKind<Kind extends DataCellKind> =
  DataCellProps extends infer Props
    ? Props extends { kind: infer PropsKind }
      ? Kind extends PropsKind
        ? Omit<Props, "kind"> & { kind: Kind }
        : never
      : never
    : never

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
type DataCellNumberCommitHandler = NonNullable<
  DataCellPropsForKind<"number">["onCommit"]
>
type DataCellBooleanCommitHandler = NonNullable<
  DataCellPropsForKind<"boolean">["onCommit"]
>
type DataCellSelectCommitHandler = NonNullable<
  DataCellPropsForKind<"select">["onCommit"]
>
type DataCellPickerCommitHandler = NonNullable<
  DataCellPropsForKind<"date">["onCommit"]
>

type DataCellDraftHandler<Kind extends DataCellKind> = NonNullable<
  DataCellPropsForKind<Kind>["onDraftValueChange"]
>

type DataCellFormatValue<Kind extends DataCellKind> = NonNullable<
  DataCellPropsForKind<Kind>["formatValue"]
>

type DataCellPickerFormatValue = (
  value: string | null | undefined,
  meta: { kind: "date" | "time" | "date-time" }
) => React.ReactNode

export type DataCellControlState =
  | {
      kind: "text"
      value?: string | null
      disabled: boolean
    }
  | {
      kind: "number"
      value?: number | string | null
      disabled: boolean
    }
  | {
      kind: "integer"
      value?: number | string | null
      disabled: boolean
    }
  | {
      kind: "boolean"
      value?: boolean | null
      disabled: boolean
      onCommit?: DataCellBooleanCommitHandler
    }
  | {
      kind: "select"
      value?: string | null
      disabled: boolean
    }
  | {
      kind: "date"
      value?: string | null
      disabled: boolean
    }
  | {
      kind: "time"
      value?: string | null
      disabled: boolean
    }
  | {
      kind: "date-time"
      value?: string | null
      disabled: boolean
    }

export type DataCellEditModelByKind = {
  text: DataCellTextEditModel
  number: DataCellNumberEditModel
  integer: DataCellIntegerEditModel
  boolean: DataCellBooleanEditModel
  select: DataCellSelectEditModel
  date: DataCellPickerEditModel
  time: DataCellPickerEditModel
  "date-time": DataCellPickerEditModel
}

export type DataCellEditModel =
  DataCellEditModelByKind[keyof DataCellEditModelByKind]

type DataCellEditModelBase<Kind extends DataCellKind, Value> = {
  kind: Kind
  value?: Value
  disabled: boolean
  name?: string
  className?: string
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  controlState: Extract<DataCellControlState, { kind: Kind }>
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
  editorProps: DataCellEditorProps
}

export type DataCellTextEditModel = DataCellEditModelBase<
  "text",
  string | null
> & {
  placeholder?: string
  draftValue?: string
  onDraftValueChange?: DataCellDraftHandler<"text">
  onCommit?: DataCellTextCommitHandler
}

export type DataCellNumberEditModel = DataCellEditModelBase<
  "number" | "integer",
  number | string | null
> & {
  placeholder?: string
  draftValue?: string
  onDraftValueChange?: DataCellDraftHandler<"number">
  onCommit?: DataCellNumberCommitHandler
}

export type DataCellIntegerEditModel = DataCellNumberEditModel

export type DataCellBooleanEditModel = DataCellEditModelBase<
  "boolean",
  boolean | null
> & {
  onCommit?: DataCellBooleanCommitHandler
}

export type DataCellSelectEditModel = DataCellEditModelBase<
  "select",
  string | null
> & {
  placeholder?: string
  formatValue?: DataCellFormatValue<"select">
  open?: boolean
  options: DataCellSelectOption[]
  onOpenChange?: (open: boolean) => void
  onCommit?: DataCellSelectCommitHandler
}

export type DataCellPickerEditModel = DataCellEditModelBase<
  "date" | "time" | "date-time",
  string | null
> & {
  placeholder?: string
  dateTimeZone?: DataCellDateTimeZone
  showPickerIcon?: boolean
  formatValue?: DataCellPickerFormatValue
  draftValue?: string
  open?: boolean
  onDraftValueChange?: DataCellDraftHandler<"date">
  onOpenChange?: (open: boolean) => void
  onCommit?: DataCellPickerCommitHandler
}

export function createDataCellEditModel(
  props: DataCellProps,
  shellState: DataCellEditShellState
): DataCellEditModel {
  if (props.kind === "text")
    return createDataCellTextEditModel(props, shellState)
  if (props.kind === "number") {
    return createDataCellNumericEditModel(
      { ...props, kind: "number" },
      shellState
    )
  }
  if (props.kind === "integer") {
    return createDataCellNumericEditModel(
      { ...props, kind: "integer" },
      shellState
    )
  }
  if (props.kind === "boolean") {
    return createDataCellBooleanEditModel(props, shellState)
  }
  if (props.kind === "select") {
    return createDataCellSelectEditModel(props, shellState)
  }
  if (props.kind === "date") {
    return createDataCellPickerEditModel({ ...props, kind: "date" }, shellState)
  }
  if (props.kind === "time") {
    return createDataCellPickerEditModel({ ...props, kind: "time" }, shellState)
  }
  if (props.kind === "date-time") {
    return createDataCellPickerEditModel(
      { ...props, kind: "date-time" },
      shellState
    )
  }
  throw new Error(`Unsupported DataCell kind: ${String(props.kind)}`)
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
    controlState: {
      kind: props.kind,
      value: props.value,
      disabled: editState.disabled,
    },
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellNumericEditModel(
  props: DataCellPropsForKind<"number" | "integer">,
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
    controlState: {
      kind: props.kind,
      value: props.value,
      disabled: editState.disabled,
    },
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
    controlState: {
      kind: props.kind,
      value: props.value,
      disabled: editState.disabled,
      onCommit: props.onCommit,
    },
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
    controlState: {
      kind: props.kind,
      value: props.value,
      disabled: editState.disabled,
    },
    open: props.open,
    options: props.selectOptions,
    onOpenChange: props.onOpenChange,
    onCommit: props.onCommit,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}

function createDataCellPickerEditModel(
  props: DataCellPropsForKind<"date" | "time" | "date-time">,
  shellState: DataCellEditShellState
): DataCellPickerEditModel {
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
    formatValue: props.formatValue,
    draftValue: props.draftValue,
    autoFocus: editState.autoFocus,
    activationSource: editState.activationSource,
    controlState: {
      kind: props.kind,
      value: props.value,
      disabled: editState.disabled,
    },
    open: props.open,
    onDraftValueChange: props.onDraftValueChange,
    onCommit: props.onCommit,
    onOpenChange: props.onOpenChange,
    onEditingEnd: editState.onEditingEnd,
    onEditorHandleChange: editState.onEditorHandleChange,
    editorProps: dataCellEditorProps(props),
  }
}
