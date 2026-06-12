import type { BBox } from "@/components/viewers/lib/edit-types"

import type {
  EditViewerDocument,
  EditViewerField,
  EditViewerInputField,
  EditViewerInputResult,
  EditViewerMode,
  EditViewerOptions,
  EditViewerResult,
} from "./edit-viewer-types"

export type EditViewerFilter =
  | "all"
  | "filled"
  | "empty"
  | "text"
  | "checkbox"
  | "no_location"

export interface EditViewerModeInput {
  fields: readonly EditViewerField[]
  sourceDocument?: EditViewerDocument | null
  filledDocument?: EditViewerDocument | null
  options: Required<EditViewerOptions>
}

const DEFAULT_OPTIONS: Required<EditViewerOptions> = {
  fieldPanel: true,
  search: true,
  filters: true,
  preview: true,
  filledOutput: true,
}

const MODE_FALLBACK_ORDER: EditViewerMode[] = ["filled", "preview", "source"]

const MODE_DISPLAY_ORDER: EditViewerMode[] = ["source", "preview", "filled"]

export function resolveEditViewerOptions(
  options: EditViewerOptions | undefined
): Required<EditViewerOptions> {
  return { ...DEFAULT_OPTIONS, ...options }
}

export function normalizeEditViewerResult(
  result: EditViewerInputResult | null | undefined
): EditViewerResult {
  const fields = result?.fields ?? []
  return {
    fields: fields.map(normalizeEditViewerField),
    editType: result?.editType,
  }
}

function normalizeEditViewerField(
  field: EditViewerInputField,
  index: number
): EditViewerField {
  const key = field.key || `field_${index}`
  return {
    key,
    description: field.description || key || `Field ${index + 1}`,
    type: field.type === "checkbox" ? "checkbox" : "text",
    value: normalizeFieldValue(field.value),
    bbox: field.bbox ? normalizeBBox(field.bbox) : undefined,
    combing: field.combing,
    maxLength: normalizeMaxLength(field),
  }
}

function normalizeFieldValue(value: string | boolean | null | undefined) {
  if (typeof value === "boolean") return value
  if (value === null || value === undefined) return null
  return String(value)
}

function normalizeMaxLength(field: EditViewerInputField) {
  if ("maxLength" in field && typeof field.maxLength === "number") {
    return field.maxLength
  }
  if ("max_length" in field && typeof field.max_length === "number") {
    return field.max_length
  }
  return undefined
}

