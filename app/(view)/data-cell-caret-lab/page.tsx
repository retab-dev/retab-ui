"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { SingleFileTableView } from "@/components/json-table/single-file-table-view"

const initialDocument: TableDocument = {
  id: "doc_caret_lab",
  data: {
    code: "USD",
    memo: "ACME BANK",
    amount: 21.62,
    count: 3,
    is_paid: false,
    shipped_at: "2025-07-18",
    status: "draft",
  },
}

const initialSchema: JSONSchema7 = {
  type: "object",
  properties: {
    code: {
      type: "string",
      title: "Code",
    },
    memo: {
      anyOf: [{ type: "string" }, { type: "null" }],
      title: "Memo",
    },
    amount: {
      type: "number",
      title: "Amount",
    },
    count: {
      type: "integer",
      title: "Count",
    },
    is_paid: {
      type: "boolean",
      title: "Paid",
    },
    shipped_at: {
      type: "string",
      format: "date",
      title: "Shipped",
    },
    status: {
      enum: ["draft", "approved", "blocked"],
      title: "Status",
    },
  },
}

export default function DataCellCaretLabPage() {
  const [document, setDocument] = React.useState<TableDocument>(initialDocument)
  const [schema, setSchema] = React.useState<JSONSchema7>(initialSchema)

  return (
    <main
      id="data-cell-caret-lab"
      className="flex min-h-screen flex-col gap-4 bg-background p-6 text-foreground"
    >
      <style>{`
        #data-cell-caret-lab [data-slot="data-cell"] {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace !important;
          font-size: 18px !important;
          line-height: 24px !important;
          letter-spacing: 0 !important;
        }

        #data-cell-caret-lab td[data-field-path] {
          height: 40px !important;
        }
      `}</style>
      <div
        data-testid="data-cell-caret-json-table"
        className="h-[360px] overflow-hidden border bg-background"
      >
        <SingleFileTableView
          document={document}
          schema={schema}
          setSchema={setSchema}
          jsonEditMode="editable"
          schemaEditMode="readOnly"
          columnWidth="small"
          overscan={4}
          jumpOverscan={4}
          onUpdateDocument={async (patch) => {
            if (!patch.data || typeof patch.data !== "object") return
            setDocument((currentDocument) => ({
              ...currentDocument,
              data: patch.data as Record<string, unknown>,
            }))
          }}
        />
      </div>
      <output data-testid="data-cell-caret-document">
        {JSON.stringify(document.data)}
      </output>
    </main>
  )
}
