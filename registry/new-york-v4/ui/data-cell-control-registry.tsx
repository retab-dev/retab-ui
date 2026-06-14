"use client"

import * as React from "react"

import { DataCellBooleanControl } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import {
  dataCellBooleanControlProps,
  dataCellNumberControlProps,
  dataCellPickerControlProps,
  dataCellSelectControlProps,
  dataCellTextControlProps,
} from "@/registry/new-york-v4/ui/data-cell-control-props"
import type {
  DataCellEditModel,
  DataCellEditModelByKind,
} from "@/registry/new-york-v4/ui/data-cell-edit-model"
import { DataCellNumberControl } from "@/registry/new-york-v4/ui/data-cell-number-control"
import { DataCellPickerControl } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import { DataCellSelectControl } from "@/registry/new-york-v4/ui/data-cell-select-control"
import {
  useDataCellPrimitiveSession,
  type DataCellPrimitiveSession,
} from "@/registry/new-york-v4/ui/data-cell-session"
import { DataCellTextControl } from "@/registry/new-york-v4/ui/data-cell-text-control"
import type {
  DataCellCommitValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

export function DataCellControl({ model }: { model: DataCellEditModel }) {
  const session = useDataCellEditModelSession(model)

  if (model.kind === "text") {
    return (
      <DataCellTextControl
        {...dataCellTextControlProps(model)}
        session={session}
      />
    )
  }
  if (model.kind === "number" || model.kind === "integer") {
    return (
      <DataCellNumberControl
        {...dataCellNumberControlProps(model)}
        session={session}
      />
    )
  }
  if (model.kind === "boolean") {
    return (
      <DataCellBooleanControl
        {...dataCellBooleanControlProps(model)}
        session={session}
      />
    )
  }
  if (model.kind === "select") {
    return (
      <DataCellSelectControl
        {...dataCellSelectControlProps(model)}
        session={session}
      />
    )
  }

  return renderDataCellPickerControl(model, session)
}

function useDataCellEditModelSession(model: DataCellEditModel) {
  const onCommit = React.useCallback(
    (value: DataCellCommitValue, meta: DataCellValueMeta) => {
      model.onCommit?.(value, meta)
    },
    [model.onCommit]
  )

  return useDataCellPrimitiveSession({
    onCommit,
    onEditingEnd: model.onEditingEnd,
  })
}

function renderDataCellPickerControl(
  model: DataCellEditModelByKind["date" | "time" | "date-time"],
  session: DataCellPrimitiveSession
) {
  return (
    <DataCellPickerControl
      {...dataCellPickerControlProps(model)}
      session={session}
    />
  )
}
