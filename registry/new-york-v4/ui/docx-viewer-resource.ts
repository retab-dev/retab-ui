import type {
  ViewerContentBytes,
  ViewerContentIdentity,
} from "@/lib/viewer-resource"

const bufferCache = new Map<string, Promise<ArrayBuffer>>()

export function getDocxResource(
  content: ViewerContentBytes,
  options: { retainRejected?: boolean } = {}
): Promise<ArrayBuffer> {
  const loadKey = content.key
  const cached = bufferCache.get(loadKey)
  if (cached) return cached

  const promise = readDocxBytes(content).catch((error) => {
    if (!options.retainRejected && bufferCache.get(loadKey) === promise)
      bufferCache.delete(loadKey)
    throw error
  })
  bufferCache.set(loadKey, promise)
  return promise
}

export function clearDocxResource(content: ViewerContentIdentity) {
  bufferCache.delete(content.key)
}

export function resetDocxResourceCacheForTests() {
  bufferCache.clear()
}

function readDocxBytes(content: ViewerContentBytes): Promise<ArrayBuffer> {
  return content.readBytes()
}
