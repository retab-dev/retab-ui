import type { BBox } from "@/components/viewers/lib/edit-types"

export type EditViewerMode = "source" | "preview" | "filled"

export type EditViewerStatus =
  | { state: "idle" }
  | { state: "detecting"; message?: string }
  | { state: "filling"; message?: string }
  | { state: "error"; message: string }

export interface EditViewerOptions {
  fieldPanel?: boolean
  search?: boolean
  filters?: boolean
  preview?: boolean
  filledOutput?: boolean
}

export interface EditViewerField {
  key: string
  description?: string
  type: "text" | "checkbox"
  value?: string | boolean | null
  bbox?: BBox
  combing?: boolean
  maxLength?: number
}

export interface EditViewerResult {
  fields: EditViewerField[]
  editType?: "agent" | "template"
}

export interface EditViewerInputField {
  key?: string
  description?: string
  type?: "text" | "checkbox"
  value?: string | boolean | null
  bbox?: BBox
  combing?: boolean
  maxLength?: number
  max_length?: number
}

export interface EditViewerInputResult {
  fields?: readonly EditViewerInputField[] | null
  editType?: "agent" | "template"
}

export interface EditViewerDocument {
  buffer?: ArrayBuffer | null
  src?: string | null
  mimeType: string
  filename?: string
}

export interface EditViewerProps {
  result: EditViewerInputResult | null
  sourceDocument?: EditViewerDocument | null
  filledDocument?: EditViewerDocument | null
  mode?: EditViewerMode
  onModeChange?: (mode: EditViewerMode) => void
  selectedFieldKey?: string | null
  onSelectedFieldKeyChange?: (key: string | null) => void
  status?: EditViewerStatus
  className?: string
  options?: EditViewerOptions
}
