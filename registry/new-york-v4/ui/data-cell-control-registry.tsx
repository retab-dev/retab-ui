"use client"

import {
  createDataCellKeyboardActivationSource,
  createDataCellPointerActivationSource,
} from "@/registry/new-york-v4/ui/data-cell-activation"
import {
  commitDataCellBooleanToggle,
  DataCellBooleanControl,
  type DataCellBooleanControlProps,
} from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import {
  commandDataCellControlAction,
  editDataCellControlAction,
  noneDataCellControlAction,
  type DataCellControlAction,
  type DataCellControlAdapter,
  type DataCellControlKeyActionArgs,
  type DataCellControlPointerActionArgs,
} from "@/registry/new-york-v4/ui/data-cell-control-contract"
import type {
  DataCellEditModel,
  DataCellEditModelByKind,
} from "@/registry/new-york-v4/ui/data-cell-edit-model"
import {
  canActivateDataCellNumberFromKey,
  DataCellNumberControl,
} from "@/registry/new-york-v4/ui/data-cell-number-control"
import {
  DataCellPickerControl,
  type DataCellPickerControlProps,
} from "@/registry/new-york-v4/ui/data-cell-picker-control"
import {
  DataCellSelectControl,
  type DataCellSelectControlProps,
} from "@/registry/new-york-v4/ui/data-cell-select-control"
import {
  DataCellTextControl,
  getDataCellTextPointerActivationSource,
  type DataCellNumberControlProps,
  type DataCellTextControlProps,
} from "@/registry/new-york-v4/ui/data-cell-text-control"
import type { DataCellKind } from "@/registry/new-york-v4/ui/data-cell-types"

const keyboardOpenKeys = new Set(["Enter", "F2", " "])

const textControlAdapter: DataCellControlAdapter<"text"> = {
  Control: DataCellTextControl,
  controlProps: dataCellTextControlProps,
  activatePointer: (args) =>
    editDataCellControlAction(
      getDataCellTextPointerActivationSource({
        clientX: args.clientX,
        clientY: args.clientY,
        detail: args.detail,
        displayElement: args.displayElement,
        event: args.event,
        value: args.controlState.value,
      }),
      { shouldPreventDefault: true }
    ),
  activateClick: (args) =>
    editDataCellControlAction(
      getDataCellTextPointerActivationSource({
        clientX: args.clientX,
        clientY: args.clientY,
        detail: args.detail,
        displayElement: args.displayElement,
        event: args.event,
        value: args.controlState.value,
      }),
      { shouldPreventDefault: false }
    ),
  activateKey: createKeyboardEditAction,
  canActivateFromKey: (key) =>
    key === "Enter" || key === "F2" || key.length === 1,
}

function createInputControlAdapter<Kind extends "number" | "integer">(
  kind: Kind
): DataCellControlAdapter<Kind> {
  return {
    Control: DataCellNumberControl,
    controlProps: dataCellNumberControlProps,
    activatePointer: createDefaultPointerEditAction,
    activateClick: createDefaultClickEditAction,
    activateKey: createKeyboardEditAction,
    canActivateFromKey: (key) => canActivateDataCellNumberFromKey(kind, key),
  }
}

const booleanControlAdapter: DataCellControlAdapter<"boolean"> = {
  Control: DataCellBooleanControl,
  controlProps: dataCellBooleanControlProps,
  activatePointer: ({ controlState }) =>
    commandDataCellControlAction(
      () =>
        commitDataCellBooleanToggle(controlState.value, controlState.onCommit),
      { shouldPreventDefault: true }
    ),
  activateClick: ({ controlState }) =>
    commandDataCellControlAction(
      () =>
        commitDataCellBooleanToggle(controlState.value, controlState.onCommit),
      { shouldPreventDefault: false }
    ),
  activateKey: ({ key, controlState }) => {
    if (key !== " ") {
      return editDataCellControlAction(
        createDataCellKeyboardActivationSource(key),
        { shouldPreventDefault: true }
      )
    }
    return commandDataCellControlAction(
      () =>
        commitDataCellBooleanToggle(controlState.value, controlState.onCommit),
      { shouldPreventDefault: true }
    )
  },
  canActivateFromKey: (key) => key === "Enter" || key === "F2" || key === " ",
}

const selectControlAdapter: DataCellControlAdapter<"select"> = {
  Control: DataCellSelectControl,
  controlProps: dataCellSelectControlProps,
  activatePointer: noneDataCellControlAction,
  activateClick: createDefaultClickEditAction,
  activateKey: createKeyboardEditAction,
  canActivateFromKey: (key) => keyboardOpenKeys.has(key),
}

function createPickerControlAdapter<
  Kind extends "date" | "time" | "date-time",
