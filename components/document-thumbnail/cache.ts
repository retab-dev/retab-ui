import {
  isAbortError,
  isResourceError,
  ResourceError,
  ViewerFormatError,
  type ViewerFormat,
} from "@/lib/viewer-errors"
import type {
  ViewerContentBytes,
  ViewerContentIdentity,
  ViewerContentRange,
  ViewerContentStream,
} from "@/lib/viewer-resource"
import type { FileCategory, ViewerSource } from "@/lib/viewer-source"

export const TEXT_THUMBNAIL_MAX_BYTES = 64 * 1024
export const CSV_THUMBNAIL_MAX_ROWS = 16
export const CSV_THUMBNAIL_MAX_COLUMNS = 6
export const XLSX_THUMBNAIL_MAX_ROWS = 16
export const XLSX_THUMBNAIL_MAX_COLUMNS = 6
export const TIFF_THUMBNAIL_TARGET_WIDTH = 320
export const TEXT_THUMBNAIL_CACHE_MAX_ENTRIES = 96

export interface ThumbnailFileMeta {
  fileName: string
  mimeType?: string
  sourceKind: ViewerSource["kind"]
}

export type ThumbnailTextContent = ViewerContentIdentity &
  ViewerContentRange &
  ViewerContentStream

export type ThumbnailBytesContent = ViewerContentIdentity & ViewerContentBytes

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
      let hasReleased = false
      resolve(() => {
        if (hasReleased) return
        hasReleased = true
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

export function shortName(meta: ThumbnailFileMeta): string {
  return meta.fileName
}

export interface ThumbnailCacheEntry<T> {
  promise: Promise<T>
  status: "pending" | "resolved" | "rejected"
  value?: T
}

export interface ThumbnailCacheStore<T> {
  get(key: string): ThumbnailCacheEntry<T> | undefined
  set(key: string, entry: ThumbnailCacheEntry<T>): void
  delete(key: string): boolean
  clear?(): void
  prune?(): void
}

export interface ThumbnailArtifactCacheOptions<T> {
  maxEntries: number
  dispose?: (value: T) => void
}

export interface ThumbnailArtifactCache<T> extends ThumbnailCacheStore<T> {
  readonly size: number
}

const textCache = createThumbnailArtifactCache<string>({
  maxEntries: TEXT_THUMBNAIL_CACHE_MAX_ENTRIES,
})

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
        entry.status = "resolved"
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
    clear() {
      for (const entry of entries.values()) {
        disposeCacheEntry(entry, dispose)
      }
      entries.clear()
    },
    prune() {
      while (entries.size > maxEntries) {
        const evicted = evictOldestResolvedEntry(entries, dispose)
        if (!evicted) return
      }
    },
  }

  return cache
}

function evictOldestResolvedEntry<T>(
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
  if (entry.status === "resolved" && entry.value !== undefined) {
    dispose?.(entry.value)
  }
}

export function getThumbnailText(
  meta: ThumbnailFileMeta,
  content: ThumbnailTextContent,
  thumbnailKey: string
): Promise<string> {
  return cachedThumbnailResource(textCache, thumbnailKey, () =>
    timed(`text:fetch ${shortName(meta)}`, async () => {
      if (meta.sourceKind === "url") {
        try {
          return readThumbnailTextRange(content)
        } catch (error) {
          if (shouldReadTextStreamPrefix(error)) {
            return readThumbnailTextStreamPrefix(content)
          }
          throw error
        }
      }
      return readThumbnailTextRange(content)
    })
  )
}

function shouldReadTextStreamPrefix(error: unknown): boolean {
  return (
    isResourceError(error) &&
    (error.kind === "invalid_range" ||
      (error.kind === "http_error" && error.status === 416))
  )
}

async function readThumbnailTextRange(content: ThumbnailTextContent) {
  const range = await content.readRange({
    start: 0,
    end: TEXT_THUMBNAIL_MAX_BYTES - 1,
  })
  return new TextDecoder().decode(range.buffer)
}

async function readThumbnailTextStreamPrefix(content: ThumbnailTextContent) {
  const stream = await content.readStream()
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let remainingBytes = TEXT_THUMBNAIL_MAX_BYTES
  let text = ""

  try {
    while (remainingBytes > 0) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()

      const chunk =
        value.byteLength > remainingBytes
          ? value.slice(0, remainingBytes)
          : value
      text += decoder.decode(chunk, { stream: true })
      remainingBytes -= chunk.byteLength

      if (chunk.byteLength < value.byteLength || remainingBytes === 0) {
        cancelThumbnailTextReader(reader)
        return text + decoder.decode()
      }
    }

    cancelThumbnailTextReader(reader)
    return text + decoder.decode()
  } catch (error) {
    throw createThumbnailTextReadError(error)
  }
}

function createThumbnailTextReadError(error: unknown): ResourceError {
  if (isResourceError(error)) return error
  if (isAbortError(error)) {
    return new ResourceError({
      kind: "aborted",
      message: "Resource load was aborted.",
      cause: error,
    })
  }
  return new ResourceError({
    kind: "fetch_failed",
    message: "Could not read this resource.",
    cause: error,
  })
}

function cancelThumbnailTextReader(
  reader: ReadableStreamDefaultReader<Uint8Array>
) {
  try {
    void reader.cancel().catch(() => {})
  } catch {
    /* The preview prefix is already available; cancellation is best-effort. */
  }
}

export function thumbnailFileMeta({
  fileName,
  mimeType,
  sourceKind,
}: ThumbnailFileMeta): ThumbnailFileMeta {
  return { fileName, mimeType, sourceKind }
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

export function createThumbnailImageLoadError(): ViewerFormatError {
  return new ViewerFormatError({
    format: "image",
    kind: "load_failed",
    message: "Could not load image preview.",
  })
}

export function thumbnailCategoryFormat(category: FileCategory): ViewerFormat {
  if (category === "markdown" || category === "html") return "text"
  if (category === "unsupported") return "file"
  return category
}

export function clearThumbnailCachesForTests() {
  textCache.clear?.()
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
      record.status = "resolved"
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
  status: "pending" | "resolved" | "rejected"
  value?: T
  error?: unknown
}
