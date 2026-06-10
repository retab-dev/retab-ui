// Parse result shape consumed by the parse viewer.

export interface ParseResponse {
  document?: { id?: string; mime_type?: string } | null
  output?: { pages: string[]; text: string } | null
  usage?: { credits: number } | null
}

export type ParseViewMode = "text" | "rendered" | "file"
