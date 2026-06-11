export const RESOURCE_CACHE_MAX = 12

export interface SharedAbortableRequest<T> {
  controller: AbortController
  promise: Promise<T>
  subscriberPromises: WeakMap<AbortSignal, Promise<T>>
  subscribers: Set<AbortSignal>
  settled: boolean
}

export function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError")
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

export function lruGet<K, V>(map: Map<K, V>, key: K): V | undefined {
  const v = map.get(key)
  if (v !== undefined) {
    map.delete(key)
    map.set(key, v)
  }
  return v
}

export function lruSet<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  onEvict?: (key: K, value: V) => void,
  max = RESOURCE_CACHE_MAX
) {
  map.delete(key)
  map.set(key, value)
  while (map.size > max) {
    const oldest = map.keys().next().value as K
    const dropped = map.get(oldest) as V
    map.delete(oldest)
    onEvict?.(oldest, dropped)
  }
}

export function cachedPromise<K, V>(
  map: Map<K, Promise<V>>,
  key: K,
  create: () => Promise<V>,
  {
    max = RESOURCE_CACHE_MAX,
    onEvict,
    onReject,
  }: {
    max?: number
    onEvict?: (key: K, value: Promise<V>) => void
    onReject?: (key: K, error: unknown) => void
  } = {}
): Promise<V> {
  let promise = lruGet(map, key)
  if (!promise) {
    promise = create().catch((error: unknown) => {
      map.delete(key)
      onReject?.(key, error)
      throw error
    })
    lruSet(map, key, promise, onEvict, max)
  }
  return promise
}

export function subscribeToAbortableRequest<T>(
  entry: SharedAbortableRequest<T>,
  signal: AbortSignal,
  onNoSubscribers: () => void
): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError())

  const existingPromise = entry.subscriberPromises.get(signal)
  if (existingPromise) return existingPromise

  entry.subscribers.add(signal)

  const promise = new Promise<T>((resolve, reject) => {
    let done = false

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort)
      entry.subscribers.delete(signal)
    }

    const onAbort = () => {
      if (done) return
      done = true
      cleanup()
      if (!entry.settled && entry.subscribers.size === 0) {
        entry.controller.abort()
        onNoSubscribers()
      }
      reject(abortError())
    }

    signal.addEventListener("abort", onAbort, { once: true })

    entry.promise.then(
      (value) => {
        if (done) return
        done = true
        cleanup()
        resolve(value)
      },
      (error: unknown) => {
        if (done) return
        done = true
        cleanup()
        reject(error)
      }
    )
  })

  entry.subscriberPromises.set(signal, promise)
  return promise
}
