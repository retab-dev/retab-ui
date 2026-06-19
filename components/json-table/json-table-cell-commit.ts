export type JsonTableCommitVisibleThrough =
  | "primitivePendingValue"
  | "projectedDocumentValue";

// Final commit-lifecycle vocabulary: this names the local value owner that keeps
// the committed value visible until the parent document echo is reconciled.
export type JsonTableCellCommit = {
  fieldPath: string;
  value: unknown;
  previousValue: unknown;
  visibleThrough: JsonTableCommitVisibleThrough;
};

export type JsonTableCellCommitHandler = (commit: JsonTableCellCommit) => void;

export function isJsonTableNoOpCommit(
  previousValue: unknown,
  nextValue: unknown,
) {
  return areJsonTableCommitValuesEqual(
    normalizeJsonTableCommitValue(previousValue),
    normalizeJsonTableCommitValue(nextValue),
  );
}

function normalizeJsonTableCommitValue(value: unknown) {
  return value == null || value === "" ? null : value;
}

function areJsonTableCommitValuesEqual(
  previousValue: unknown,
  nextValue: unknown,
): boolean {
  if (Object.is(previousValue, nextValue)) return true;
  if (
    typeof previousValue !== "object" ||
    typeof nextValue !== "object" ||
    previousValue === null ||
    nextValue === null
  ) {
    return false;
  }
  if (Array.isArray(previousValue) || Array.isArray(nextValue)) {
    if (!Array.isArray(previousValue) || !Array.isArray(nextValue))
      return false;
    if (previousValue.length !== nextValue.length) return false;
    return previousValue.every((item, index) =>
      areJsonTableCommitValuesEqual(item, nextValue[index]),
    );
  }
  if (
    Object.getPrototypeOf(previousValue) !== Object.prototype ||
    Object.getPrototypeOf(nextValue) !== Object.prototype
  ) {
    return false;
  }

  const previousRecord = previousValue as Record<string, unknown>;
  const nextRecord = nextValue as Record<string, unknown>;
  const previousKeys = Object.keys(previousRecord);
  if (previousKeys.length !== Object.keys(nextRecord).length) return false;

  return previousKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(nextRecord, key) &&
      areJsonTableCommitValuesEqual(previousRecord[key], nextRecord[key]),
  );
}
