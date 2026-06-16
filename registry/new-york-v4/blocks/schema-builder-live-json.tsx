"use client"

import * as React from "react"

import {
  SchemaBuilder,
  type ExtendedJSONSchema7,
} from "@/components/ui/schema-builder"

import { invoiceSchema } from "./schema-builder-example-shared"

export function SchemaBuilderLiveJson() {
  const [schema, setSchema] =
    React.useState<ExtendedJSONSchema7>(invoiceSchema)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <SchemaBuilder value={schema} onValueChange={setSchema} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          Emitted JSON Schema
        </div>
        <pre className="max-h-[460px] flex-1 overflow-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </div>
    </div>
  )
}
