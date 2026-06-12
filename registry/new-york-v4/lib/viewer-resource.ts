import {
  createBlobDownloadAction,
  createHrefDownloadAction,
  createTextDownloadAction,
  type ViewerDownloadAction,
} from "@/lib/viewer-download"
import {
  isAbortError,
  ResourceError,
  type ResourceTooLargeReason,
} from "@/lib/viewer-errors"
import {
  resolveViewerDescriptor,
  type BlobViewerSource,
  type TextSource,
  type UrlViewerSource,
  type ViewerDescriptor,
  type ViewerSource,
} from "@/lib/viewer-source"

export interface ResourceReadOptions {
  signal?: AbortSignal
}

export interface TextReadOptions extends ResourceReadOptions {
  maxBytes?: number
  maxLines?: number
}

export interface ByteRange {
  start: number
  end: number
}

export interface ByteRangeResult {
  buffer: ArrayBuffer
  contentRange?: {
    start: number
    end: number
    total: number | null
  }
  isComplete: boolean
}

export type DirectLoadCapability =
  | { kind: "url"; url: string }
  | { kind: "none" }

export interface ViewerResourceKeys {
  readonly load: string
  readonly presentation: string
  readonly resource: string
}

export interface ViewerResource {
  readonly source: ViewerSource
  readonly descriptor: ViewerDescriptor
  readonly sourceKind: ViewerSource["kind"]
  readonly keys: ViewerResourceKeys
  readonly identityKey: string
  readonly fileName: string
  readonly mimeType?: string

  getDirectLoad(): DirectLoadCapability
  getOriginalDownload(): ViewerDownloadAction
  getInlineText(): string | null
  getBlob(): Blob | null
  readBlob(options?: ResourceReadOptions): Promise<Blob>
  readArrayBuffer(options?: ResourceReadOptions): Promise<ArrayBuffer>
  readText(options?: TextReadOptions): Promise<string>
  stream(options?: ResourceReadOptions): Promise<ReadableStream<Uint8Array>>
  readRange(
    range: ByteRange,
    options?: ResourceReadOptions
  ): Promise<ByteRangeResult>
}

const URL_RESOURCE_REGISTRY_MAX = 128
const TEXT_LINE_BREAK_PATTERN = /\r\n|\n|\r/g

const urlViewerResourceRegistry = new Map<string, ViewerResource>()
let blobViewerResourceRegistry = new WeakMap<
  Blob,
  Map<string, ViewerResource>
>()
const blobObjectKeys = new WeakMap<Blob, string>()
let nextBlobObjectKey = 0

export function createViewerResource(source: ViewerSource): ViewerResource {
  const descriptor = resolveViewerDescriptor({ source })
  const keys = viewerResourceKeys(source, descriptor)

  if (source.kind === "url") {
    return internUrlResource(source, descriptor, keys)
  }
  if (source.kind === "blob") {
    return internBlobResource(source, descriptor, keys)
  }
  return createUncachedViewerResource(source, descriptor, keys)
}

export function clearViewerResourceRegistryForTests() {
  urlViewerResourceRegistry.clear()
  blobViewerResourceRegistry = new WeakMap()
}

function createUncachedViewerResource(
  source: ViewerSource,
  descriptor: ViewerDescriptor,
  keys: ViewerResourceKeys
): ViewerResource {
  switch (source.kind) {
    case "url":
      return createUrlResource(source, descriptor, keys)
    case "blob":
      return createBlobResource(source, descriptor, keys)
    case "text":
      return createTextResource(source, descriptor, keys)
  }
}

function internUrlResource(
  source: UrlViewerSource,
  descriptor: ViewerDescriptor,
  keys: ViewerResourceKeys
): ViewerResource {
  const cached = urlViewerResourceRegistry.get(keys.resource)
  if (cached) return cached

  const resource = createUrlResource(source, descriptor, keys)
  urlViewerResourceRegistry.set(keys.resource, resource)
  pruneUrlResourceRegistry()
  return resource
}

