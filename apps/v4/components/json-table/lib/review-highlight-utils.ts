import type { HighlightedFieldInfo } from "@/components/json-table/lib/interfaces";

export const normalizeFieldPath = (fieldPath: string): string => {
  let normalized = fieldPath;

  if (normalized.startsWith("data.")) {
    normalized = normalized.slice(5);
  } else if (normalized.startsWith("likelihoods.")) {
    normalized = normalized.slice(12);
  }

  return normalized;
};

const normalizeFieldPathNotation = (fieldPath: string): string => {
  return normalizeFieldPath(fieldPath).replace(/\[(\d+)\]/g, ".$1");
};

const convertWildcardToFirstElement = (fieldPath: string): string => {
  return fieldPath.replace(/\.\*/g, ".0");
};

export const getNavigableHighlightedFieldPath = (fieldPath: string): string => {
  const normalizedPath = normalizeFieldPath(fieldPath);
  const withFirstElement = convertWildcardToFirstElement(normalizedPath);
  return withFirstElement.replace(/\[(\d+)\]/g, ".$1");
};

export const doesFieldPathMatchHighlightedField = (
  candidatePath: string,
  highlightedFieldPath: string,
): boolean => {
  const normalizedCandidatePath = normalizeFieldPathNotation(candidatePath);
  const normalizedHighlightedPath =
    normalizeFieldPathNotation(highlightedFieldPath);
  const regexPattern = normalizedHighlightedPath
    .replace(/\.\*/g, ".__WILDCARD__")
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/__WILDCARD__/g, "\\d+");

  return new RegExp(`^${regexPattern}$`).test(normalizedCandidatePath);
};

export const findMatchingHighlightedFieldPattern = (
  candidatePath: string,
  highlightedFieldPaths: Iterable<string>,
): string | null => {
  for (const highlightedFieldPath of highlightedFieldPaths) {
    if (
      doesFieldPathMatchHighlightedField(candidatePath, highlightedFieldPath)
    ) {
      return highlightedFieldPath;
    }
  }

  return null;
};

export const isFieldPathHighlighted = (
  candidatePath: string,
  highlightedFields: HighlightedFieldInfo[],
): boolean => {
  return (
    findMatchingHighlightedFieldPattern(
      candidatePath,
      highlightedFields.map(
        (highlightedField) => highlightedField.field_ref.path,
      ),
    ) !== null
  );
};

export const getInitialHighlightedFieldPath = (
  highlightedFields: HighlightedFieldInfo[],
): string | null => {
  const firstHighlightedField = highlightedFields[0]?.field_ref.path;
  if (!firstHighlightedField) return null;
  return getNavigableHighlightedFieldPath(firstHighlightedField);
};