>(): DataCellControlAdapter<Kind> {
  return {
    Control: DataCellPickerControl,
    controlProps: dataCellPickerControlProps,
    activatePointer: createDefaultPointerEditAction,
    activateClick: createDefaultClickEditAction,
    activateKey: createKeyboardEditAction,
    canActivateFromKey: (key) => keyboardOpenKeys.has(key),
  }
}

const numberControlAdapter = createInputControlAdapter("number")
const integerControlAdapter = createInputControlAdapter("integer")
const dateControlAdapter: DataCellControlAdapter<"date"> =
  createPickerControlAdapter()
const timeControlAdapter: DataCellControlAdapter<"time"> =
  createPickerControlAdapter()
const dateTimeControlAdapter: DataCellControlAdapter<"date-time"> =
  createPickerControlAdapter()

const dataCellControlAdapterByKind = {
  text: textControlAdapter,
  number: numberControlAdapter,
  integer: integerControlAdapter,
  boolean: booleanControlAdapter,
  select: selectControlAdapter,
  date: dateControlAdapter,
  time: timeControlAdapter,
  "date-time": dateTimeControlAdapter,
} satisfies {
  [Kind in DataCellKind]: DataCellControlAdapter<Kind>
}

export function DataCellControl({ model }: { model: DataCellEditModel }) {
  if (model.kind === "text") {
    return renderDataCellControl(textControlAdapter, model)
  }
  if (model.kind === "number") {
    return renderDataCellControl(numberControlAdapter, model)
  }
  if (model.kind === "integer") {
    return renderDataCellControl(integerControlAdapter, model)
  }
  if (model.kind === "boolean") {
    return renderDataCellControl(booleanControlAdapter, model)
  }
  if (model.kind === "select") {
    return renderDataCellControl(selectControlAdapter, model)
  }
  if (model.kind === "date") {
    return renderDataCellControl(dateControlAdapter, model)
  }
  if (model.kind === "time") {
    return renderDataCellControl(timeControlAdapter, model)
  }
  if (model.kind === "date-time") {
    return renderDataCellControl(dateTimeControlAdapter, model)
  }

  return null
}

function renderDataCellControl<Kind extends DataCellKind>(
  adapter: DataCellControlAdapter<Kind>,
  model: DataCellEditModelByKind[Kind]
) {
  const Control = adapter.Control
  return <Control {...adapter.controlProps(model)} />
}

export function getDataCellPointerControlAction(
  args: DataCellControlPointerActionArgs
): DataCellControlAction {
  return dataCellPointerActionForKind(args, "activatePointer")
}

export function getDataCellClickControlAction(
  args: DataCellControlPointerActionArgs
): DataCellControlAction {
  return dataCellPointerActionForKind(args, "activateClick")
}

export function getDataCellKeyControlAction(
  args: DataCellControlKeyActionArgs
): DataCellControlAction {
  return dataCellKeyActionForKind(args)
}

type DataCellPointerActionName = "activatePointer" | "activateClick"

function dataCellPointerActionForKind(
  args: DataCellControlPointerActionArgs,
  actionName: DataCellPointerActionName
): DataCellControlAction {
  const { controlState } = args
  if (controlState.kind === "text") {
    return textControlAdapter[actionName]({ ...args, controlState })
  }
  if (controlState.kind === "number") {
    return numberControlAdapter[actionName]({ ...args, controlState })
  }
  if (controlState.kind === "integer") {
    return integerControlAdapter[actionName]({ ...args, controlState })
  }
  if (controlState.kind === "boolean") {
    return booleanControlAdapter[actionName]({ ...args, controlState })
  }
  if (controlState.kind === "select") {
    return selectControlAdapter[actionName]({ ...args, controlState })
  }
  if (controlState.kind === "date") {
    return dateControlAdapter[actionName]({ ...args, controlState })
  }
  if (controlState.kind === "time") {
    return timeControlAdapter[actionName]({ ...args, controlState })
  }
  return dateTimeControlAdapter[actionName]({ ...args, controlState })
}

