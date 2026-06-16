"use client"

import { SchemaBuilder } from "@/components/ui/schema-builder"

import { invoiceSchema } from "./schema-builder-example-shared"

export function SchemaBuilderReadOnly() {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <SchemaBuilder
        value={invoiceSchema}
        readOnly
        onValueChange={() => {}}
      />
    </div>
  )
}
