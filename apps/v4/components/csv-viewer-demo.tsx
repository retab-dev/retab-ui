"use client"

import * as React from "react"

import { CsvViewer } from "@/components/ui/csv-viewer"

const FIRST = ["Jane", "John", "Amara", "Liu", "Diego", "Sofia", "Noah", "Mia"]
const LAST = ["Doe", "Smith", "Okafor", "Wei", "Garcia", "Rossi", "Kim", "Patel"]
const COUNTRY = ["US", "GB", "FR", "DE", "BR", "JP", "NG", "IN"]

// Wide + tall so both row and column virtualization are exercised.
const ROWS = 5000
const EXTRA_COLS = 40

function buildCsv(): string {
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
  for (let i = 0; i < ROWS; i++) {
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
  const csv = React.useMemo(() => buildCsv(), [])
  const [virtualized, setVirtualized] = React.useState(true)
  return (
    <div className="not-prose my-6 flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={virtualized}
          onChange={(e) => setVirtualized(e.target.checked)}
          className="size-4 accent-primary"
        />
        Virtualized ({"5,000"} rows × {6 + EXTRA_COLS} columns)
      </label>
      <CsvViewer value={csv} height={420} virtualized={virtualized} />
    </div>
  )
}