function normalizeBBox(bbox: BBox): BBox | undefined {
  const page = Number(bbox.page)
  const left = Number(bbox.left)
  const top = Number(bbox.top)
  const width = Number(bbox.width)
  const height = Number(bbox.height)

  if (
    !Number.isFinite(page) ||
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    page < 1 ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined
  }

  const normalizedLeft = clamp01(left)
  const normalizedTop = clamp01(top)
  const normalizedWidth = Math.min(clamp01(width), 1 - normalizedLeft)
  const normalizedHeight = Math.min(clamp01(height), 1 - normalizedTop)

  if (normalizedWidth <= 0 || normalizedHeight <= 0) return undefined

  return {
    page: Math.round(page),
    left: normalizedLeft,
    top: normalizedTop,
    width: normalizedWidth,
    height: normalizedHeight,
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function isEditFieldChecked(field: EditViewerField) {
  if (typeof field.value === "boolean") return field.value
  if (typeof field.value !== "string") return false
  const value = field.value.trim().toLowerCase()
  return (
    value === "true" || value === "checked" || value === "yes" || value === "1"
  )
}

export function isEditFieldFilled(field: EditViewerField) {
  if (field.type === "checkbox") return isEditFieldChecked(field)
  return Boolean(
    typeof field.value === "string"
      ? field.value.trim().length > 0
      : field.value !== null && field.value !== undefined
  )
}

export function displayEditFieldValue(field: EditViewerField): string {
  if (field.type === "checkbox") {
    return isEditFieldChecked(field) ? "Checked" : "Unchecked"
  }
  if (field.value === null || field.value === undefined) return ""
  return String(field.value).trim()
}

export function deriveEditViewerModes(input: EditViewerModeInput) {
  const hasLocatedFields = input.fields.some((field) => Boolean(field.bbox))
  const hasSource = Boolean(input.sourceDocument)
  const filledOutputAvailable = Boolean(input.filledDocument)
  const modes: EditViewerMode[] = []

  if (hasSource) {
    modes.push("source")
  }

  if (
    input.options.preview &&
    hasSource &&
    hasLocatedFields &&
    input.sourceDocument &&
    canPreviewEditViewerDocument(input.sourceDocument)
  ) {
    modes.push("preview")
  }

  if (input.options.filledOutput && filledOutputAvailable) {
    modes.push("filled")
  }

  return sortModes(modes)
}

function sortModes(modes: EditViewerMode[]) {
  const rank = new Map(MODE_DISPLAY_ORDER.map((mode, index) => [mode, index]))
  return Array.from(new Set(modes)).sort(
    (a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99)
  )
}

export function resolveEditViewerMode({
  availableModes,
  requestedMode,
  currentMode,
}: {
  availableModes: readonly EditViewerMode[]
  requestedMode?: EditViewerMode | null
  currentMode?: EditViewerMode | null
}): EditViewerMode | null {
  if (requestedMode && availableModes.includes(requestedMode)) {
    return requestedMode
  }
  if (currentMode && availableModes.includes(currentMode)) {
    return currentMode
  }
  return (
    MODE_FALLBACK_ORDER.find((mode) => availableModes.includes(mode)) ?? null
  )
}

export function filterEditViewerFields({
  fields,
  query,
  filter,
}: {
  fields: readonly EditViewerField[]
  query?: string
  filter?: EditViewerFilter
}) {
  const normalizedQuery = (query ?? "").trim().toLowerCase()
  const resolvedFilter = filter ?? "all"

  return fields.filter((field) => {
    if (resolvedFilter === "filled" && !isEditFieldFilled(field)) return false
    if (resolvedFilter === "empty" && isEditFieldFilled(field)) return false
    if (resolvedFilter === "text" && field.type !== "text") return false
    if (resolvedFilter === "checkbox" && field.type !== "checkbox") {
      return false
    }
    if (resolvedFilter === "no_location" && field.bbox) return false
    if (!normalizedQuery) return true
    return (
      field.key.toLowerCase().includes(normalizedQuery) ||
      (field.description ?? "").toLowerCase().includes(normalizedQuery) ||
      displayEditFieldValue(field).toLowerCase().includes(normalizedQuery)
    )
  })
}

export interface EditViewerFieldGroup {
  key: string
  label: string
  page: number | null
  fields: EditViewerField[]
}

export function groupEditViewerFieldsByPage(
  fields: readonly EditViewerField[]
): EditViewerFieldGroup[] {
  const pageGroups = groupLocatedEditViewerFieldsByPage(fields)
  const unlocatedFields: EditViewerField[] = []

  for (const field of fields) {
    if (!field.bbox) {
      unlocatedFields.push(field)
    }
  }

  const groups: EditViewerFieldGroup[] = Array.from(pageGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([page, pageFields]) => ({
      key: `page:${page}`,
      label: `Page ${page}`,
      page,
      fields: pageFields,
    }))

  if (unlocatedFields.length > 0) {
    groups.push({
      key: "no-location",
      label: "No location",
      page: null,
      fields: unlocatedFields,
    })
  }

  return groups
}

export function groupLocatedEditViewerFieldsByPage(
  fields: readonly EditViewerField[]
): Map<number, EditViewerField[]> {
  const pageGroups = new Map<number, EditViewerField[]>()

  for (const field of fields) {
    if (!field.bbox) continue
    const pageFields = pageGroups.get(field.bbox.page) ?? []
    pageFields.push(field)
    pageGroups.set(field.bbox.page, pageFields)
  }

  return pageGroups
}

export function canPreviewEditViewerDocument(document: EditViewerDocument) {
  const filename = document.filename ?? ""
  return (
    document.mimeType.toLowerCase().includes("application/pdf") ||
    filename.toLowerCase().endsWith(".pdf")
  )
}
