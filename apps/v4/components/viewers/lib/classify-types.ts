// Classification result shape for the classifier viewer.

/** Decision shape accepted by the viewer — works with new and legacy types. */
export interface ClassifyResult {
  category: string
  reasoning?: string
}
