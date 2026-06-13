"use client"

import {
  DataCellInputControl,
  type DataCellNumberControlProps,
} from "@/registry/new-york-v4/ui/data-cell-text-control"

const dataCellNumberKeyPattern = /^[0-9.+-]$/

export function canActivateDataCellNumberFromKey(
  kind: DataCellNumberControlProps["kind"],
  key: string
) {
  if (key === "Enter" || key === "F2") return true
  if (key.length !== 1) return false
  if (kind === "integer") return /^[+-]$|^\d$/.test(key)
  return dataCellNumberKeyPattern.test(key)
}

export function DataCellNumberControl(props: DataCellNumberControlProps) {
  return <DataCellInputControl {...props} />
}