function internBlobResource(
  source: BlobViewerSource,
  descriptor: ViewerDescriptor,
  keys: ViewerResourceKeys
): ViewerResource {
  let resources = blobViewerResourceRegistry.get(source.blob)
  if (!resources) {
    resources = new Map()
    blobViewerResourceRegistry.set(source.blob, resources)
  }

  const cached = resources.get(keys.resource)
  if (cached) return cached

  const resource = createBlobResource(source, descriptor, keys)
  resources.set(keys.resource, resource)
  return resource
}

function pruneUrlResourceRegistry() {
  while (urlViewerResourceRegistry.size > URL_RESOURCE_REGISTRY_MAX) {
    const firstKey = urlViewerResourceRegistry.keys().next().value
    if (!firstKey) return
    urlViewerResourceRegistry.delete(firstKey)
  }
}

function viewerResourceKeys(
  source: ViewerSource,
  descriptor: ViewerDescriptor
): ViewerResourceKeys {
  const load = viewerResourceLoadKey(source)
  const presentation = viewerResourcePresentationKey(source, descriptor)
  return {
    load,
    presentation,
    resource: [load, presentation].join("\u0000"),
  }
}

function viewerResourceLoadKey(source: ViewerSource) {
  return [
    source.kind,
    source.identityKey ?? "",
    directLoadCacheKey(source),
    payloadCacheKey(source),
  ].join("\u0000")
}

function viewerResourcePresentationKey(
  source: ViewerSource,
  descriptor: ViewerDescriptor
) {
  return [
    descriptor.category,
    descriptor.displayName,
    descriptor.fileName,
    descriptor.mimeType ?? "",
    downloadCacheKey(source),
  ].join("\u0000")
}

function directLoadCacheKey(source: ViewerSource) {
  return source.kind === "url" ? source.url : ""
}

function downloadCacheKey(source: ViewerSource) {
  if (source.kind === "text") return ""
  return source.downloadUrl ?? ""
}

function payloadCacheKey(source: ViewerSource) {
  if (source.kind === "url") return ""
  if (source.kind === "blob") return blobObjectKey(source.blob)
  return `text:${source.text.length}:${hashString(source.text)}`
}

function blobObjectKey(blob: Blob) {
  let key = blobObjectKeys.get(blob)
  if (!key) {
    nextBlobObjectKey += 1
    key = `blob-object:${nextBlobObjectKey}`
    blobObjectKeys.set(blob, key)
  }
  return key
}

function hashString(text: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function blobSource(
  bytes: Blob | ArrayBuffer | Uint8Array,
  metadata: {
    identityKey: string
    fileName?: string
    mimeType?: string
    downloadUrl?: string
  }
): BlobViewerSource {
  const blob =
    bytes instanceof Blob
      ? bytes
      : new Blob(
          [bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes)],
          {
            type: metadata.mimeType ?? "",
          }
        )
  return {
    kind: "blob",
    blob,
    fileName: metadata.fileName,
    mimeType: metadata.mimeType ?? blob.type,
    downloadUrl: metadata.downloadUrl,
    identityKey: metadata.identityKey,
  }
}

function createUrlResource(
  source: UrlViewerSource,
  descriptor: ViewerDescriptor,
  keys: ViewerResourceKeys
): ViewerResource {
  return resourceBase(source, descriptor, keys, {
    getDirectLoad: () => ({ kind: "url", url: source.url }),
    getOriginalDownload: () =>
      createHrefDownloadAction({
        id: "download-original",
        label: "Download",
        href: source.downloadUrl ?? source.url,
        fileName: descriptor.fileName,
      }),
    getInlineText: () => null,
    getBlob: () => null,
    readBlob: async ({ signal } = {}) => {
      const response = await fetchResource(source.url, { signal })
      return response.blob()
    },
    readArrayBuffer: async ({ signal } = {}) => {
      const response = await fetchResource(source.url, { signal })
      return response.arrayBuffer()
    },
    readText: async ({ signal, maxBytes, maxLines } = {}) => {
      const response = await fetchResource(source.url, { signal })
      return readBoundedResponseText(response, { maxBytes, maxLines })
    },
    stream: async ({ signal } = {}) => {
      const response = await fetchResource(source.url, { signal })
      if (!response.body) {
        throw new ResourceError({
          kind: "unsupported_capability",
          message: "This response cannot be streamed.",
        })
      }
      return response.body
    },
    readRange: async (range, { signal } = {}) => {
      validateByteRange(range)
      const { start, end } = range
      const response = await fetchResource(source.url, {
        signal,
        headers: { Range: `bytes=${start}-${end}` },
      })
      const buffer = await response.arrayBuffer()
      const contentRange = parseContentRange(
        response.headers.get("content-range")
      )
      return {
        buffer,
        contentRange,
        isComplete: isByteRangeComplete({
          bufferLength: buffer.byteLength,
          contentRange,
          requestedLength: end - start + 1,
          status: response.status,
        }),
      }
    },
  })
}

