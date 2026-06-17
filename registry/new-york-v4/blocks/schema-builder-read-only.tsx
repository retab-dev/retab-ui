"use client"

import {
  SchemaBuilder,
  type ExtendedJSONSchema7,
} from "@/components/ui/schema-builder"

const invoiceSchema: ExtendedJSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string", description: "The invoice identifier" },
    issue_date: { type: "string", description: "Date the invoice was issued" },
    total: { type: "number", description: "Total amount due" },
    currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
    paid: { type: "boolean" },
  },
  required: ["invoice_number", "total"],
}

export function SchemaBuilderReadOnly() {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <SchemaBuilder value={invoiceSchema} readOnly onValueChange={() => {}} />
    </div>
  )
}
