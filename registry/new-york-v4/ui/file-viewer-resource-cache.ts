export const RESOURCE_CACHE_MAX = 12

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
