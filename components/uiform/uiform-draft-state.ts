export function resolveDraftValue<T>(
  committedValue: T,
  draftValue: T | undefined,
  isDraftActive: boolean,
): T {
  if (!isDraftActive) {
    return committedValue;
  }

  return draftValue ?? committedValue;
}

export function resolveTimeInputValue(
  committedValue: string,
  draftValue: string,
  isEditingTime: boolean,
): string {
  return isEditingTime ? draftValue : committedValue;
}
