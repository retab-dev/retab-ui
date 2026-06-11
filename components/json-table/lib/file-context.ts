// Minimal stand-in for the dashboard's file context types (purify later).

export interface FileContent {
  file: File
  buffer: ArrayBuffer
  unprocessed?: boolean
}

export interface FileData extends FileContent {
  id: string
}
