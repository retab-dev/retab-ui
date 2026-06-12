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

export type DownloadCapability =
  | { kind: "href"; href: string; fileName: string }
  | { kind: "blob"; blob: Blob; fileName: string }
  | { kind: "text"; text: string; fileName: string; mimeType?: string }
  | { kind: "none"; fileName: string }

export interface ViewerResource {
  readonly source: ViewerSource
  readonly descriptor: ViewerDescriptor
  readonly cacheKey: string
  readonly identityKey: string
  readonly fileName: string
  readonly mimeType?: string

  getDownload(): DownloadCapability
  readBlob(options?: ResourceReadOptions): Promise<Blob>
  readArrayBuffer(options?: ResourceReadOptions): Promise<ArrayBuffer>
  readText(options?: TextReadOptions): Promise<string>
  stream(options?: ResourceReadOptions): Promise<ReadableStream<Uint8Array>>
  readRange(
    range: ByteRange,
    options?: ResourceReadOptions
  ): Promise<ByteRangeResult>
}

export type ResourceErrorKind =
  | "fetch_failed"
  | "http_error"
  | "aborted"
  | "too_large"
  | "unsupported_capability"
  | "unknown"

export type ResourceTooLargeReason = "bytes" | "lines"

export class ResourceError extends Error {
  readonly kind: ResourceErrorKind
  readonly status?: number
  readonly tooLargeReason?: ResourceTooLargeReason
  override readonly cause?: unknown

  constructor({
    kind,
    message,
    status,
    tooLargeReason,
    cause,
  }: {
    kind: ResourceErrorKind
    message: string
    status?: number
    tooLargeReason?: ResourceTooLargeReason
    cause?: unknown
  }) {
    super(message)
    this.name = "ResourceError"
    this.kind = kind
    this.status = status
    this.tooLargeReason = tooLargeReason
    this.cause = cause
  }
}

export interface DescriptorOptions {
  fileName?: string
  mimeType?: string
}

const URL_RESOURCE_REGISTRY_MAX = 128

const urlViewerResourceRegistry = new Map<string, ViewerResource>()
let blobViewerResourceRegistry = new WeakMap<
  Blob,
  Map<string, ViewerResource>
>()
const blobObjectKeys = new WeakMap<Blob, string>()
let nextBlobObjectKey = 0

export function createViewerResource(
  source: ViewerSource,
  options: DescriptorOptions = {}
): ViewerResource {
  const descriptor = resolveViewerDescriptor({ source, ...options })
  const cacheKey = viewerResourceCacheKey(source, descriptor)

  if (source.kind === "url") {
    return internUrlResource(source, descriptor, cacheKey)
  }
  if (source.kind === "blob") {
    return internBlobResource(source, descriptor, cacheKey)
  }
  return createUncachedViewerResource(source, descriptor, cacheKey)
}

export function clearViewerResourceRegistryForTests() {
  urlViewerResourceRegistry.clear()
  blobViewerResourceRegistry = new WeakMap()
}

function createUncachedViewerResource(
  source: ViewerSource,
  descriptor: ViewerDescriptor,
  cacheKey: string
): ViewerResource {
  switch (source.kind) {
    case "url":
      return createUrlResource(source, descriptor, cacheKey)
    case "blob":
      return createBlobResource(source, descriptor, cacheKey)
    case "text":
      return createTextResource(source, descriptor, cacheKey)
  }
}

function internUrlResource(
  source: UrlViewerSource,
  descriptor: ViewerDescriptor,
  cacheKey: string
): ViewerResource {
  const cached = urlViewerResourceRegistry.get(cacheKey)
  if (cached) return cached

  const resource = createUrlResource(source, descriptor, cacheKey)
  urlViewerResourceRegistry.set(cacheKey, resource)
  pruneUrlResourceRegistry()
  return resource
}

