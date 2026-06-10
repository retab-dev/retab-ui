// Minimal stand-in for the dashboard Extraction type (purify later).

export interface ExtractionConsensus {
  choices: Record<string, unknown>[]
  likelihoods?: Record<string, unknown> | null
}

export interface Extraction {
  id: string
  file?: { id: string; filename?: string; mime_type?: string }
  model?: string
  json_schema?: Record<string, unknown>
  output?: Record<string, unknown>
  status?: string
  consensus?: ExtractionConsensus | null
  created_at?: string | null
  [key: string]: unknown
}
