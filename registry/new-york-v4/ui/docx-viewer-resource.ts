import { type ViewerResource } from "@/lib/viewer-resource"

const bufferCache = new Map<string, Promise<ArrayBuffer>>()

export function getDocxResource(
  resource: ViewerResource,
  options: { retainRejected?: boolean } = {}
): Promise<ArrayBuffer> {
  const resourceKey = resource.keys.load
  const cached = bufferCache.get(resourceKey)
  if (cached) return cached

  const promise = resource.readArrayBuffer().catch((error) => {
    if (!options.retainRejected && bufferCache.get(resourceKey) === promise)
      bufferCache.delete(resourceKey)
    throw error
  })
  bufferCache.set(resourceKey, promise)
  return promise
}

export function clearDocxResource(resource: ViewerResource) {
  bufferCache.delete(resource.keys.load)
}

export function __resetDocxResourceCacheForTests() {
  bufferCache.clear()
}
