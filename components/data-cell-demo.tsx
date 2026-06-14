"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import {
  DataCell,
  type DataCellKind,
  type DataCellValue,
} from "@/components/ui/data-cell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectPrimitive,
  SelectValue,
} from "@/components/ui/select"

const statusOptions = ["pending", "approved", "rejected"]
type DemoDataCellKind = Exclude<DataCellKind, "select">

const rows: Array<{
  id: string
  kind: DemoDataCellKind
  label: string
  value: DataCellValue
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
    enumValues: statusOptions,
  },
]

function numberCellValue(value: DataCellValue): string | number | null {
  return typeof value === "number" || typeof value === "string" ? value : null
}

function textCellValue(value: DataCellValue): string | null {
  return value === null || value === undefined ? null : String(value)
}

function booleanCellValue(value: DataCellValue): boolean | null {
  return typeof value === "boolean" ? value : null
}

function DemoDataCell({
  kind,
  value,
  editable = false,
  draftValue,
  onDraftValueChange,
  onCommit,
}: {
  kind: DemoDataCellKind
  value: DataCellValue
  editable?: boolean
  draftValue?: string
  onDraftValueChange?: (value: string) => void
  onCommit?: (value: DataCellValue) => void
}) {
  if (kind === "number" || kind === "integer") {
    return (
      <DataCell
        kind={kind}
        active={editable}
        value={numberCellValue(value)}
        draftValue={draftValue}
        onDraftValueChange={onDraftValueChange}
        onCommit={onCommit}
      />
    )
  }

  if (kind === "boolean") {
    return (
      <DataCell
        kind="boolean"
        active={editable}
        value={booleanCellValue(value)}
        onCommit={onCommit}
      />
    )
  }

  return (
    <DataCell
      kind={kind}
      active={editable}
      value={textCellValue(value)}
      draftValue={draftValue}
      onDraftValueChange={onDraftValueChange}
      onCommit={onCommit}
    />
  )
}

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
            {row.enumValues ? (
              <EnumDisplayCell value={values[row.id]} />
            ) : (
              <DemoDataCell kind={row.kind} value={values[row.id]} />
            )}
          </div>
          <div className="px-2 py-1">
            {row.enumValues ? (
              <EnumDataCell
                value={values[row.id]}
                options={row.enumValues}
                onValueChange={(nextValue) => {
                  setDrafts((current) => ({ ...current, [row.id]: nextValue }))
                  setValues((current) => ({ ...current, [row.id]: nextValue }))
                }}
              />
            ) : (
              <DemoDataCell
                editable
                kind={row.kind}
                value={values[row.id]}
                draftValue={
                  row.kind === "text" ||
                  row.kind === "number" ||
                  row.kind === "integer"
                    ? (drafts[row.id] ?? "")
                    : undefined
                }
                onDraftValueChange={(nextValue) =>
                  setDrafts((current) => ({
                    ...current,
                    [row.id]: nextValue,
                  }))
                }
                onCommit={(nextValue) =>
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

const enumCellClassName =
  "relative inline-flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg bg-transparent px-3 text-left text-base text-foreground transition-colors outline-none select-none sm:min-h-8 sm:text-sm pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4"

function EnumDisplayCell({ value }: { value: DataCellValue }) {
  const selectedValue = typeof value === "string" ? value : ""

  return (
    <div
      data-slot="data-cell"
      data-kind="enum"
      data-mode="display"
      className={enumCellClassName}
    >
      <span className="flex-1 truncate in-data-placeholder:text-muted-foreground/72">
        {selectedValue}
      </span>
      <ChevronDown className="-me-1 size-4.5 opacity-80 sm:size-4" />
    </div>
  )
}

function EnumDataCell({
  value,
  options,
  onValueChange,
}: {
  value: DataCellValue
  options: string[]
  onValueChange: (value: string) => void
}) {
  const selectedValue = typeof value === "string" ? value : ""

  return (
    <div>
      <Select
        value={selectedValue}
        onValueChange={(nextValue) => {
          if (typeof nextValue !== "string") return
          onValueChange(nextValue)
        }}
      >
        <SelectPrimitive.Trigger
          data-kind="enum"
          data-mode="edit"
          data-slot="select-trigger"
          className={enumCellClassName}
        >
          <SelectValue>{selectedValue}</SelectValue>
          <SelectPrimitive.Icon data-slot="select-icon">
            <ChevronDown className="-me-1 size-4.5 opacity-80 sm:size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              <span className="capitalize">{option}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
