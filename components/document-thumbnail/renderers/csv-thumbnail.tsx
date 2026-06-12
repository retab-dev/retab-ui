"use client"

import * as React from "react"

import { inferCsvDialect, parseCsv } from "@/lib/csv"
import type { ViewerResource } from "@/lib/viewer-resource"
import {
  CSV_THUMBNAIL_MAX_COLUMNS,
  CSV_THUMBNAIL_MAX_ROWS,
  getThumbnailText,
  useThumbnailResource,
} from "@/components/document-thumbnail/cache"
import { GridTable } from "@/components/document-thumbnail/renderers/layout"

export function CsvFirstRows({
  resource,
  cacheKey,
}: {
  resource: ViewerResource
  cacheKey: string
}) {
  const raw = useThumbnailResource(getThumbnailText(resource, cacheKey))
  const rows = React.useMemo(() => {
    const dialect = inferCsvDialect({
      fileName: resource.fileName,
      mimeType: resource.mimeType,
    })
    const table = parseCsv(raw, dialect)
    const header = table.columns.length
      ? [table.columns.slice(0, CSV_THUMBNAIL_MAX_COLUMNS)]
      : []
    return header.concat(
      table.rows
        .slice(0, CSV_THUMBNAIL_MAX_ROWS - header.length)
        .map((row) => row.slice(0, CSV_THUMBNAIL_MAX_COLUMNS))
    )
  }, [raw, resource.fileName, resource.mimeType])
  return <GridTable rows={rows} headerRow />
}
