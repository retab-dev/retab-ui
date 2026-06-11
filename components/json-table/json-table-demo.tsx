"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { TableDocument } from "@/components/json-table/lib/projects-types"
import sampleData from "@/components/json-table/sample/data.json"
import sampleSchema from "@/components/json-table/sample/schema.json"
import { SingleFileTableView } from "@/components/json-table/single-file-table-view"

// A 60-day business checking statement with 1,500 transaction rows: a long flat
// array that exercises the table's virtualization.
const document = {
  id: "doc_1",
  data: sampleData as Record<string, unknown>,
} satisfies TableDocument

const schema = sampleSchema as unknown as JSONSchema7

export function JsonTableDemo() {
  const [currentSchema, setSchema] = React.useState<JSONSchema7>(schema)
  return (
    <div className="not-prose flex flex-col gap-2">
      <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <SingleFileTableView
          document={document}
          schema={currentSchema}
          setSchema={setSchema}
          editMode="readOnly"
          allowEditing={false}
        />
      </div>
    </div>
  )
}
