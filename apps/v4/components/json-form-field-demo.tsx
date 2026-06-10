"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import type { JSONSchema7 } from "json-schema"

import { JsonForm } from "@/components/json-form-field/json-form-field"
import { Button } from "@/components/uiform/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
      required: ["name"],
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
        required: ["description"],
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

export function JsonFormFieldDemo() {
  const form = useForm<Record<string, unknown>>({ defaultValues })
  const [submitted, setSubmitted] = React.useState<unknown>(null)

  return (
    <Tabs defaultValue="form" className="not-prose w-full gap-3">
      <TabsList>
        <TabsTrigger value="form">Form</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>
      <TabsContent value="form">
        <div className="rounded-xl border bg-card p-4">
          <JsonForm
            form={form}
            schema={schema}
            onSubmit={(data) => setSubmitted(data)}
          >
            <Button type="submit" size="sm">
              Submit
            </Button>
          </JsonForm>
        </div>
      </TabsContent>
      <TabsContent value="json">
        <pre className="max-h-[560px] overflow-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs">
          {JSON.stringify(submitted ?? form.watch(), null, 2)}
        </pre>
      </TabsContent>
    </Tabs>
  )
}
