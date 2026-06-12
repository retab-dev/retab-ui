import { isResourceError, ViewerFormatError } from "@/lib/viewer-errors"
import type { ViewerResource } from "@/lib/viewer-resource"
import type { FileCategory } from "@/lib/viewer-source"

export const TEXT_THUMBNAIL_MAX_BYTES = 64 * 1024
export const CSV_THUMBNAIL_MAX_ROWS = 16
export const CSV_THUMBNAIL_MAX_COLUMNS = 6
export const XLSX_THUMBNAIL_MAX_ROWS = 16
export const XLSX_THUMBNAIL_MAX_COLUMNS = 6
export const TIFF_THUMBNAIL_TARGET_WIDTH = 320

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

export interface ThumbnailCacheEntry<T> {
  promise: Promise<T>
  status: "pending" | "fulfilled" | "rejected"
  value?: T
}

export interface ThumbnailCacheStore<T> {
  get(key: string): ThumbnailCacheEntry<T> | undefined
  set(key: string, entry: ThumbnailCacheEntry<T>): void
  delete(key: string): boolean
  prune?(): void
}

export interface ThumbnailArtifactCacheOptions<T> {
  maxEntries: number
  dispose?: (value: T) => void
}

export interface ThumbnailArtifactCache<T> extends ThumbnailCacheStore<T> {
  readonly size: number
}

const textCache = new Map<string, ThumbnailCacheEntry<string>>()

export function cachedThumbnailResource<T>(
  cache: ThumbnailCacheStore<T>,
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
        entry.value = value
        cache.prune?.()
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

export function createThumbnailArtifactCache<T>({
  maxEntries,
  dispose,
}: ThumbnailArtifactCacheOptions<T>): ThumbnailArtifactCache<T> {
  const entries = new Map<string, ThumbnailCacheEntry<T>>()

  const cache: ThumbnailArtifactCache<T> = {
    get size() {
      return entries.size
    },
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      entries.delete(key)
      entries.set(key, entry)
      return entry
    },
    set(key, entry) {
      entries.set(key, entry)
      cache.prune?.()
    },
    delete(key) {
      const entry = entries.get(key)
      if (!entry) return false
      entries.delete(key)
      disposeCacheEntry(entry, dispose)
      return true
    },
    prune() {
      while (entries.size > maxEntries) {
        const evicted = evictOldestFulfilledEntry(entries, dispose)
        if (!evicted) return
      }
    },
  }

  return cache
}

function evictOldestFulfilledEntry<T>(
  entries: Map<string, ThumbnailCacheEntry<T>>,
  dispose?: (value: T) => void
): boolean {
  for (const [key, entry] of entries) {
    if (entry.status !== "pending") {
      entries.delete(key)
      disposeCacheEntry(entry, dispose)
      return true
    }
  }
  return false
}

function disposeCacheEntry<T>(
  entry: ThumbnailCacheEntry<T>,
  dispose?: (value: T) => void
) {
  if (entry.status === "fulfilled" && entry.value !== undefined) {
    dispose?.(entry.value)
  }
}

export function getThumbnailText(
  resource: ViewerResource,
  cacheKey: string
): Promise<string> {
  return cachedThumbnailResource(textCache, cacheKey, () =>
    timed(`text:fetch ${shortName(resource)}`, async () => {
      if (resource.sourceKind === "url") {
        const range = await resource.readRange({
          start: 0,
          end: TEXT_THUMBNAIL_MAX_BYTES - 1,
        })
        return new TextDecoder().decode(range.buffer)
      }
      return resource.readText({ maxBytes: TEXT_THUMBNAIL_MAX_BYTES })
    })
  )
}

export async function withThumbnailFormatError<T>(
  category: FileCategory,
  kind:
    | "decode_failed"
    | "load_failed"
    | "parse_failed"
    | "render_failed"
    | "unknown",
  fileName: string,
  message: string,
  load: () => Promise<T>
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (isResourceError(error)) throw error
    throw new ViewerFormatError({
      format: thumbnailCategoryFormat(category),
      kind,
      message: `${message}: ${fileName}`,
      cause: error,
    })
  }
}

function thumbnailCategoryFormat(category: FileCategory) {
  if (category === "markdown" || category === "html") return "text"
  if (category === "unsupported") return "file"
  return category
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
