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

export type JsonTableDemoProfileOptions = {
  extraColumnCount?: number
  jumpOverscan?: number
  overscan?: number
  rowCount?: number
  variant: JsonTableDemoProfileVariant
}

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
          is_reconciled: {
            type: "boolean",
            title: "Reconciled",
            description: "Whether this transaction has been reviewed.",
          },
          ...((
            (schema.properties?.transactions as Record<string, unknown>)
              ?.items as Record<string, unknown>
          )?.properties as Record<string, unknown>),
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

const maxLargeTransactionExtraColumnCount = 18

function largeTransactionExtraProperties(extraColumnCount: number) {
  return Object.fromEntries(
    Array.from({ length: extraColumnCount }, (_, index) => [
      `profile_extra_${String(index).padStart(2, "0")}`,
      {
        type:
          index % 3 === 0 ? "number" : index % 3 === 1 ? "string" : "boolean",
        title: `Profile Extra ${index}`,
      },
    ])
  )
}

function largeTransactionExtraValues({
  extraColumnCount,
  index,
}: {
  extraColumnCount: number
  index: number
}) {
  return Object.fromEntries(
    Array.from({ length: extraColumnCount }, (_, extraIndex) => {
      const key = `profile_extra_${String(extraIndex).padStart(2, "0")}`
      if ((index + extraIndex) % 13 === 0) return [key, undefined]
      if (extraIndex % 3 === 0) return [key, index * (extraIndex + 1)]
      if (extraIndex % 3 === 1) {
        return [key, `extra-${extraIndex}-${index}-${"x".repeat(index % 12)}`]
      }
      return [key, (index + extraIndex) % 2 === 0]
    })
  )
}

function normalizedExtraColumnCount({
  extraColumnCount,
  variant,
}: Pick<JsonTableDemoProfileOptions, "extraColumnCount" | "variant">) {
  if (variant === "default") return 0
  if (extraColumnCount === undefined) return maxLargeTransactionExtraColumnCount
  if (!Number.isFinite(extraColumnCount))
    return maxLargeTransactionExtraColumnCount
  return Math.max(
    0,
    Math.min(maxLargeTransactionExtraColumnCount, Math.floor(extraColumnCount))
  )
}

function normalizedRowCount({
  rowCount,
  sampleRowCount,
  variant,
}: Pick<JsonTableDemoProfileOptions, "rowCount" | "variant"> & {
  sampleRowCount: number
}) {
  if (rowCount !== undefined && Number.isFinite(rowCount)) {
    return Math.max(1, Math.floor(rowCount))
  }
  return variant === "large" ? 720 : sampleRowCount
}

function createDemoSchema(profileOptions: JsonTableDemoProfileOptions) {
  if (profileOptions.variant === "default") return demoSchema
  const extraColumnCount = normalizedExtraColumnCount(profileOptions)

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
            ...largeTransactionExtraProperties(extraColumnCount),
            profile_far_note: {
              type: "string",
              title: "Profile Far Note",
            },
            profile_far_status: {
              type: "string",
              enum: ["new", "reviewed", "archived", "legacy_disabled_status"],
              "x-disabled-enum-values": ["legacy_disabled_status"],
              title: "Profile Far Status",
            },
            profile_far_date: {
              type: "string",
              format: "date",
              title: "Profile Far Date",
            },
            profile_far_details: {
              type: "object",
              title: "Profile Far Details",
              patternProperties: {
                "^priority$": { type: "number", title: "Priority" },
              },
              additionalProperties: { type: "string" },
            },
            profile_far_tags: {
              type: "array",
              title: "Profile Far Tags",
            },
          },
        },
      },
    },
  } as JSONSchema7
}

function createDemoDocument(profileOptions: JsonTableDemoProfileOptions) {
  const transactions = Array.isArray(data.transactions)
    ? demoTransactions(profileOptions)
    : data.transactions

  return {
    id: "doc_1",
    data: {
      ...data,
      transactions,
    },
  } satisfies TableDocument
}