function createBlobResource(
  source: BlobViewerSource,
  descriptor: ViewerDescriptor,
  keys: ViewerResourceKeys
): ViewerResource {
  const blob = source.blob
  return resourceBase(source, descriptor, keys, {
    getDirectLoad: () => ({ kind: "none" }),
    getOriginalDownload: () =>
      source.downloadUrl
        ? createHrefDownloadAction({
            id: "download-original",
            label: "Download",
            href: source.downloadUrl,
            fileName: descriptor.fileName,
          })
        : createBlobDownloadAction({
            id: "download-original",
            label: "Download",
            blob,
            fileName: descriptor.fileName,
          }),
    getInlineText: () => null,
    getBlob: () => blob,
    readBlob: async () => blob,
    readArrayBuffer: async () => blob.arrayBuffer(),
    readText: async ({ maxBytes, maxLines } = {}) =>
      readBoundedBlobText(blob, { maxBytes, maxLines }),
    stream: async () => blob.stream(),
    readRange: async (range) => {
      validateByteRange(range)
      const { start, end } = range
      const rangeBlob = blob.slice(start, end + 1)
      return {
        buffer: await rangeBlob.arrayBuffer(),
        contentRange: {
          start,
          end: Math.min(end, Math.max(0, blob.size - 1)),
          total: blob.size,
        },
        isComplete: end >= blob.size - 1,
      }
    },
  })
}

function createTextResource(
  source: TextSource,
  descriptor: ViewerDescriptor,
  keys: ViewerResourceKeys
): ViewerResource {
  return resourceBase(source, descriptor, keys, {
    getDirectLoad: () => ({ kind: "none" }),
    getOriginalDownload: () =>
      createTextDownloadAction({
        id: "download-original",
        label: "Download",
        text: source.text,
        fileName: descriptor.fileName,
        mimeType: descriptor.mimeType,
      }),
    getInlineText: () => source.text,
    getBlob: () => null,
    readBlob: async () =>
      new Blob([source.text], {
        type: descriptor.mimeType ?? "text/plain;charset=utf-8",
      }),
    readArrayBuffer: async () => new TextEncoder().encode(source.text).buffer,
    readText: async ({ maxBytes, maxLines } = {}) =>
      readBoundedInlineText(source.text, { maxBytes, maxLines }),
    stream: async () => new Blob([source.text]).stream(),
    readRange: async (range) => {
      validateByteRange(range)
      const { start, end } = range
      const buffer = new TextEncoder().encode(source.text)
      const slice = buffer.slice(start, end + 1)
      return {
        buffer: slice.buffer,
        contentRange: {
          start,
          end: Math.min(end, Math.max(0, buffer.byteLength - 1)),
          total: buffer.byteLength,
        },
        isComplete: end >= buffer.byteLength - 1,
      }
    },
  })
}

function resourceBase(
  source: ViewerSource,
  descriptor: ViewerDescriptor,
  keys: ViewerResourceKeys,
  methods: Pick<
    ViewerResource,
    | "getDirectLoad"
    | "getOriginalDownload"
    | "getInlineText"
    | "getBlob"
    | "readBlob"
    | "readArrayBuffer"
    | "readText"
    | "stream"
    | "readRange"
  >
): ViewerResource {
  return Object.freeze({
    source,
    descriptor,
    sourceKind: source.kind,
    keys,
    identityKey: descriptor.identityKey,
    fileName: descriptor.fileName,
    mimeType: descriptor.mimeType,
    ...methods,
  })
}

