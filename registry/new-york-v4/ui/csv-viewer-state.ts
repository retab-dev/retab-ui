import * as React from "react"

import {
  padRowsToColumnCount,
  parseCsv,
  streamCsv,
  type CsvDialect,
  type CsvStreamSource,
} from "@/lib/csv"

import {
  resolveCsvResource,
  type CsvResourceInput,
} from "./csv-viewer-resource"
import { parseCsvInWorker } from "./csv-viewer-worker"
import type { GridCellCoordinate } from "./fixed-grid-selection"

const CSV_STREAM_BATCH_SIZE = 5000

export type CsvCellAddress = GridCellCoordinate

export type CsvViewerError =
  | { kind: "fetch"; status?: number }
  | { kind: "decode" }
  | { kind: "worker" }
  | { kind: "aborted" }
  | { kind: "unknown"; message?: string }

export type CsvResourceState =
  | { status: "idle"; columns: string[]; sourceRows: string[][] }
  | { status: "loading"; columns: string[]; sourceRows: string[][] }
  | { status: "ready"; columns: string[]; sourceRows: string[][] }
  | { status: "empty"; columns: string[]; sourceRows: string[][] }
  | {
      status: "error"
      columns: string[]
      sourceRows: string[][]
      error: CsvViewerError
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
  sourceRows: string[][]
): CsvResourceState {
  return sourceRows.length === 0
    ? { status: "empty", columns, sourceRows }
    : { status: "ready", columns, sourceRows }
}

export function useCsvResourceState({
  src,
  value,
  source,
  data,
  dialect,
}: CsvResourceInput & {
  dialect: CsvDialect
}): CsvResourceState {
  const csvResource = React.useMemo(
    () => resolveCsvResource({ src, source, value, data }),
    [data, source, src, value]
  )
  const syncState = React.useMemo<CsvResourceState | null>(() => {
    if (csvResource.kind === "data") {
      return readyCsvState(
        csvResource.csvTable.columns,
        csvResource.csvTable.rows
      )
    }
    if (csvResource.kind === "value") {
      const table = parseCsv(csvResource.value, dialect)
      return readyCsvState(table.columns, table.rows)
    }
    if (csvResource.kind === "empty") {
      return { status: "idle", columns: [], sourceRows: [] }
    }
    return null
  }, [csvResource, dialect])

  const [state, setState] = React.useState<CsvResourceState>({
    status: "idle",
    columns: [],
    sourceRows: [],
  })

  React.useEffect(() => {
    if (csvResource.kind !== "src" && csvResource.kind !== "source") return

    const controller = new AbortController()
    const sourceRows: string[][] = []
    let columns: string[] = []
    let cancelled = false
    setState({ status: "loading", columns: [], sourceRows: [] })

    const onColumns = (next: string[]) => {
      if (cancelled) return
      columns = next
      padRowsToColumnCount(sourceRows, columns.length)
      setState({ status: "loading", columns, sourceRows: sourceRows.slice() })
    }

    const onSourceRows = (sourceRowBatch: string[][]) => {
      if (cancelled) return
      sourceRows.push(...sourceRowBatch)
      setState({ status: "loading", columns, sourceRows: sourceRows.slice() })
    }

    const onDone = () => {
      if (cancelled) return
      setState(readyCsvState(columns, sourceRows.slice()))
    }

    const onError = (error: unknown) => {
      if (cancelled || controller.signal.aborted) return
      setState({
        status: "error",
        columns,
        sourceRows: sourceRows.slice(),
        error: unknownToCsvError(error),
      })
    }

    const runMainThread = (input: CsvStreamSource) => {
      void streamCsv(
        input,
        { onColumns, onRows: onSourceRows, onDone, onError },
        {
          delimiter: dialect.delimiter,
          hasHeader: dialect.hasHeader,
          batchSize: CSV_STREAM_BATCH_SIZE,
          signal: controller.signal,
        }
      )
    }

    const runSrc = async () => {
      if (csvResource.kind !== "src") return
      try {
        const response = await fetch(csvResource.src, {
          signal: controller.signal,
        })
        if (!response.ok) {
          setState({
            status: "error",
            columns,
            sourceRows: sourceRows.slice(),
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

    if (csvResource.kind === "src") {
      void runSrc()
    } else if (typeof Worker !== "undefined") {
      void parseCsvInWorker({
        source: csvResource.source,
        dialect,
        batchSize: CSV_STREAM_BATCH_SIZE,
        onColumns,
        onSourceRows,
        signal: controller.signal,
      }).then(onDone, (error) => {
        if (error instanceof Error && error.message === "worker-unavailable") {
          runMainThread(csvResource.source)
        } else {
          onError(error)
        }
      })
    } else {
      runMainThread(csvResource.source)
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [csvResource, dialect])

  return syncState ?? state
}
