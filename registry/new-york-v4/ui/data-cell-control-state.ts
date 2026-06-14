import type {
  DataCellKind,
  DataCellProps,
  DataCellPropsForKind,
  DataCellValueForKind,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellBooleanCommitHandler = NonNullable<
  DataCellPropsForKind<"boolean">["onCommit"]
>

type DataCellControlStateForKind<Kind extends DataCellKind> = {
  kind: Kind
  value?: DataCellValueForKind<Kind>
  disabled: boolean
} & (Kind extends "boolean" ? { onCommit?: DataCellBooleanCommitHandler } : {})

export type DataCellControlStateByKind = {
  [Kind in DataCellKind]: DataCellControlStateForKind<Kind>
}

export type DataCellControlState = DataCellControlStateByKind[DataCellKind]

export function createDataCellControlState(
  props: DataCellProps,
  { disabled }: { disabled: boolean }
): DataCellControlState {
  if (props.kind === "text") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
    }
  }
  if (props.kind === "number") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
    }
  }
  if (props.kind === "integer") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
    }
  }
  if (props.kind === "boolean") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
      onCommit: props.onCommit,
    }
  }
  if (props.kind === "select") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
    }
  }
  if (props.kind === "date") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
    }
  }
  if (props.kind === "time") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
    }
  }
  if (props.kind === "date-time") {
    return {
      kind: props.kind,
      value: props.value,
      disabled,
    }
  }
  return unsupportedDataCellControlState(props)
}

function unsupportedDataCellControlState(_props: never): never {
  throw new Error("Unsupported DataCell kind")
}
