"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import type { JSONSchema7 } from "json-schema"

import { JsonForm } from "@/components/json-form-field/json-form-field"
import { Button } from "@/components/uiform/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import sampleSchema from "@/components/json-form-field/sample/schema.json"
import sampleData from "@/components/json-form-field/sample/data.json"

/** Drop Retab's `X-*` schema extensions so the form renders no extra controls. */
function stripExtensions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripExtensions)
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("X-")) continue
      out[key] = stripExtensions(value)
    }
    return out
  }
  return node
}

// A real extraction: an oil & gas revenue statement nested three arrays deep
// (`properties[] → production[] → line_items[]`) — a few thousand leaf fields.
const schema = stripExtensions(sampleSchema) as JSONSchema7
const defaultValues = sampleData as Record<string, unknown>

export function JsonFormFieldDemo() {
  const form = useForm<Record<string, unknown>>({
    defaultValues,
    // Validate on blur, not on every keystroke, so deep trees stay responsive.
    mode: "onBlur",
  })
  const [submitted, setSubmitted] = React.useState<unknown>(null)
  const [json, setJson] = React.useState("")

  return (
    <Tabs
      defaultValue="form"
      className="not-prose w-full gap-3"
      // Snapshot values lazily when the JSON tab opens instead of watching the
      // whole (thousands-of-fields) form on every keystroke.
      onValueChange={(tab) => {
        if (tab === "json") {
          setJson(JSON.stringify(submitted ?? form.getValues(), null, 2))
        }
      }}
    >
      <TabsList>
        <TabsTrigger value="form">Form</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>
      <TabsContent value="form">
        <div className="max-h-[640px] overflow-auto rounded-xl border bg-card p-4">
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
        <pre className="max-h-[640px] overflow-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs">
          {json}
        </pre>
      </TabsContent>
    </Tabs>
  )
}
