"use client"

import type { DataCellNumberControlProps } from "@/registry/new-york-v4/ui/data-cell-control-contract"
import { DataCellInputControl } from "@/registry/new-york-v4/ui/data-cell-text-control"

export function DataCellNumberControl(props: DataCellNumberControlProps) {
  return <DataCellInputControl {...props} />
}
