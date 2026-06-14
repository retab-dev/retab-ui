import type {
  DataCellControlStaticPropsByKind,
} from "@/registry/new-york-v4/ui/data-cell-control-contract"
import type { DataCellEditModelByKind } from "@/registry/new-york-v4/ui/data-cell-edit-model"

export function dataCellTextControlProps(
  model: DataCellEditModelByKind["text"]
): DataCellControlStaticPropsByKind["text"] {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    placeholder: model.placeholder,
    className: model.className,
    autoFocus: model.autoFocus,
    activationSource: model.activationSource,
    draft: model.draft,
  }
}

export function dataCellNumberControlProps(
  model: DataCellEditModelByKind["number" | "integer"]
): DataCellControlStaticPropsByKind["number" | "integer"] {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    placeholder: model.placeholder,
    className: model.className,
    autoFocus: model.autoFocus,
    activationSource: model.activationSource,
    draft: model.draft,
  }
}

export function dataCellBooleanControlProps(
  model: DataCellEditModelByKind["boolean"]
): DataCellControlStaticPropsByKind["boolean"] {
  return {
    ...model.editorProps,
    kind: model.kind,
    value: model.value,
    disabled: model.disabled,
    name: model.name,
    className: model.className,
    autoFocus: model.autoFocus,
  }
}

export function dataCellSelectControlProps(
  model: DataCellEditModelByKind["select"]
): DataCellControlStaticPropsByKind["select"] {
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
    options: model.options,
    openState: model.openState,
  }
}

export function dataCellPickerControlProps(
  model: DataCellEditModelByKind["date" | "time" | "date-time"]
): DataCellControlStaticPropsByKind["date" | "time" | "date-time"] {
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
    autoFocus: model.autoFocus,
    activationSource: model.activationSource,
    draft: model.draft,
    openState: model.openState,
  }
}
