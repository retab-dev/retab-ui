"use client"

import * as React from "react"

import {
  DataCell,
  type DataCellKind,
  type DataCellValue,
} from "@/components/ui/data-cell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const statusOptions = ["pending", "approved", "rejected"]

const rows: Array<{
  id: string
  kind: DataCellKind
  label: string
  value: DataCellValue
  formatValue?: (value: DataCellValue) => React.ReactNode
  enumValues?: string[]
}> = [
  { id: "text", kind: "text", label: "Text", value: "CHECKCARD PURCHASE" },
  { id: "number", kind: "number", label: "Number", value: -108.3 },
  { id: "integer", kind: "integer", label: "Integer", value: 42 },
  { id: "boolean", kind: "boolean", label: "Boolean", value: true },
  { id: "date", kind: "date", label: "Date", value: "2026-06-12" },
  { id: "time", kind: "time", label: "Time", value: "13:25:37" },
  {
    id: "date-time",
    kind: "date-time",
    label: "Date Time",
    value: "2026-06-12T13:25:37Z",
  },
  {
    id: "enum",
    kind: "text",
    label: "Enum",
    value: "approved",
    formatValue: formatStatusValue,
    enumValues: statusOptions,
  },
]

export function DataCellDemo() {
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, String(row.value)]))
  )
  const [values, setValues] = React.useState<Record<string, DataCellValue>>(
    () => Object.fromEntries(rows.map((row) => [row.id, row.value]))
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
          key={row.id}
          className="grid grid-cols-[8rem_minmax(10rem,1fr)_minmax(10rem,1fr)] items-center border-b last:border-b-0"
        >
          <div className="px-3 py-2 text-sm font-medium">{row.label}</div>
          <div className="px-2 py-1">
            <DataCell
              kind={row.kind}
              value={values[row.id]}
              formatValue={row.formatValue}
            />
          </div>
          <div className="px-2 py-1">
            {row.enumValues ? (
              <Select
                value={String(values[row.id] ?? "")}
                onValueChange={(nextValue) => {
                  if (typeof nextValue !== "string") return
                  setDrafts((current) => ({ ...current, [row.id]: nextValue }))
                  setValues((current) => ({ ...current, [row.id]: nextValue }))
                }}
              >
                <SelectTrigger
                  className="h-8 min-h-8 w-full min-w-0 rounded-md border-transparent bg-transparent px-2 text-sm shadow-none hover:border-border hover:bg-background focus-visible:border-ring focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring/30"
                  size="sm"
                >
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {row.enumValues.map((option) => (
                    <SelectItem key={option} value={option}>
                      <span className="capitalize">{option}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <DataCell
                kind={row.kind}
                mode="edit"
                value={
                  row.kind === "boolean"
                    ? values[row.id]
                    : (drafts[row.id] ?? "")
                }
                draftValue={
                  row.kind === "boolean" ? undefined : (drafts[row.id] ?? "")
                }
                onDraftValueChange={(nextValue) =>
                  setDrafts((current) => ({
                    ...current,
                    [row.id]: nextValue,
                  }))
                }
                onValueCommit={(nextValue) =>
                  setValues((current) => ({
                    ...current,
                    [row.id]: nextValue,
                  }))
                }
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function formatStatusValue(value: DataCellValue) {
  const label = typeof value === "string" && value ? value : "none"

  return (
    <span className="inline-flex min-w-0 items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
      <span className="truncate capitalize">{label}</span>
    </span>
  )
}
