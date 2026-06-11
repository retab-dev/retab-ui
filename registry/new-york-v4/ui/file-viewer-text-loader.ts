import { baseName, timed } from "./file-viewer-core"
import {
  isAbortError,
  lruGet,
  lruSet,
  subscribeToAbortableRequest,
  type SharedAbortableRequest,
} from "./file-viewer-resource-cache"

const TEXT_PAGE_BYTES = 512 * 1024

export interface TextSnapshot {
  text: string
  bytesLoaded: number
  totalBytes: number | null
  done: boolean
}

interface TextLoaderState extends TextSnapshot {
  decoder: TextDecoder
}

export type TextLoadMode = "stream" | "full"

export interface TextSubscription {
  textKey: string
  src: string
  mode: TextLoadMode
  signal: AbortSignal
}

export interface TextLoader {
  snapshot(textKey: string): TextSnapshot | null
  loadFirstChunk(sub: TextSubscription): Promise<TextSnapshot>
  loadNextChunk(sub: TextSubscription): Promise<TextSnapshot>
  release(textKey: string): void
  clear(): void
  size(): number
}

interface RangeResult {
  buf: ArrayBuffer
  whole: boolean
  total: number | null
}

export function textKeyForFile(src: string, mode: TextLoadMode): string {
  return `${mode}\u0000${src}`
}

export function isSameTextView(
  currentTextViewKey: string,
  startedTextViewKey: string
): boolean {
  return currentTextViewKey === startedTextViewKey
}

function snapshotOf(loader: TextLoaderState): TextSnapshot {
  return {
    text: loader.text,
    bytesLoaded: loader.bytesLoaded,
    totalBytes: loader.totalBytes,
    done: loader.done,
  }
}

async function fetchRange(
  src: string,
  start: number,
  end: number,
  signal: AbortSignal
): Promise<RangeResult> {
  const res = await fetch(src, {
    headers: { Range: `bytes=${start}-${end}` },
    signal,
  })
  if (res.status === 416)
    return { buf: new ArrayBuffer(0), whole: false, total: null }
  if (!res.ok) throw new Error(`Failed to load file: ${res.status}`)
  const buf = await res.arrayBuffer()
  let total: number | null = null
  const contentRange = res.headers.get("content-range")
  if (contentRange) {
    const m = contentRange.match(/\/(\d+)\s*$/)
    if (m) total = Number(m[1])
  } else {
    const len = Number(res.headers.get("content-length"))
    if (Number.isFinite(len) && len > 0) total = len
  }
  return { buf, whole: res.status === 200, total }
}

