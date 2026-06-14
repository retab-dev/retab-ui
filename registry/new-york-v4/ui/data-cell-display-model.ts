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
  switch (props.kind) {
    case "text": {
      const {
        kind,
        value,
        placeholder,
        className,
        formatValue,
        editable,
        active,
        disabled,
        name,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        placeholder,
        className,
        formatValue,
      }
    }
    case "number": {
      const {
        kind,
        value,
        placeholder,
        className,
        formatValue,
        editable,
        active,
        disabled,
        name,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        placeholder,
        className,
        formatValue,
      }
    }
    case "integer": {
      const {
        kind,
        value,
        placeholder,
        className,
        formatValue,
        editable,
        active,
        disabled,
        name,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        placeholder,
        className,
        formatValue,
      }
    }
    case "boolean": {
      const {
        kind,
        value,
        className,
        editable,
        active,
        disabled,
        name,
        autoFocus,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        className,
      }
    }
    case "select": {
      const {
        kind,
        value,
        placeholder,
        className,
        formatValue,
        editable,
        active,
        disabled,
        name,
        selectOptions,
        open,
        autoFocus,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onOpenChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        placeholder,
        className,
        formatValue,
      }
    }
    case "date": {
      const {
        kind,
        value,
        placeholder,
        className,
        showPickerIcon,
        formatValue,
        editable,
        active,
        disabled,
        name,
        dateTimeZone,
        open,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onOpenChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        placeholder,
        className,
        formatValue,
        showPickerIcon: showPickerIcon ?? true,
      }
    }
    case "time": {
      const {
        kind,
        value,
        placeholder,
        className,
        showPickerIcon,
        formatValue,
        editable,
        active,
        disabled,
        name,
        dateTimeZone,
        open,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onOpenChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        placeholder,
        className,
        formatValue,
        showPickerIcon: showPickerIcon ?? true,
      }
    }
    case "date-time": {
      const {
        kind,
        value,
        placeholder,
        className,
        showPickerIcon,
        formatValue,
        editable,
        active,
        disabled,
        name,
        dateTimeZone,
        open,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onOpenChange,
        onClick,
        onKeyDown,
        onPointerDown,
        ...surfaceDomProps
      } = props
      return {
        ...surfaceDomProps,
        ...shellProps,
        kind,
        value,
        placeholder,
        className,
        formatValue,
        showPickerIcon: showPickerIcon ?? true,
      }
    }
  }
}