function demoTransactions(profileOptions: JsonTableDemoProfileOptions) {
  const sampleTransactions = Array.isArray(data.transactions)
    ? data.transactions
    : []
  const rowCount = normalizedRowCount({
    ...profileOptions,
    sampleRowCount: sampleTransactions.length,
  })
  const extraColumnCount = normalizedExtraColumnCount(profileOptions)

  return Array.from({ length: rowCount }, (_, index) => {
    const source = sampleTransactions[index % sampleTransactions.length]
    const base =
      source && typeof source === "object"
        ? (source as Record<string, unknown>)
        : {}

    if (profileOptions.variant === "default") {
      return { ...base, is_reconciled: index % 3 === 0 }
    }

    return {
      ...base,
      date: `2025-07-${String((index % 28) + 1).padStart(2, "0")}`,
      transaction_type: largeTransactionEnumValues[index % 3],
      description: `${String(base.description ?? "Transaction")} / profile row ${index} / ${"long-description ".repeat(index % 5)}`,
      is_reconciled: index % 3 === 0,
      merchant_category:
        index % 11 === 0
          ? undefined
          : index % 2 === 0
            ? "office_supplies"
            : "travel_and_lodging",
      review:
        index % 7 === 0
          ? undefined
          : {
              status:
                index % 9 === 0 ? null : largeReviewStatusValues[index % 3],
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
      ...largeTransactionExtraValues({ extraColumnCount, index }),
      profile_far_note: `far profile note ${index}`,
      profile_far_status:
        index % 5 === 0 ? "archived" : index % 2 === 0 ? "reviewed" : "new",
      profile_far_date: `2025-08-${String((index % 28) + 1).padStart(2, "0")}`,
      profile_far_details: {
        reviewer: `reviewer-${index % 11}`,
        priority: (index % 4) + 1,
      },
      profile_far_tags: [`tag-${index % 3}`, `queue-${index % 5}`],
    }
  })
}

export function JsonTableDemo({
  profileExtraColumnCount,
  profileJumpOverscan,
  profileOverscan,
  profileRowCount,
  profileVariant = "default",
}: {
  profileExtraColumnCount?: number
  profileJumpOverscan?: number
  profileOverscan?: number
  profileRowCount?: number
  profileVariant?: JsonTableDemoProfileVariant
}) {
  const profileOptions = React.useMemo<JsonTableDemoProfileOptions>(
    () => ({
      extraColumnCount: profileExtraColumnCount,
      jumpOverscan: profileJumpOverscan,
      overscan: profileOverscan,
      rowCount: profileRowCount,
      variant: profileVariant,
    }),
    [
      profileExtraColumnCount,
      profileJumpOverscan,
      profileOverscan,
      profileRowCount,
      profileVariant,
    ]
  )
  const [document, setDocument] = React.useState<TableDocument>(() =>
    createDemoDocument(profileOptions)
  )
  const [currentSchema, setSchema] = React.useState<JSONSchema7>(() =>
    createDemoSchema(profileOptions)
  )
  const [jsonEditMode, setJsonEditMode] =
    React.useState<JsonTableJsonEditMode>("readOnly")
  const [schemaEditMode, setSchemaEditMode] =
    React.useState<JsonTableSchemaEditMode>("descriptionOnly")
  const [profileCallbackVersion, setProfileCallbackVersion] = React.useState(0)
  const updateDocument = React.useCallback(
    async (patch: Record<string, unknown>) => {
      if (patch.data && typeof patch.data === "object") {
        setDocument((currentDocument) => ({
          ...currentDocument,
          data: patch.data as Record<string, unknown>,
        }))
      }
    },
    [profileCallbackVersion]
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
        <button
          type="button"
          data-json-table-profile-callback-version={profileCallbackVersion}
          className="sr-only"
          onClick={() => setProfileCallbackVersion((version) => version + 1)}
        >
          Callback churn
        </button>
      </div>
      <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <SingleFileTableView
          document={document}
          schema={currentSchema}
          setSchema={setSchema}
          jsonEditMode={jsonEditMode}
          schemaEditMode={schemaEditMode}
          onUpdateDocument={updateDocument}
          overscan={profileOptions.overscan}
          jumpOverscan={profileOptions.jumpOverscan}
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
