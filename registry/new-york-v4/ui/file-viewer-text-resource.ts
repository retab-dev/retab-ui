import {
  isAbortError,
  subscribeToAbortableRequest,
  type SharedAbortableRequest,
} from "./file-viewer-async"
import { baseName, timed } from "./file-viewer-core"
import { cachedPromise, lruGet, lruSet } from "./file-viewer-resource-cache"

export interface TextResourceSubscription {
  src: string
  signal: AbortSignal
}

export interface TextResourceCache {
  load(sub: TextResourceSubscription): Promise<string>
  clear(): void
  size(): number
}

export function createTextResourceCache(maxEntries = 12): TextResourceCache {
  const requests = new Map<string, SharedAbortableRequest<string>>()
  const promises = new Map<string, Promise<string>>()

  function remove(src: string) {
    requests.delete(src)
    promises.delete(src)
  }

  function entryFor(src: string): SharedAbortableRequest<string> {
    const existingEntry = lruGet(requests, src)
    if (existingEntry) {
      lruGet(promises, src)
      return existingEntry
    }

    const controller = new AbortController()
    let entry: SharedAbortableRequest<string> | null = null
    const promise = cachedPromise(
      promises,
      src,
      () =>
        timed(`text:fetch ${baseName(src)}`, () =>
          fetch(src, { signal: controller.signal }).then((response) => {
            if (!response.ok)
              throw new Error(`Failed to load file: ${response.status}`)
            return response.text()
          })
        ),
      {
        max: maxEntries,
        onEvict(key) {
          requests.get(key)?.controller.abort()
          requests.delete(key)
        },
        onReject(key, error) {
          if (!isAbortError(error)) requests.delete(key)
        },
      }
    ).finally(() => {
      if (entry) entry.settled = true
    })

    entry = {
      controller,
      promise,
      subscriberPromises: new WeakMap(),
      subscribers: new Set(),
      settled: false,
    }

    lruSet(
      requests,
      src,
      entry,
      (key, dropped) => {
        dropped.controller.abort()
        promises.delete(key)
      },
      maxEntries
    )
    return entry
  }

  return {
    load(sub) {
      const entry = entryFor(sub.src)
      return subscribeToAbortableRequest(entry, sub.signal, () =>
        remove(sub.src)
      )
    },
    clear() {
      for (const entry of requests.values()) entry.controller.abort()
      requests.clear()
      promises.clear()
    },
    size() {
      return requests.size
    },
  }
}

export const textResource = createTextResourceCache()

export function loadTextResource(
  sub: TextResourceSubscription
): Promise<string> {
  return textResource.load(sub)
}
