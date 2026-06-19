import * as React from "react";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` has
 * elapsed without a change. Useful for search inputs, autosave, and any effect
 * that should not fire on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  useKeyedMountEffect(joinEffectKey([value, delayMs]), () => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  });

  return debounced;
}

/**
 * Like `useDebouncedValue`, but returns a stable callback whose invocation is
 * debounced. The latest arguments win when the timer finally fires.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs = 300,
): (...args: Args) => void {
  const callbackRef = React.useRef(callback);
  callbackRef.current = callback;

  const timerRef = React.useRef<number | null>(null);

  return React.useCallback(
    (...args: Args) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}
