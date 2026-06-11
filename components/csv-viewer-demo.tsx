"use client"

import * as React from "react"

import { CsvViewer } from "@/components/ui/csv-viewer"

const FIRST = ["Jane", "John", "Amara", "Liu", "Diego", "Sofia", "Noah", "Mia"]
const LAST = ["Doe", "Smith", "Okafor", "Wei", "Garcia", "Rossi", "Kim", "Patel"]
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
      <CsvViewer
        value={csv}
        height={420}
        virtualized={virtualized}
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
  const [useWorker, setUseWorker] = React.useState(true)
  // Remount on toggle so the stream restarts with the chosen strategy.
  const key = useWorker ? "worker" : "main"
  return (
    <div className="not-prose my-6 flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={useWorker}
          onChange={(e) => setUseWorker(e.target.checked)}
          className="size-4 accent-primary"
        />
        Parse in a Web Worker (100,000 rows × {6 + EXTRA_COLS} columns,{" "}
        {useWorker ? "off-thread" : "time-sliced main thread"})
      </label>
      <CsvViewer
        key={key}
        source={source}
        worker={useWorker}
        height={420}
        isolateStyles
      />
    </div>
  )
}