export function createTextLoader(maxEntries = 12): TextLoader {
  const firstRequests = new Map<string, SharedAbortableRequest<TextSnapshot>>()
  const nextRequests = new Map<string, SharedAbortableRequest<TextSnapshot>>()
  const loaders = new Map<string, TextLoaderState>()

  function remove(textKey: string) {
    firstRequests.delete(textKey)
    nextRequests.delete(textKey)
    loaders.delete(textKey)
  }

  function firstEntry(
    sub: TextSubscription
  ): SharedAbortableRequest<TextSnapshot> {
    let entry = lruGet(firstRequests, sub.textKey)
    if (entry) return entry

    const controller = new AbortController()
    entry = {
      controller,
      subscriberPromises: new WeakMap(),
      subscribers: new Set(),
      settled: false,
      promise: timed(`text:first-chunk ${baseName(sub.src)}`, async () => {
        const decoder = new TextDecoder()
        if (sub.mode === "full") {
          const res = await fetch(sub.src, { signal: controller.signal })
          if (!res.ok) throw new Error(`Failed to load file: ${res.status}`)
          const buf = await res.arrayBuffer()
          const text = decoder.decode(buf)
          const bytesLoaded = buf.byteLength
          const loader: TextLoaderState = {
            text,
            bytesLoaded,
            totalBytes: bytesLoaded,
            done: true,
            decoder,
          }
          loaders.set(sub.textKey, loader)
          return snapshotOf(loader)
        }

        const { buf, whole, total } = await fetchRange(
          sub.src,
          0,
          TEXT_PAGE_BYTES - 1,
          controller.signal
        )
        const text = decoder.decode(buf, { stream: !whole })
        const bytesLoaded = buf.byteLength
        const done =
          whole ||
          buf.byteLength < TEXT_PAGE_BYTES ||
          (total != null && bytesLoaded >= total)
        const loader: TextLoaderState = {
          text: done && !whole ? text + decoder.decode() : text,
          bytesLoaded,
          totalBytes: whole ? bytesLoaded : total,
          done,
          decoder,
        }
        loaders.set(sub.textKey, loader)
        return snapshotOf(loader)
      })
        .catch((error: unknown) => {
          remove(sub.textKey)
          throw error
        })
        .finally(() => {
          if (entry) entry.settled = true
        }),
    }

    lruSet(
      firstRequests,
      sub.textKey,
      entry,
      (textKey, dropped) => {
        dropped.controller.abort()
        loaders.delete(textKey)
        nextRequests.delete(textKey)
      },
      maxEntries
    )
    return entry
  }

  function nextEntry(
    sub: TextSubscription
  ): SharedAbortableRequest<TextSnapshot> {
    let entry = nextRequests.get(sub.textKey)
    if (entry) return entry

    const loader = loaders.get(sub.textKey)
    const controller = new AbortController()
    entry = {
      controller,
      subscriberPromises: new WeakMap(),
      subscribers: new Set(),
      settled: false,
      promise: (async () => {
        if (!loader || loader.done) {
          return loader
            ? snapshotOf(loader)
            : { text: "", bytesLoaded: 0, totalBytes: null, done: true }
        }

        const start = loader.bytesLoaded
        const { buf, total } = await fetchRange(
          sub.src,
          start,
          start + TEXT_PAGE_BYTES - 1,
          controller.signal
        )
        loader.bytesLoaded += buf.byteLength
        if (total != null) loader.totalBytes = total
        const reachedEnd =
          buf.byteLength === 0 ||
          buf.byteLength < TEXT_PAGE_BYTES ||
          (loader.totalBytes != null && loader.bytesLoaded >= loader.totalBytes)
        loader.text += loader.decoder.decode(buf, { stream: !reachedEnd })
        if (reachedEnd) loader.done = true
        return snapshotOf(loader)
      })()
        .catch((error: unknown) => {
          if (!isAbortError(error)) nextRequests.delete(sub.textKey)
          throw error
        })
        .finally(() => {
          if (entry) entry.settled = true
          nextRequests.delete(sub.textKey)
        }),
    }

    nextRequests.set(sub.textKey, entry)
    return entry
  }

  return {
    snapshot(textKey) {
      const loader = loaders.get(textKey)
      return loader ? snapshotOf(loader) : null
    },
    loadFirstChunk(sub) {
      const entry = firstEntry(sub)
      return subscribeToAbortableRequest(entry, sub.signal, () =>
        remove(sub.textKey)
      )
    },
    loadNextChunk(sub) {
      const entry = nextEntry(sub)
      return subscribeToAbortableRequest(entry, sub.signal, () => {
        nextRequests.delete(sub.textKey)
      })
    },
    release: remove,
    clear() {
      for (const entry of firstRequests.values()) entry.controller.abort()
      for (const entry of nextRequests.values()) entry.controller.abort()
      firstRequests.clear()
      nextRequests.clear()
      loaders.clear()
    },
    size() {
      return firstRequests.size
    },
  }
}

export const textLoader = createTextLoader()

export function loadFirstTextChunk(
  sub: TextSubscription
): Promise<TextSnapshot> {
  return textLoader.loadFirstChunk(sub)
}

export function loadNextTextChunk(
  sub: TextSubscription
): Promise<TextSnapshot> {
  return textLoader.loadNextChunk(sub)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
