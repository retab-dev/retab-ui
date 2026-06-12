"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { TableDocument } from "@/components/json-table/lib/projects-types"
import sampleData from "@/components/json-table/sample/data.json"
import sampleSchema from "@/components/json-table/sample/schema.json"
import { SingleFileTableView } from "@/components/json-table/single-file-table-view"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type JsonTableEditMode = "readOnly" | "editable" | "descriptionOnly"

const editModes: Array<{ value: JsonTableEditMode; label: string }> = [
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
  const [editMode, setEditMode] =
    React.useState<JsonTableEditMode>("readOnly")

  return (
    <div className="not-prose flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <Tabs
          value={editMode}
          onValueChange={(value) => setEditMode(value as JsonTableEditMode)}
        >
          <TabsList>
            {editModes.map((mode) => (
              <TabsTrigger key={mode.value} value={mode.value}>
                {mode.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <SingleFileTableView
          document={document}
          schema={currentSchema}
          setSchema={setSchema}
          editMode={editMode}
          allowEditing={editMode === "editable"}
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
