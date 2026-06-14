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
        mode,
        editable,
        active,
        disabled,
        name,
        activationRequest,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onEditorHandleChange,
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
        mode,
        editable,
        active,
        disabled,
        name,
        activationRequest,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onEditorHandleChange,
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
        mode,
        editable,
        active,
        disabled,
        name,
        activationRequest,
        draftValue,
        autoFocus,
        onDraftValueChange,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onEditorHandleChange,
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
        mode,
        editable,
        active,
        disabled,
        name,
        activationRequest,
        autoFocus,
        onCommit,
        onEditingEnd,
        onActiveChange,
        onEditorHandleChange,
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
        mode,
        editable,
        active,
        disabled,
        name,
        selectOptions,
        activationRequest,
        open,
        autoFocus,
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
        mode,
        editable,
        active,
        disabled,
        name,
        dateTimeZone,
        activationRequest,
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
        mode,
        editable,
        active,
        disabled,
        name,
        dateTimeZone,
        activationRequest,
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
        mode,
        editable,
        active,
        disabled,
        name,
        dateTimeZone,
        activationRequest,
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
