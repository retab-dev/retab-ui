"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { TableDocument } from "@/components/json-table/lib/projects-types"
import sampleData from "@/components/json-table/sample/data.json"
import sampleSchema from "@/components/json-table/sample/schema.json"
import {
  SingleFileTableView,
  type JsonTableJsonEditMode,
  type JsonTableSchemaEditMode,
} from "@/components/json-table/single-file-table-view"

const jsonEditModes: Array<{ value: JsonTableJsonEditMode; label: string }> = [
  { value: "readOnly", label: "Read only" },
  { value: "editable", label: "Editable" },
]

const schemaEditModes: Array<{
  value: JsonTableSchemaEditMode
  label: string
}> = [
  { value: "readOnly", label: "Read only" },
  { value: "editable", label: "Editable" },
  { value: "descriptionOnly", label: "Descriptions" },
]

const data = sampleData as Record<string, unknown>
const schema = sampleSchema as unknown as JSONSchema7
export type JsonTableDemoProfileVariant = "default" | "large"

const demoSchema = {
  ...schema,
  properties: {
    ...schema.properties,
    transactions: {
      ...(schema.properties?.transactions as Record<string, unknown>),
      items: {
        ...((schema.properties?.transactions as Record<string, unknown>)
          ?.items as Record<string, unknown>),
        properties: {
          ...(((schema.properties?.transactions as Record<string, unknown>)
            ?.items as Record<string, unknown>)?.properties as Record<
            string,
            unknown
          >),
          is_reconciled: {
            type: "boolean",
            title: "Reconciled",
            description: "Whether this transaction has been reviewed.",
          },
        },
      },
    },
  },
} as JSONSchema7

const largeTransactionEnumValues = [
  "CREDIT",
  "DEBIT",
  "REVERSAL_PENDING_MANUAL_REVIEW_WITH_A_VERY_LONG_LABEL",
  "LEGACY_DISABLED_TRANSACTION_TYPE_DO_NOT_USE",
]

const largeReviewStatusValues = [
  "ready",
  "needs_follow_up_with_exceptionally_long_review_label",
  "blocked_by_missing_source",
  "legacy_disabled_status",
  null,
]

const largeTransactionExtraProperties = Object.fromEntries(
  Array.from({ length: 18 }, (_, index) => [
    `profile_extra_${String(index).padStart(2, "0")}`,
    {
      type: index % 3 === 0 ? "number" : index % 3 === 1 ? "string" : "boolean",
      title: `Profile Extra ${index}`,
    },
  ])
)

function createDemoSchema(profileVariant: JsonTableDemoProfileVariant) {
  if (profileVariant === "default") return demoSchema

  const transactions = demoSchema.properties?.transactions as
    | Record<string, unknown>
    | undefined
  const transactionItems = transactions?.items as
    | Record<string, unknown>
    | undefined
  const transactionProperties = transactionItems?.properties as
    | Record<string, unknown>
    | undefined

  return {
    ...demoSchema,
    properties: {
      ...demoSchema.properties,
      transactions: {
        ...transactions,
        items: {
          ...transactionItems,
          properties: {
            ...transactionProperties,
            transaction_type: {
              ...(transactionProperties?.transaction_type as Record<
                string,
                unknown
              >),
              enum: largeTransactionEnumValues,
              "x-disabled-enum-values": [
                "LEGACY_DISABLED_TRANSACTION_TYPE_DO_NOT_USE",
              ],
            },
            merchant_category: {
              type: "string",
              enum: [
                "healthcare_services_with_unusually_long_label",
                "office_supplies",
                "travel_and_lodging",
                "legacy_disabled_category",
              ],
              "x-disabled-enum-values": ["legacy_disabled_category"],
              title: "Merchant Category",
            },
            review: {
              type: "object",
              title: "Review",
              properties: {
                status: {
                  enum: largeReviewStatusValues,
                  "x-disabled-enum-values": ["legacy_disabled_status"],
                  title: "Review Status",
                },
                priority: {
                  type: "integer",
                  enum: [1, 2, 3, 4],
                  title: "Priority",
                },
                nested: {
                  type: "object",
                  title: "Nested Review Detail",
                  properties: {
                    owner: { type: "string", title: "Owner" },
                    queue: { type: "string", title: "Queue" },
                    confidence: { type: "number", title: "Confidence" },
                  },
                },
              },
            },
            details: {
              type: "object",
              title: "Details",
              properties: {
                location: {
                  type: "object",
                  title: "Location",
                  properties: {
                    city: { type: "string", title: "City" },
                    region: { type: "string", title: "Region" },
                    country: { type: "string", title: "Country" },
                  },
                },
                sparse_note: {
                  type: ["string", "null"],
                  title: "Sparse Note",
                },
              },
            },
            ...largeTransactionExtraProperties,
          },
        },
      },
    },
  } as JSONSchema7
}

