import * as React from "react";

export function useStableOptionalCallback<Args extends unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined,
) {
  const callbackRef = React.useRef(callback);
  callbackRef.current = callback;

  return React.useCallback((...args: Args) => {
    return callbackRef.current?.(...args);
  }, []);
}
