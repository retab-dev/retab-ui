import * as React from "react"

import {
  padRowsToColumnCount,
  parseCsv,
  streamCsv,
  type CsvDialect,
  type CsvStreamSource,
} from "@/lib/csv"
import {
  isAbortError,
  isResourceError,
  ResourceError,
  ViewerFormatError,
} from "@/lib/viewer-errors"

import {
  resolveCsvResource,
  type CsvResourceInput,
} from "./csv-viewer-resource"
import { parseCsvInWorker } from "./csv-viewer-worker"
import type { GridCellCoordinate } from "./fixed-grid-selection"

const CSV_STREAM_BATCH_SIZE = 5000

export type CsvCellAddress = GridCellCoordinate

export type CsvResourceState =
  | { status: "idle"; columns: string[]; sourceRows: string[][] }
  | { status: "loading"; columns: string[]; sourceRows: string[][] }
  | { status: "ready"; columns: string[]; sourceRows: string[][] }
  | { status: "empty"; columns: string[]; sourceRows: string[][] }
  | {
      status: "error"
      columns: string[]
      sourceRows: string[][]
      error: unknown
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
  source,
  resource,
  dialect,
  retryVersion = 0,
}: CsvResourceInput & {
  dialect: CsvDialect
  retryVersion?: number
}): CsvResourceState {
  const csvResource = React.useMemo(
    () => resolveCsvResource({ source, resource }),
    [source, resource]
  )
  const syncState = React.useMemo<CsvResourceState | null>(() => {
    if (csvResource.kind === "table") {
      return readyCsvState(csvResource.table.columns, csvResource.table.rows)
    }
    if (csvResource.kind === "text") {
      const table = parseCsv(csvResource.text, dialect)
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
    if (csvResource.kind !== "resource") return

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
        error: normalizeCsvError(error),
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

    const runResource = async () => {
      if (csvResource.kind !== "resource") return
      try {
        if (csvResource.resource.sourceKind === "blob") {
          const blob = csvResource.resource.source.blob
          if (typeof Worker !== "undefined") {
            void parseCsvInWorker({
              source: blob,
              dialect,
              batchSize: CSV_STREAM_BATCH_SIZE,
              onColumns,
              onSourceRows,
              signal: controller.signal,
            }).then(onDone, (error) => {
              if (
                error instanceof Error &&
                error.message === "worker-unavailable"
              ) {
                runMainThread(blob)
              } else {
                onError(error)
              }
            })
            return
          }

          runMainThread(blob)
          return
        }

        if (csvResource.resource.stream) {
          runMainThread(
            await csvResource.resource.stream({
              signal: controller.signal,
            })
          )
          return
        }

        runMainThread(
          await csvResource.resource.readBlob({ signal: controller.signal })
        )
      } catch (error) {
        onError(error)
      }
    }

    void runResource()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [csvResource, dialect, retryVersion])

  return syncState ?? state
}

function normalizeCsvError(error: unknown) {
  if (isResourceError(error)) return error
  if (isAbortError(error)) {
    return new ResourceError({
      kind: "aborted",
      message: "Loading was cancelled.",
      cause: error,
    })
  }
  return new ViewerFormatError({
    format: "csv",
    kind: "parse_failed",
    message: "Failed to parse CSV.",
    cause: error,
  })
}
