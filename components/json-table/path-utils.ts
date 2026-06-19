import { useCallback, useRef } from "react";

export function useRefCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: TArgs) => ref.current(...args), []);
}

export function cmp<T>(
  a: T,
  b: T,
  options?: {
    deep?: string[];
    shallow?: string[];
  },
  curKey: string = "",
): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a == null || b == null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (
    options?.shallow?.includes(curKey) ||
    (!options?.shallow?.length &&
      options?.deep?.length &&
      !options?.deep?.find((k) => k.startsWith(curKey)))
  ) {
    return Object.is(a, b);
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    const nextKey = curKey ? curKey + "." + key : key;
    if (!cmp(objA[key], objB[key], options, nextKey)) return false;
  }
  return true;
}