function internBlobResource(
  source: BlobViewerSource,
  descriptor: ViewerDescriptor,
  cacheKey: string
): ViewerResource {
  let resources = blobViewerResourceRegistry.get(source.blob)
  if (!resources) {
    resources = new Map()
    blobViewerResourceRegistry.set(source.blob, resources)
  }

  const cached = resources.get(cacheKey)
  if (cached) return cached

  const resource = createBlobResource(source, descriptor, cacheKey)
  resources.set(cacheKey, resource)
  return resource
}

function pruneUrlResourceRegistry() {
  while (urlViewerResourceRegistry.size > URL_RESOURCE_REGISTRY_MAX) {
    const firstKey = urlViewerResourceRegistry.keys().next().value
    if (!firstKey) return
    urlViewerResourceRegistry.delete(firstKey)
  }
}

function viewerResourceCacheKey(
  source: ViewerSource,
  descriptor: ViewerDescriptor
) {
  return [
    source.kind,
    descriptor.identityKey,
    descriptor.category,
    descriptor.displayName,
    descriptor.downloadFileName,
    descriptor.downloadHref ?? "",
    descriptor.loadUrl ?? "",
    descriptor.mimeType ?? "",
    payloadCacheKey(source),
  ].join("\u0000")
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
  cacheKey: string
): ViewerResource {
  return resourceBase(source, descriptor, cacheKey, {
    getDownload: () => ({
      kind: "href",
      href: source.downloadUrl ?? source.url,
      fileName: descriptor.downloadFileName,
    }),
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
    readRange: async ({ start, end }, { signal } = {}) => {
      const response = await fetchResource(source.url, {
        signal,
        headers: { Range: `bytes=${start}-${end}` },
      })
      const buffer = await response.arrayBuffer()
      return {
        buffer,
        contentRange: parseContentRange(response.headers.get("content-range")),
        isComplete: response.status === 200 || buffer.byteLength <= end - start,
      }
    },
  })
}

function createBlobResource(
  source: BlobViewerSource,
  descriptor: ViewerDescriptor,
  cacheKey: string
): ViewerResource {
  const blob = source.blob
  return resourceBase(source, descriptor, cacheKey, {
    getDownload: () =>
      source.downloadUrl
        ? {
            kind: "href",
            href: source.downloadUrl,
            fileName: descriptor.downloadFileName,
          }
        : {
            kind: "blob",
            blob,
            fileName: descriptor.downloadFileName,
          },
    readBlob: async () => blob,
    readArrayBuffer: async () => blob.arrayBuffer(),
    readText: async ({ maxBytes, maxLines } = {}) =>
      readBoundedBlobText(blob, { maxBytes, maxLines }),
    stream: async () => blob.stream(),
    readRange: async ({ start, end }) => {
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
  cacheKey: string
): ViewerResource {
  return resourceBase(source, descriptor, cacheKey, {
    getDownload: () => ({
      kind: "text",
      text: source.text,
      fileName: descriptor.downloadFileName,
      mimeType: descriptor.mimeType,
    }),
    readBlob: async () =>
      new Blob([source.text], {
        type: descriptor.mimeType ?? "text/plain;charset=utf-8",
      }),
    readArrayBuffer: async () => new TextEncoder().encode(source.text).buffer,
    readText: async ({ maxBytes, maxLines } = {}) =>
      readBoundedInlineText(source.text, { maxBytes, maxLines }),
    stream: async () => new Blob([source.text]).stream(),
    readRange: async ({ start, end }) => {
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
  cacheKey: string,
  methods: Pick<
    ViewerResource,
    | "getDownload"
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
    cacheKey,
    identityKey: descriptor.identityKey,
    fileName: descriptor.downloadFileName,
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
    text += decoder.decode(value, { stream: true })
  }

  text += decoder.decode()
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
  if (maxLines != null && text.split("\n").length > maxLines) {
    throw tooLarge("lines")
  }
  return text
}

function tooLarge(reason: "bytes" | "lines") {
  return new ResourceError({
    kind: "too_large",
    tooLargeReason: reason,
    message: `Resource exceeds ${reason} limit.`,
  })
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}
