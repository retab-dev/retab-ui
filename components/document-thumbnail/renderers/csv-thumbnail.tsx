"use client"

import * as React from "react"

import { getText } from "@/components/document-thumbnail/cache"
import { GridTable } from "@/components/document-thumbnail/renderers/layout"

export function CsvFirstRows({
  src,
  resourceKey,
}: {
  src: string
  resourceKey: string
}) {
  const raw = React.use(getText(src, resourceKey))
  const rows = React.useMemo(
    () =>
      raw
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .slice(0, 16)
        .map((line) => line.split(",").slice(0, 6)),
    [raw]
  )
  return <GridTable rows={rows} headerRow />
}
