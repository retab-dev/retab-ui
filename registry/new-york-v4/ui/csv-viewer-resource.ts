import type { CsvDialect, CsvTable } from "@/lib/csv"
import type { ViewerResource } from "@/lib/viewer-resource"
import type {
  BlobViewerSource,
  TextSource,
  UrlViewerSource,
} from "@/lib/viewer-source"

export type CsvResource =
  | { kind: "resource"; resource: ViewerResource }
  | { kind: "text"; text: string }
  | { kind: "table"; table: CsvTable; fileName?: string }
  | { kind: "empty" }

export type CsvDocumentSource = UrlViewerSource | BlobViewerSource | TextSource

export interface CsvTableSource {
  kind: "table"
  table: CsvTable
  fileName?: string
  identityKey?: string
  dialect?: CsvDialect
}

export type CsvViewerSource = CsvDocumentSource | CsvTableSource

export interface CsvResourceInput {
  source?: CsvViewerSource
  resource?: ViewerResource | null
}

export function isCsvDocumentSource(
  source: CsvViewerSource
): source is CsvDocumentSource {
  return source.kind !== "table"
}

export function resolveCsvResource({
  source,
  resource,
}: CsvResourceInput): CsvResource {
  if (source?.kind === "table") {
    return {
      kind: "table",
      table: source.table,
      fileName: source.fileName,
    }
  }
  if (resource) {
    if (resource.sourceKind === "text") {
      return { kind: "text", text: resource.source.text }
    }
    return { kind: "resource", resource }
  }
  return { kind: "empty" }
}
