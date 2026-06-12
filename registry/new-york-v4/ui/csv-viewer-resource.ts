import type { CsvTable } from "@/lib/csv"

export type CsvResource =
  | { kind: "src"; src: string }
  | { kind: "source"; source: Blob }
  | { kind: "value"; value: string }
  | { kind: "data"; csvTable: CsvTable }
  | { kind: "empty" }

export interface CsvResourceInput {
  src?: string
  value?: string
  source?: Blob
  data?: CsvTable
}

export function resolveCsvResource({
  src,
  source,
  value,
  data,
}: CsvResourceInput): CsvResource {
  if (src) return { kind: "src", src }
  if (source) return { kind: "source", source }
  if (value != null) return { kind: "value", value }
  if (data) return { kind: "data", csvTable: data }
  return { kind: "empty" }
}
