"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonForm } from "@/components/json-form/json-form"
import sampleData from "@/components/json-form/sample/data.json"
import sampleSchema from "@/components/json-form/sample/schema.json"

// A real extraction: an oil & gas revenue statement nested three arrays deep
// (`properties[] → production[] → line_items[]`) — a few thousand leaf fields.
const schema = sampleSchema as JSONSchema7
const defaultValues = sampleData as Record<string, unknown>

export function JsonFormDemo({
  showJsonTab = true,
}: {
  /** Hide the Form/JSON toggle and render the form on its own. */
  showJsonTab?: boolean
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues,
    // Validate on blur, not on every keystroke, so deep trees stay responsive.
    mode: "onBlur",
  })
  const [submitted, setSubmitted] = React.useState<unknown>(null)
  const [json, setJson] = React.useState("")

  if (!showJsonTab) {
    return (
      <div className="not-prose w-full">
        <div className="max-h-[640px] overflow-auto rounded-xl border bg-card p-4 shadow-sm">
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
      </div>
    )
  }

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
        <div className="max-h-[640px] overflow-auto rounded-xl border bg-card p-4 shadow-sm">
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
        <pre className="max-h-[640px] overflow-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs shadow-sm">
          {json}
        </pre>
      </TabsContent>
    </Tabs>
  )
}