async function fetchResource(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(input, init)
  } catch (error) {
    if (isAbortError(error)) {
      throw new ResourceError({
        kind: "aborted",
        message: "Loading was cancelled.",
        cause: error,
      })
    }
    throw new ResourceError({
      kind: "fetch_failed",
      message: "Could not fetch this resource.",
      cause: error,
    })
  }

  if (!response.ok && response.status !== 206) {
    throw new ResourceError({
      kind: "http_error",
      message: `Failed to load resource: ${response.status}`,
      status: response.status,
    })
  }

  return response
}

async function readBoundedResponseText(
  response: Response,
  bounds: { maxBytes?: number; maxLines?: number }
) {
  if (response.status === 206) {
    throw new ResourceError({
      kind: "partial_content",
      message: "Full text response returned partial content.",
      status: response.status,
    })
  }

  const maxBytes = bounds.maxBytes
  const contentLength = response.headers.get("content-length")
  const contentByteLength = contentLength ? Number(contentLength) : null
  if (
    maxBytes != null &&
    contentByteLength != null &&
    Number.isFinite(contentByteLength) &&
    contentByteLength > maxBytes
  ) {
    throw tooLarge("bytes")
  }

  const body = response.body
  if (!body) {
    const buffer = await response.arrayBuffer()
    if (maxBytes != null && buffer.byteLength > maxBytes) {
      throw tooLarge("bytes")
    }
    return readBoundedInlineText(new TextDecoder().decode(buffer), bounds)
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  const lineLimitTracker = createLineLimitTracker(bounds.maxLines)
  let receivedBytes = 0
  let text = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (maxBytes != null && receivedBytes > maxBytes) {
      await reader.cancel()
      throw tooLarge("bytes")
    }
    const chunkText = decoder.decode(value, { stream: true })
    try {
      lineLimitTracker.push(chunkText)
    } catch (error) {
      await reader.cancel()
      throw error
    }
    text += chunkText
  }

  const finalText = decoder.decode()
  lineLimitTracker.push(finalText)
  text += finalText
  return readBoundedInlineText(text, bounds)
}

async function readBoundedBlobText(
  blob: Blob,
  bounds: { maxBytes?: number; maxLines?: number }
) {
  if (bounds.maxBytes != null && blob.size > bounds.maxBytes) {
    throw tooLarge("bytes")
  }
  return readBoundedInlineText(await blob.text(), bounds)
}

function readBoundedInlineText(
  text: string,
  { maxBytes, maxLines }: { maxBytes?: number; maxLines?: number }
) {
  if (
    maxBytes != null &&
    new TextEncoder().encode(text).byteLength > maxBytes
  ) {
    throw tooLarge("bytes")
  }
  if (
    maxLines != null &&
    text.split(TEXT_LINE_BREAK_PATTERN).length > maxLines
  ) {
    throw tooLarge("lines")
  }
  return text
}

function tooLarge(reason: ResourceTooLargeReason) {
  return new ResourceError({
    kind: "too_large",
    tooLargeReason: reason,
    message: `Resource exceeds ${reason} limit.`,
  })
}

function validateByteRange({ start, end }: ByteRange) {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start
  ) {
    throw new ResourceError({
      kind: "invalid_range",
      message: "Byte range must use non-negative integer bounds.",
    })
  }
}

function isByteRangeComplete({
  bufferLength,
  contentRange,
  requestedLength,
  status,
}: {
  bufferLength: number
  contentRange: ByteRangeResult["contentRange"]
  requestedLength: number
  status: number
}) {
  if (status === 200) return true
  if (contentRange?.total != null) {
    if (contentRange.total <= 0) return true
    return contentRange.end >= contentRange.total - 1
  }
  return bufferLength < requestedLength
}

function createLineLimitTracker(maxLines: number | undefined) {
  let lineCount = 1
  let previousWasCR = false

  return {
    push(text: string) {
      if (maxLines == null || text.length === 0) return

      for (const character of text) {
        if (previousWasCR) {
          previousWasCR = false
          if (character === "\n") continue
        }

        if (character === "\r") {
          lineCount += 1
          previousWasCR = true
        } else if (character === "\n") {
          lineCount += 1
        }

        if (lineCount > maxLines) {
          throw tooLarge("lines")
        }
      }
    },
  }
}

function parseContentRange(value: string | null) {
  if (!value) return undefined
  const match = value.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i)
  if (!match) return undefined
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === "*" ? null : Number(match[3]),
  }
}
