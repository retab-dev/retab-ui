"use client"

import * as React from "react"

import {
  SchemaBuilder,
  type ExtendedJSONSchema7,
  type SchemaBuilderView,
} from "@/components/ui/schema-builder"

import { invoiceSchema } from "./schema-builder-example-shared"

export function SchemaBuilderJsonMode() {
  const [schema, setSchema] =
    React.useState<ExtendedJSONSchema7>(invoiceSchema)
  const [view, setView] = React.useState<SchemaBuilderView>("fields")

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <SchemaBuilder
        value={schema}
        onValueChange={setSchema}
        features={{ jsonMode: true }}
        view={view}
        onViewChange={setView}
      />
    </div>
  )
}
