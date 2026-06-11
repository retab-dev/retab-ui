import * as React from "react"

import {
  padRowsToColumnCount,
  parseCsv,
  streamCsv,
  type CsvDialect,
  type CsvStreamSource,
  type CsvTable,
} from "@/lib/csv"

import { parseCsvInWorker } from "./csv-viewer-worker"

export interface CsvCellAddress {
  rowIndex: number
  columnIndex: number
}

export interface LegacyCsvCellAddress {
  row: number
  col: number
}

export type CsvViewerError =
  | { kind: "fetch"; status?: number }
  | { kind: "decode" }
  | { kind: "worker" }
  | { kind: "aborted" }
  | { kind: "unknown"; message?: string }

export type CsvResourceState =
  | { status: "idle"; columns: string[]; rows: string[][] }
  | { status: "loading"; columns: string[]; rows: string[][] }
  | { status: "ready"; columns: string[]; rows: string[][] }
  | { status: "empty"; columns: string[]; rows: string[][] }
  | {
      status: "error"
      columns: string[]
      rows: string[][]
      error: CsvViewerError
    }

export function normalizeCellAddress(
  cell: CsvCellAddress | LegacyCsvCellAddress | null | undefined
): CsvCellAddress | null {
  if (!cell) return null
  if ("rowIndex" in cell) return cell
  return { rowIndex: cell.row, columnIndex: cell.col }
}

export function getCsvErrorMessage(error: CsvViewerError): string {
  if (error.kind === "fetch") {
    return error.status
      ? `Failed to load file: ${error.status}`
      : "Couldn't load this file."
  }
  if (error.kind === "decode") return "Couldn't decode this file."
  if (error.kind === "worker") return "Couldn't parse this file."
  if (error.kind === "aborted") return "Loading was cancelled."
  return error.message || "Couldn't load this file."
}

export function unknownToCsvError(error: unknown): CsvViewerError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { kind: "aborted" }
  }
  if (error instanceof Error) return { kind: "unknown", message: error.message }
  return { kind: "unknown", message: String(error) }
}

export function readyCsvState(
  columns: string[],
  rows: string[][]
): CsvResourceState {
  return rows.length === 0
    ? { status: "empty", columns, rows }
    : { status: "ready", columns, rows }
}

export function useCsvResourceState({
  src,
  value,
  source,
  data,
  dialect,
  worker,
  batchSize,
}: {
  src?: string
  value?: string
  source?: Blob | string
  data?: CsvTable
  dialect: CsvDialect
  worker: boolean
  batchSize: number
}): CsvResourceState {
  const syncState = React.useMemo<CsvResourceState | null>(() => {
    if (src || source) return null
    if (data) return readyCsvState(data.columns, data.rows)
    if (value != null) {
      const table = parseCsv(value, dialect)
      return readyCsvState(table.columns, table.rows)
    }
    return { status: "idle", columns: [], rows: [] }
  }, [data, dialect, source, src, value])

  const [state, setState] = React.useState<CsvResourceState>({
    status: "idle",
    columns: [],
    rows: [],
  })

  React.useEffect(() => {
    if (!src && !source) return

    const controller = new AbortController()
    const rows: string[][] = []
    let columns: string[] = []
    let cancelled = false
    setState({ status: "loading", columns: [], rows: [] })

    const onColumns = (next: string[]) => {
      if (cancelled) return
      columns = next
      padRowsToColumnCount(rows, columns.length)
      setState({ status: "loading", columns, rows: rows.slice() })
    }

    const onRows = (batch: string[][]) => {
      if (cancelled) return
      rows.push(...batch)
      setState({ status: "loading", columns, rows: rows.slice() })
    }

    const onDone = () => {
      if (cancelled) return
      setState(readyCsvState(columns, rows.slice()))
    }

    const onError = (error: unknown) => {
      if (cancelled || controller.signal.aborted) return
      setState({
        status: "error",
        columns,
        rows: rows.slice(),
        error: unknownToCsvError(error),
      })
    }

    const runMainThread = (input: CsvStreamSource) => {
      void streamCsv(
        input,
        { onColumns, onRows, onDone, onError },
        {
          delimiter: dialect.delimiter,
          hasHeader: dialect.hasHeader,
          batchSize,
          signal: controller.signal,
        }
      )
    }

    const runSrc = async () => {
      if (!src) return
      try {
        const response = await fetch(src, { signal: controller.signal })
        if (!response.ok) {
          setState({
            status: "error",
            columns,
            rows: rows.slice(),
            error: { kind: "fetch", status: response.status },
          })
          return
        }
        if (response.body) runMainThread(response.body)
        else runMainThread(await response.blob())
      } catch (error) {
        onError(error)
      }
    }

    if (src) {
      void runSrc()
    } else if (source && worker && typeof Worker !== "undefined") {
      void parseCsvInWorker({
        source,
        dialect,
        batchSize,
        onColumns,
        onRows,
        signal: controller.signal,
      }).then(onDone, (error) => {
        if (error instanceof Error && error.message === "worker-unavailable") {
          runMainThread(source)
        } else {
          onError(error)
        }
      })
    } else if (source) {
      runMainThread(source)
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [batchSize, dialect, source, src, worker])

  return syncState ?? state
}
