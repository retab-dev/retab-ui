import * as React from "react"

export function useStableOptionalCallback<Args extends unknown[], Result>(
  callback: ((...args: Args) => Result) | undefined
) {
  const callbackRef = React.useRef(callback)

  React.useLayoutEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return React.useCallback((...args: Args) => {
    return callbackRef.current?.(...args)
  }, [])
}
