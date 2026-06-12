import type { ViewerResource } from "@/lib/viewer-resource"

// ---------------------------------------------------------------------------
// Concurrency gate — every renderer parses a heavy library and does synchronous
// CPU work (UTIF decode, XLSX parse, canvas paint), all on the main thread. A
// grid of thumbnails that mounts at once would fire these in a single burst and
// jank the page. Cap how many heavy decodes run concurrently; the rest queue
// and start as slots free, spreading the work across frames.
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_DECODES = 3
let activeDecodes = 0
const decodeQueue: Array<() => void> = []

function acquireDecodeSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const grant = () => {
      activeDecodes++
      let released = false
      resolve(() => {
        if (released) return
        released = true
        activeDecodes--
        decodeQueue.shift()?.()
      })
    }
    if (activeDecodes < MAX_CONCURRENT_DECODES) grant()
    else decodeQueue.push(grant)
  })
}

/** Run `fn` once a decode slot is free, always releasing it afterward. */
export async function withThumbnailDecodeSlot<T>(
  fn: () => Promise<T>
): Promise<T> {
  const release = await acquireDecodeSlot()
  try {
    return await fn()
  } finally {
    release()
  }
}

/**
 * Profiling helper — logs `[thumb] <label> <ms>` when enabled. Gated on a global
 * so it costs nothing in normal use; the profiler sets it before navigation.
 */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const on =
    typeof globalThis !== "undefined" &&
    (globalThis as { __THUMB_PROFILE__?: boolean }).__THUMB_PROFILE__
  if (!on) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    console.log(`[thumb] ${label} ${(performance.now() - t0).toFixed(1)}ms`)
  }
}

export const timedThumbnail = timed

export function shortName(resource: ViewerResource): string {
  return resource.fileName
}

// A thumbnail only shows the head of a text document, so cap the download with
// a Range request — a 40 MB log costs the same as a small one. Servers that
// ignore Range just return the whole body (200), which still works.
const TEXT_HEAD_BYTES = 64 * 1024

export interface ThumbnailCacheEntry<T> {
  promise: Promise<T>
  status: "pending" | "fulfilled" | "rejected"
}

const textCache = new Map<string, ThumbnailCacheEntry<string>>()

export function cachedThumbnailResource<T>(
  cache: Map<string, ThumbnailCacheEntry<T>>,
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key)
  if (cached) {
    if (cached.status === "rejected") {
      cache.delete(key)
    }
    return cached.promise
  }

  const entry: ThumbnailCacheEntry<T> = {
    status: "pending",
    promise: load().then(
      (value) => {
        entry.status = "fulfilled"
        return value
      },
      (error) => {
        entry.status = "rejected"
        throw error
      }
    ),
  }
  cache.set(key, entry)
  return entry.promise
}

export function getThumbnailText(
  resource: ViewerResource,
  cacheKey: string
): Promise<string> {
  return cachedThumbnailResource(textCache, cacheKey, () =>
    timed(`text:fetch ${shortName(resource)}`, async () => {
      if (resource.source.kind === "url") {
        const range = await resource.readRange({
          start: 0,
          end: TEXT_HEAD_BYTES - 1,
        })
        return new TextDecoder().decode(range.buffer)
      }
      return resource.readText({ maxBytes: TEXT_HEAD_BYTES })
    })
  )
}

export function useThumbnailResource<T>(promise: Promise<T>): T {
  const record = getThumbnailResourceRecord(promise)
  if (record.status === "pending") throw record.promise
  if (record.status === "rejected") throw record.error
  return record.value as T
}

const thumbnailResourceRecords = new WeakMap<
  Promise<unknown>,
  ThumbnailResourceRecord<unknown>
>()

function getThumbnailResourceRecord<T>(
  promise: Promise<T>
): ThumbnailResourceRecord<T> {
  const cached = thumbnailResourceRecords.get(promise) as
    | ThumbnailResourceRecord<T>
    | undefined
  if (cached) return cached

  const record: ThumbnailResourceRecord<T> = {
    promise,
    status: "pending",
  }
  promise.then(
    (value) => {
      record.status = "fulfilled"
      record.value = value
    },
    (error) => {
      record.status = "rejected"
      record.error = error
    }
  )
  thumbnailResourceRecords.set(
    promise,
    record as ThumbnailResourceRecord<unknown>
  )
  return record
}

interface ThumbnailResourceRecord<T> {
  promise: Promise<T>
  status: "pending" | "fulfilled" | "rejected"
  value?: T
  error?: unknown
}
