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
} from "@/lib/viewer-errors"

import {
  resolveCsvResource,
  type CsvResource,
  type CsvResourceInput,
} from "./csv-viewer-resource"
import {
  CsvWorkerUnavailableError,
  parseCsvInWorker,
  toCsvFormatError,
} from "./csv-viewer-worker"
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
  const content = resource?.content ?? null
  const { delimiter, hasHeader } = dialect
  const csvDialect = React.useMemo(
    () => ({ delimiter, hasHeader }),
    [delimiter, hasHeader]
  )
  const tableSource = source?.kind === "table" ? source : null
  const csvResource = React.useMemo<CsvResource>(() => {
    if (tableSource) {
      return resolveCsvResource({ source: tableSource })
    }
    if (!content) {
      return { kind: "empty" }
    }
    if (content.payload.kind === "text") {
      return { kind: "text", text: content.payload.text }
    }
    return { kind: "resource", content }
  }, [tableSource, content])
  const syncState = React.useMemo<CsvResourceState | null>(() => {
    if (csvResource.kind === "table") {
      return readyCsvState(csvResource.table.columns, csvResource.table.rows)
    }
    if (csvResource.kind === "text") {
      const table = parseCsv(csvResource.text, csvDialect)
      return readyCsvState(table.columns, table.rows)
    }
    if (csvResource.kind === "empty") {
      return { status: "idle", columns: [], sourceRows: [] }
    }
    return null
  }, [csvResource, csvDialect])

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
        error: toCsvPreviewError(error),
      })
    }

    const runMainThread = (input: CsvStreamSource) => {
      void streamCsv(
        input,
        { onColumns, onRows: onSourceRows, onDone, onError },
        {
          delimiter: csvDialect.delimiter,
          hasHeader: csvDialect.hasHeader,
          batchSize: CSV_STREAM_BATCH_SIZE,
          signal: controller.signal,
        }
      )
    }

    const runResource = async () => {
      if (csvResource.kind !== "resource") return
      try {
        if (csvResource.content.payload.kind === "blob") {
          const { blob } = csvResource.content.payload
          if (typeof Worker !== "undefined") {
            void parseCsvInWorker({
              source: blob,
              dialect: csvDialect,
              batchSize: CSV_STREAM_BATCH_SIZE,
              onColumns,
              onSourceRows,
              signal: controller.signal,
            }).then(onDone, (error) => {
              if (error instanceof CsvWorkerUnavailableError) {
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

        runMainThread(
          await csvResource.content.readStream({
            signal: controller.signal,
          })
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
  }, [csvResource, csvDialect, retryVersion])

  return syncState ?? state
}

function toCsvPreviewError(error: unknown): Error {
  if (isResourceError(error)) return error
  if (isAbortError(error)) {
    return new ResourceError({
      kind: "aborted",
      message: "Loading was cancelled.",
      cause: error,
    })
  }
  return toCsvFormatError(error)
}
