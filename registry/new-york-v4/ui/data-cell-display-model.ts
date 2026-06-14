import type * as React from "react"

import type { DataCellDisplayProps } from "@/registry/new-york-v4/ui/data-cell-display"
import type { DataCellProps } from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellDisplayShellProps = Pick<
  DataCellDisplayProps,
  | "disabled"
  | "editable"
  | "onClick"
  | "onKeyDown"
  | "onPointerDown"
  | "tabIndex"
>

export function createDataCellDisplayProps(
  props: DataCellProps,
  shellProps: DataCellDisplayShellProps
): DataCellDisplayProps {
  const {
    kind,
    value,
    placeholder,
    className,
    showPickerIcon,
    formatValue,
    mode,
    editable,
    active,
    disabled,
    name,
    selectOptions,
    dateTimeZone,
    activationSource,
    open,
    draftValue,
    autoFocus,
    onDraftValueChange,
    onCommit,
    onEditingEnd,
    onActiveChange,
    onOpenChange,
    onEditorHandleChange,
    onClick,
    onKeyDown,
    onPointerDown,
    ...surfaceDomProps
  } = props
  const displayProps: Pick<
    DataCellDisplayProps,
    "className" | "placeholder" | "showPickerIcon"
  > &
    DataCellDisplayShellProps &
    React.HTMLAttributes<HTMLDivElement> = {
    ...surfaceDomProps,
    ...shellProps,
    placeholder,
    className,
    showPickerIcon,
  }

  switch (props.kind) {
    case "text":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "number":
    case "integer":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "boolean":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "select":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "date":
    case "time":
    case "date-time":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
        showPickerIcon: props.showPickerIcon ?? true,
      }
  }
}
