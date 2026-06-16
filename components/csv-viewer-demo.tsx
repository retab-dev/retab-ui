"use client"

import * as React from "react"

import { CsvViewer } from "@/components/ui/csv-viewer"

const FIRST = ["Jane", "John", "Amara", "Liu", "Diego", "Sofia", "Noah", "Mia"]
const LAST = [
  "Doe",
  "Smith",
  "Okafor",
  "Wei",
  "Garcia",
  "Rossi",
  "Kim",
  "Patel",
]
const COUNTRY = ["US", "GB", "FR", "DE", "BR", "JP", "NG", "IN"]
const EXTRA_COLS = 40

function buildCsv(rows: number): string {
  const header = [
    "id",
    "first_name",
    "last_name",
    "email",
    "country",
    "amount",
    ...Array.from({ length: EXTRA_COLS }, (_, i) => `metric_${i + 1}`),
  ]
  const lines = [header.join(",")]
  for (let i = 0; i < rows; i++) {
    const first = FIRST[i % FIRST.length]
    const last = LAST[(i * 3) % LAST.length]
    const country = COUNTRY[(i * 7) % COUNTRY.length]
    const amount = (((i * 37) % 10000) / 100).toFixed(2)
    const metrics = Array.from({ length: EXTRA_COLS }, (_, c) =>
      (((i * 31 + c * 17) % 100000) / 100).toFixed(2)
    )
    lines.push(
      [
        i + 1,
        first,
        last,
        `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
        country,
        amount,
        ...metrics,
      ].join(",")
    )
  }
  return lines.join("\n")
}

export function CsvViewerDemo() {
  const csv = React.useMemo(() => buildCsv(5000), [])
  return (
    <div>
      <CsvViewer
        source={{ kind: "text", text: csv, fileName: "people.csv" }}
        height={420}
        isolateStyles
      />
    </div>
  )
}

export function CsvViewerStreamingDemo() {
  // A large source streamed off the main thread. Built once as a Blob so the
  // 20 MB+ string is never re-materialized during render.
  const source = React.useMemo(
    () => new Blob([buildCsv(100_000)], { type: "text/csv" }),
    []
  )
  return (
    <div>
      <CsvViewer
        source={{
          kind: "blob",
          blob: source,
          identityKey: "csv-demo:100000-people",
          fileName: "people.csv",
          mimeType: "text/csv",
        }}
        height={420}
        isolateStyles
      />
    </div>
  )
}
