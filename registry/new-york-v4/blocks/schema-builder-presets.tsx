"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  SchemaBuilder,
  type ExtendedJSONSchema7,
} from "@/components/ui/schema-builder"

import {
  contactSchema,
  invoiceSchema,
  receiptSchema,
} from "./schema-builder-example-shared"

const presets = [
  { id: "invoice", label: "Invoice", schema: invoiceSchema },
  { id: "receipt", label: "Receipt", schema: receiptSchema },
  { id: "contact", label: "Contact", schema: contactSchema },
]

export function SchemaBuilderPresets() {
  const [activeId, setActiveId] = React.useState("invoice")
  const [schema, setSchema] =
    React.useState<ExtendedJSONSchema7>(invoiceSchema)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={activeId === preset.id ? "secondary" : "outline"}
            onClick={() => {
              setActiveId(preset.id)
              setSchema(preset.schema)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <SchemaBuilder value={schema} onValueChange={setSchema} />
      </div>
    </div>
  )
}
