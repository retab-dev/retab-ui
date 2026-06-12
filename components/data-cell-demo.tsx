"use client"

import * as React from "react"

import {
  DataCell,
  type DataCellKind,
  type DataCellValue,
} from "@/components/ui/data-cell"

const rows: Array<{
  kind: DataCellKind
  label: string
  value: DataCellValue
}> = [
  { kind: "text", label: "Text", value: "CHECKCARD PURCHASE" },
  { kind: "number", label: "Number", value: -108.3 },
  { kind: "integer", label: "Integer", value: 42 },
  { kind: "boolean", label: "Boolean", value: true },
  { kind: "date", label: "Date", value: "2026-06-12" },
  { kind: "time", label: "Time", value: "13:25:37" },
  { kind: "date-time", label: "Date Time", value: "2026-06-12T13:25:37Z" },
]

export function DataCellDemo() {
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.kind, String(row.value)]))
  )
  const [values, setValues] = React.useState<Record<string, DataCellValue>>(() =>
    Object.fromEntries(rows.map((row) => [row.kind, row.value]))
  )

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="grid grid-cols-[8rem_minmax(10rem,1fr)_minmax(10rem,1fr)] border-b bg-muted/35 text-xs font-medium text-muted-foreground">
        <div className="px-3 py-2">Kind</div>
        <div className="px-3 py-2">Display</div>
        <div className="px-3 py-2">Edit</div>
      </div>
      {rows.map((row) => (
        <div
          key={row.kind}
          className="grid grid-cols-[8rem_minmax(10rem,1fr)_minmax(10rem,1fr)] items-center border-b last:border-b-0"
        >
          <div className="px-3 py-2 text-sm font-medium">{row.label}</div>
          <div className="px-2 py-1">
            <DataCell kind={row.kind} value={values[row.kind]} />
          </div>
          <div className="px-2 py-1">
            <DataCell
              kind={row.kind}
              mode="edit"
              value={
                row.kind === "boolean"
                  ? values[row.kind]
                  : (drafts[row.kind] ?? "")
              }
              draftValue={
                row.kind === "boolean" ? undefined : (drafts[row.kind] ?? "")
              }
              onDraftValueChange={(nextValue) =>
                setDrafts((current) => ({
                  ...current,
                  [row.kind]: nextValue,
                }))
              }
              onValueCommit={(nextValue) =>
                setValues((current) => ({
                  ...current,
                  [row.kind]: nextValue,
                }))
              }
            />
          </div>
        </div>
      ))}
    </div>
  )
}
