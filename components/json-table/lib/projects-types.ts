export type JsonTableDocumentData = Record<string, unknown>

export interface TableDocument {
  id: string
  data: JsonTableDocumentData
}
