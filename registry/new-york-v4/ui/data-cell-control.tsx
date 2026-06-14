"use client"

import * as React from "react"

import {
  dataCellBooleanControlProps,
  dataCellInputControlProps,
  dataCellPickerControlProps,
  dataCellSelectControlProps,
} from "@/registry/new-york-v4/ui/data-cell-control-props"
import { dataCellControlByKind } from "@/registry/new-york-v4/ui/data-cell-control-registry"
import type {
  DataCellEditModel,
  DataCellEditModelByKind,
} from "@/registry/new-york-v4/ui/data-cell-edit-model"
import {
  useDataCellPrimitiveSession,
  type DataCellPrimitiveSession,
} from "@/registry/new-york-v4/ui/data-cell-session"
import type {
  DataCellCommitValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

export function DataCellControl({ model }: { model: DataCellEditModel }) {
  const session = useDataCellEditModelSession(model)

  if (model.kind === "text") {
    const Control = dataCellControlByKind.text
    return <Control {...dataCellInputControlProps(model)} session={session} />
  }
  if (model.kind === "number") {
    const Control = dataCellControlByKind.number
    return <Control {...dataCellInputControlProps(model)} session={session} />
  }
  if (model.kind === "integer") {
    const Control = dataCellControlByKind.integer
    return <Control {...dataCellInputControlProps(model)} session={session} />
  }
  if (model.kind === "boolean") {
    const Control = dataCellControlByKind.boolean
    return <Control {...dataCellBooleanControlProps(model)} session={session} />
  }
  if (model.kind === "select") {
    const Control = dataCellControlByKind.select
    return <Control {...dataCellSelectControlProps(model)} session={session} />
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
  const Control = dataCellControlByKind[model.kind]
  return <Control {...dataCellPickerControlProps(model)} session={session} />
}
