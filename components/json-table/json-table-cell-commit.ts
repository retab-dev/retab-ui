export type JsonTableCommitVisibility =
  | "primitivePendingValue"
  | "projectedDocumentValue"

// Describes which local state makes this commit visible before the parent
// document echo is reconciled.
export type JsonTableCellCommit = {
  fieldPath: string
  value: unknown
  previousValue: unknown
  visibility: JsonTableCommitVisibility
}

export type JsonTableCellCommitHandler = (commit: JsonTableCellCommit) => void

export function jsonTableCommittedTextValue(value: unknown) {
  return value !== null && value !== undefined ? String(value) : ""
}

export function isJsonTableNoOpCommit(
  previousValue: unknown,
  nextValue: unknown
) {
  return (
    previousValue === nextValue ||
    safeJsonTableCommitString(previousValue) ===
      safeJsonTableCommitString(nextValue)
  )
}

function safeJsonTableCommitString(value: unknown) {
  try {
    return JSON.stringify(normalizeJsonTableCommitValue(value))
  } catch {
    return String(normalizeJsonTableCommitValue(value))
  }
}

function normalizeJsonTableCommitValue(value: unknown) {
  return value == null || value === "" ? null : value
}
