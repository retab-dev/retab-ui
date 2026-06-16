"use client"

import * as React from "react"

import {
  SchemaBuilder,
  type ExtendedJSONSchema7,
} from "@/components/ui/schema-builder"

const orderSchema: ExtendedJSONSchema7 = {
  type: "object",
  title: "Order",
  $defs: {
    address: {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
        postal_code: { type: "string" },
        country: { type: "string" },
      },
      required: ["street", "city"],
    },
  },
  properties: {
    order_id: { type: "string" },
    billing_address: { $ref: "#/$defs/address" },
    shipping_address: { $ref: "#/$defs/address" },
    total: { type: "number" },
  },
  required: ["order_id"],
}

export function SchemaBuilderDefinitions() {
  const [schema, setSchema] = React.useState<ExtendedJSONSchema7>(orderSchema)

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <SchemaBuilder
        value={schema}
        onValueChange={setSchema}
        features={{
          definitions: true,
          objectTemplates: true,
          jsonMode: true,
          importExport: true,
        }}
      />
    </div>
  )
}
