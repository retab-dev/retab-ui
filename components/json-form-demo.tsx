"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import type { JSONSchema7 } from "json-schema"

import { UiForm, UiFormContent } from "@/components/json-form/json-form"

const schema: JSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string", description: "Invoice identifier" },
    issue_date: { type: "string", format: "date", description: "Issue date" },
    total: { type: "number", description: "Total amount due" },
    paid: { type: "boolean", description: "Has the invoice been paid?" },
    currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
    vendor: {
      type: "object",
      title: "Vendor",
      properties: {
        name: { type: "string" },
        country: { type: "string" },
      },
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "integer" },
          unit_price: { type: "number" },
        },
      },
    },
  },
  required: ["invoice_number", "total"],
}

const defaultValues = {
  invoice_number: "INV-1024",
  issue_date: "2026-05-01",
  total: 1280.5,
  paid: false,
  currency: "USD",
  vendor: { name: "Acme Corp", country: "US" },
  line_items: [{ description: "Widget", quantity: 3, unit_price: 426.83 }],
}

export function JsonFormDemo() {
  const form = useForm<Record<string, unknown>>({ defaultValues })
  const [likelihoods, setLikelihoods] = React.useState<Record<string, unknown>>({})
  const [validationFlags, setValidationFlags] = React.useState<Record<string, unknown>>({})

  return (
    <div className="not-prose max-w-xl rounded-xl border bg-card p-4">
      <UiForm
        schema={schema}
        form={form}
        onSubmit={(data) => console.log("submit", data)}
        variant="normal"
        size="lg"
        isStreaming={false}
        isProcessing={false}
        scalarValueDisplay="none"
        scalarValueType="none"
        likelihoods={likelihoods}
        setLikelihoods={setLikelihoods}
        titlePosition="object"
        propertyEditorMode="readOnly"
        showPropertyEditorPencil={false}
        validationFlags={validationFlags}
        setValidationFlags={setValidationFlags}
      >
        <UiFormContent />
      </UiForm>
    </div>
  )
}
