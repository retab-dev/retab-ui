// Classification result + input shapes for the classifier viewer.

export type ClassifierInputType = "file" | "text" | "json"

export interface ClassifierResultViewerInput {
  type: ClassifierInputType
  fileBuffer: ArrayBuffer | null
  fileName: string | null
  fileMimeType: string
  textValue: string
}

/** Decision shape accepted by the viewer — works with new and legacy types. */
export interface ClassifyResult {
  category: string
  reasoning?: string
}