function dataCellKeyActionForKind(
  args: DataCellControlKeyActionArgs
): DataCellControlAction {
  const { controlState } = args
  if (controlState.kind === "text") {
    return dataCellKeyActionWithAdapter(textControlAdapter, {
      ...args,
      controlState,
    })
  }
  if (controlState.kind === "number") {
    return dataCellKeyActionWithAdapter(numberControlAdapter, {
      ...args,
      controlState,
    })
  }
  if (controlState.kind === "integer") {
    return dataCellKeyActionWithAdapter(integerControlAdapter, {
      ...args,
      controlState,
    })
  }
  if (controlState.kind === "boolean") {
    return dataCellKeyActionWithAdapter(booleanControlAdapter, {
      ...args,
      controlState,
    })
  }
  if (controlState.kind === "select") {
    return dataCellKeyActionWithAdapter(selectControlAdapter, {
      ...args,
      controlState,
    })
  }
  if (controlState.kind === "date") {
    return dataCellKeyActionWithAdapter(dateControlAdapter, {
      ...args,
      controlState,
    })
  }
  if (controlState.kind === "time") {
    return dataCellKeyActionWithAdapter(timeControlAdapter, {
      ...args,
      controlState,
    })
  }
  return dataCellKeyActionWithAdapter(dateTimeControlAdapter, {
    ...args,
    controlState,
  })
}

function dataCellKeyActionWithAdapter<Kind extends DataCellKind>(
  adapter: DataCellControlAdapter<Kind>,
  args: DataCellControlKeyActionArgs<Kind>
): DataCellControlAction {
  if (!adapter.canActivateFromKey(args.key)) {
    return noneDataCellControlAction()
  }
  return adapter.activateKey(args)
}

export function canActivateDataCellFromKey(
  kind: DataCellKind,
  key: string
): boolean {
  return dataCellControlAdapterByKind[kind].canActivateFromKey(key)
}

function dataCellTextControlProps(
  model: DataCellEditModelByKind["text"]
): DataCellTextControlProps {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    placeholder: model.placeholder,
    className: model.className,
    draftValue: model.draftValue,
    autoFocus: model.autoFocus,
    activationSource: model.activationSource,
    onDraftValueChange: model.onDraftValueChange,
    onCommit: model.onCommit,
    onEditingEnd: model.onEditingEnd,
    onEditorHandleChange: model.onEditorHandleChange,
  }
}

function dataCellNumberControlProps(
  model: DataCellEditModelByKind["number" | "integer"]
): DataCellNumberControlProps {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    placeholder: model.placeholder,
    className: model.className,
    draftValue: model.draftValue,
    autoFocus: model.autoFocus,
    activationSource: model.activationSource,
    onDraftValueChange: model.onDraftValueChange,
    onCommit: model.onCommit,
    onEditingEnd: model.onEditingEnd,
    onEditorHandleChange: model.onEditorHandleChange,
  }
}

function dataCellBooleanControlProps(
  model: DataCellEditModelByKind["boolean"]
): DataCellBooleanControlProps {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    className: model.className,
    autoFocus: model.autoFocus,
    onCommit: model.onCommit,
    onEditingEnd: model.onEditingEnd,
    onEditorHandleChange: model.onEditorHandleChange,
  }
}

function dataCellSelectControlProps(
  model: DataCellEditModelByKind["select"]
): DataCellSelectControlProps {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    placeholder: model.placeholder,
    className: model.className,
    formatValue: model.formatValue,
    autoFocus: model.autoFocus,
    activationSource: model.activationSource,
    open: model.open,
    options: model.options,
    onCommit: model.onCommit,
    onEditingEnd: model.onEditingEnd,
    onOpenChange: model.onOpenChange,
    onEditorHandleChange: model.onEditorHandleChange,
  }
}

function dataCellPickerControlProps(
  model: DataCellEditModelByKind["date" | "time" | "date-time"]
): DataCellPickerControlProps {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    placeholder: model.placeholder,
    dateTimeZone: model.dateTimeZone,
    showPickerIcon: model.showPickerIcon,
    className: model.className,
    formatValue: model.formatValue,
    draftValue: model.draftValue,
    autoFocus: model.autoFocus,
    activationSource: model.activationSource,
    open: model.open,
    onDraftValueChange: model.onDraftValueChange,
    onCommit: model.onCommit,
    onOpenChange: model.onOpenChange,
    onEditingEnd: model.onEditingEnd,
    onEditorHandleChange: model.onEditorHandleChange,
  }
}

function createDefaultPointerEditAction<Kind extends DataCellKind>({
  clientX,
  clientY,
  detail,
  event,
}: DataCellControlPointerActionArgs<Kind>): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellPointerActivationSource({ clientX, clientY, detail, event }),
    { shouldPreventDefault: true }
  )
}

function createDefaultClickEditAction<Kind extends DataCellKind>({
  clientX,
  clientY,
  detail,
  event,
}: DataCellControlPointerActionArgs<Kind>): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellPointerActivationSource({ clientX, clientY, detail, event }),
    { shouldPreventDefault: false }
  )
}

function createKeyboardEditAction<Kind extends DataCellKind>({
  key,
}: DataCellControlKeyActionArgs<Kind>): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellKeyboardActivationSource(key),
    { shouldPreventDefault: true }
  )
}