function createDemoDocument(profileVariant: JsonTableDemoProfileVariant) {
  const transactions = Array.isArray(data.transactions)
    ? demoTransactions(profileVariant)
    : data.transactions

  return {
    id: "doc_1",
    data: {
      ...data,
      transactions,
    },
  } satisfies TableDocument
}

function demoTransactions(profileVariant: JsonTableDemoProfileVariant) {
  const sampleTransactions = Array.isArray(data.transactions)
    ? data.transactions
    : []
  const rowCount = profileVariant === "large" ? 720 : sampleTransactions.length

  return Array.from({ length: rowCount }, (_, index) => {
    const source = sampleTransactions[index % sampleTransactions.length]
    const base =
      source && typeof source === "object"
        ? (source as Record<string, unknown>)
        : {}

    if (profileVariant === "default") {
      return { ...base, is_reconciled: index % 3 === 0 }
    }

    return {
      ...base,
      date: `2025-07-${String((index % 28) + 1).padStart(2, "0")}`,
      transaction_type: largeTransactionEnumValues[index % 3],
      description: `${String(base.description ?? "Transaction")} / profile row ${index} / ${"long-description ".repeat(index % 5)}`,
      is_reconciled: index % 3 === 0,
      merchant_category:
        index % 11 === 0 ? undefined : index % 2 === 0 ? "office_supplies" : "travel_and_lodging",
      review:
        index % 7 === 0
          ? undefined
          : {
              status:
                index % 9 === 0
                  ? null
                  : largeReviewStatusValues[index % 3],
              priority: (index % 4) + 1,
              nested:
                index % 5 === 0
                  ? undefined
                  : {
                      owner: `owner-${index % 13}`,
                      queue: `queue-${index % 8}`,
                      confidence: Number(((index % 100) / 100).toFixed(2)),
                    },
            },
      details:
        index % 6 === 0
          ? undefined
          : {
              location: {
                city: `City ${index % 17}`,
                region: `Region ${index % 9}`,
                country: index % 2 === 0 ? "US" : "CA",
              },
              sparse_note:
                index % 10 === 0 ? null : `Sparse note for row ${index}`,
            },
      ...Object.fromEntries(
        Array.from({ length: 18 }, (_, extraIndex) => {
          const key = `profile_extra_${String(extraIndex).padStart(2, "0")}`
          if ((index + extraIndex) % 13 === 0) return [key, undefined]
          if (extraIndex % 3 === 0) return [key, index * (extraIndex + 1)]
          if (extraIndex % 3 === 1) {
            return [key, `extra-${extraIndex}-${index}-${"x".repeat(index % 12)}`]
          }
          return [key, (index + extraIndex) % 2 === 0]
        })
      ),
    }
  })
}

export function JsonTableDemo({
  profileVariant = "default",
}: {
  profileVariant?: JsonTableDemoProfileVariant
}) {
  const [document, setDocument] = React.useState<TableDocument>(() =>
    createDemoDocument(profileVariant)
  )
  const [currentSchema, setSchema] = React.useState<JSONSchema7>(() =>
    createDemoSchema(profileVariant)
  )
  const [jsonEditMode, setJsonEditMode] =
    React.useState<JsonTableJsonEditMode>("readOnly")
  const [schemaEditMode, setSchemaEditMode] =
    React.useState<JsonTableSchemaEditMode>("descriptionOnly")
  const updateDocument = React.useCallback(
    async (patch: Record<string, unknown>) => {
      if (patch.data && typeof patch.data === "object") {
        setDocument((currentDocument) => ({
          ...currentDocument,
          data: patch.data as Record<string, unknown>,
        }))
      }
    },
    []
  )

  return (
    <div className="not-prose flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModeSwitch
          label="JSON"
          ariaLabel="JSON edit mode"
          modes={jsonEditModes}
          value={jsonEditMode}
          onChange={setJsonEditMode}
        />
        <ModeSwitch
          label="Schema"
          ariaLabel="Schema edit mode"
          modes={schemaEditModes}
          value={schemaEditMode}
          onChange={setSchemaEditMode}
        />
      </div>
      <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <SingleFileTableView
          document={document}
          schema={currentSchema}
          setSchema={setSchema}
          jsonEditMode={jsonEditMode}
          schemaEditMode={schemaEditMode}
          onUpdateDocument={updateDocument}
        />
      </div>
    </div>
  )
}

function ModeSwitch<TMode extends string>({
  label,
  ariaLabel,
  modes,
  value,
  onChange,
}: {
  label: string
  ariaLabel: string
  modes: Array<{ value: TMode; label: string }>
  value: TMode
  onChange: (value: TMode) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={ariaLabel}
        className="inline-flex items-center justify-between overflow-hidden rounded-md border bg-background p-0.5"
      >
        {modes.map((mode) => {
          const isSelected = value === mode.value

          return (
            <button
              key={mode.value}
              type="button"
              aria-pressed={isSelected}
              className={[
                "h-7 rounded px-2.5 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
              onClick={() => onChange(mode.value)}
            >
              {mode.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
