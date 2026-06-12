export interface CsvDialect {
  delimiter: string
  hasHeader: boolean
}

export interface CsvDialectDescriptor {
  src?: string
  fileName?: string
  mimeType?: string
}

export const DEFAULT_CSV_DIALECT: CsvDialect = {
  delimiter: ",",
  hasHeader: true,
}

export function normalizeCsvDelimiter(
  delimiter: string | undefined
): string | undefined {
  return delimiter === "\\t" ? "\t" : delimiter
}

export function extensionOfDelimitedName(name: string): string | null {
  const clean = name.split(/[?#]/)[0]
  const base = clean.split("/").pop() ?? clean
  const dot = base.lastIndexOf(".")
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : null
}

export function inferCsvDialect({
  src,
  fileName,
  mimeType,
}: CsvDialectDescriptor): CsvDialect {
  const name = fileName ?? src ?? ""
  const ext = extensionOfDelimitedName(name)
  if (ext === "tsv") return { delimiter: "\t", hasHeader: true }
  if (ext === "csv") return DEFAULT_CSV_DIALECT

  const normalizedMime = mimeType?.toLowerCase().split(";")[0].trim()
  if (normalizedMime === "text/tab-separated-values") {
    return { delimiter: "\t", hasHeader: true }
  }
  return DEFAULT_CSV_DIALECT
}

export function resolveCsvDialect({
  dialect,
  delimiter,
  hasHeader,
  descriptor,
}: {
  dialect?: CsvDialect
  delimiter?: string
  hasHeader?: boolean
  descriptor: CsvDialectDescriptor
}): CsvDialect {
  const inferred = dialect ?? inferCsvDialect(descriptor)
  return {
    delimiter:
      normalizeCsvDelimiter(delimiter) ??
      normalizeCsvDelimiter(inferred.delimiter) ??
      inferred.delimiter,
    hasHeader: hasHeader ?? inferred.hasHeader,
  }
}

export function isTabDelimited(dialect: CsvDialect): boolean {
  return normalizeCsvDelimiter(dialect.delimiter) === "\t"
}
