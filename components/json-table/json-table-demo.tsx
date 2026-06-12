"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { TableDocument } from "@/components/json-table/lib/projects-types"
import sampleData from "@/components/json-table/sample/data.json"
import sampleSchema from "@/components/json-table/sample/schema.json"
import {
  SingleFileTableView,
  type JsonTableJsonEditMode,
  type JsonTableSchemaEditMode,
} from "@/components/json-table/single-file-table-view"

const jsonEditModes: Array<{ value: JsonTableJsonEditMode; label: string }> = [
  { value: "readOnly", label: "Read only" },
  { value: "editable", label: "Editable" },
]

const schemaEditModes: Array<{
  value: JsonTableSchemaEditMode
  label: string
}> = [
  { value: "readOnly", label: "Read only" },
  { value: "editable", label: "Editable" },
  { value: "descriptionOnly", label: "Descriptions" },
]

const data = sampleData as Record<string, unknown>
const schema = sampleSchema as unknown as JSONSchema7

const demoSchema = {
  ...schema,
  properties: {
    ...schema.properties,
    transactions: {
      ...(schema.properties?.transactions as Record<string, unknown>),
      items: {
        ...((schema.properties?.transactions as Record<string, unknown>)
          ?.items as Record<string, unknown>),
        properties: {
          ...(((schema.properties?.transactions as Record<string, unknown>)
            ?.items as Record<string, unknown>)?.properties as Record<
            string,
            unknown
          >),
          is_reconciled: {
            type: "boolean",
            title: "Reconciled",
            description: "Whether this transaction has been reviewed.",
          },
        },
      },
    },
  },
} as JSONSchema7

function createDemoDocument() {
  const transactions = Array.isArray(data.transactions)
    ? data.transactions.map((transaction, index) =>
        transaction && typeof transaction === "object"
          ? { ...transaction, is_reconciled: index % 3 === 0 }
          : transaction
      )
    : data.transactions

  return {
    id: "doc_1",
    data: {
      ...data,
      transactions,
    },
  } satisfies TableDocument
}

export function JsonTableDemo() {
  const [document, setDocument] =
    React.useState<TableDocument>(createDemoDocument)
  const [currentSchema, setSchema] = React.useState<JSONSchema7>(demoSchema)
  const [jsonEditMode, setJsonEditMode] =
    React.useState<JsonTableJsonEditMode>("readOnly")
  const [schemaEditMode, setSchemaEditMode] =
    React.useState<JsonTableSchemaEditMode>("descriptionOnly")

  return (
    <div className="not-prose flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModeSwitch
          label="JSON"
          ariaLabel="JSON edit mode"
          modes={jsonEditModes}
          value={jsonEditMode}
          onChange={setJsonEditMode}
        />
        <ModeSwitch
          label="Schema"
          ariaLabel="Schema edit mode"
          modes={schemaEditModes}
          value={schemaEditMode}
          onChange={setSchemaEditMode}
        />
      </div>
      <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <SingleFileTableView
          document={document}
          schema={currentSchema}
          setSchema={setSchema}
          jsonEditMode={jsonEditMode}
          schemaEditMode={schemaEditMode}
          onUpdateDocument={async (patch) => {
            if (patch.data && typeof patch.data === "object") {
              setDocument((currentDocument) => ({
                ...currentDocument,
                data: patch.data as Record<string, unknown>,
              }))
            }
          }}
        />
      </div>
    </div>
  )
}

function ModeSwitch<TMode extends string>({
  label,
  ariaLabel,
  modes,
  value,
  onChange,
}: {
  label: string
  ariaLabel: string
  modes: Array<{ value: TMode; label: string }>
  value: TMode
  onChange: (value: TMode) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={ariaLabel}
        className="inline-flex items-center justify-between overflow-hidden rounded-md border bg-background p-0.5"
      >
        {modes.map((mode) => {
          const isSelected = value === mode.value

          return (
            <button
              key={mode.value}
              type="button"
              aria-pressed={isSelected}
              className={[
                "h-7 rounded px-2.5 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
              onClick={() => onChange(mode.value)}
            >
              {mode.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
