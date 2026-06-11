// Edit (agent-edit) form-field shapes, mirrored from the Retab dashboard.

export interface BBox {
  left: number
  top: number
  width: number
  height: number
  /** 1-based page index. */
  page: number
}

export type EditFieldType = "text" | "checkbox"

export interface FormField {
  bbox: BBox
  description: string
  type: EditFieldType
  key: string
  value?: string | null
  combing?: boolean
  max_length?: number
}
