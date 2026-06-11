export const DEFAULT_MAX_BYTES = 1_000_000
export const DEFAULT_MAX_LINES = 10_000
export const MAX_TEXT_RESOURCE_CACHE_ENTRIES = 64

export interface TextViewerBounds {
  maxBytes?: number
  maxLines?: number
}

export type TextViewerTooLargeReason = "bytes" | "lines"
export type TextViewerBoundName = "maxBytes" | "maxLines"

export class TextViewerTooLargeError extends Error {
  readonly reason: TextViewerTooLargeReason

  constructor(reason: TextViewerTooLargeReason) {
    super(`Text file exceeds ${reason} limit`)
    this.name = "TextViewerTooLargeError"
    this.reason = reason
  }
}

export class TextViewerInvalidBoundsError extends Error {
  readonly boundName: TextViewerBoundName

  constructor(boundName: TextViewerBoundName) {
    super(`${boundName} must be a positive integer`)
    this.name = "TextViewerInvalidBoundsError"
    this.boundName = boundName
  }
}

interface TextResource {
  promise: Promise<string>
  status: "pending" | "fulfilled" | "rejected"
  value?: string
  error?: unknown
}

const textResourceCache = new Map<string, TextResource>()

function textViewerResourceKey({
  src,
  retryVersion,
  bounds,
}: {
  src: string
  retryVersion: number
  bounds: Required<TextViewerBounds>
}) {
  return `${src}\0${retryVersion}\0${bounds.maxBytes}\0${bounds.maxLines}`
}

export function clearTextViewerResourceCacheForTests() {
  textResourceCache.clear()
}

export function resolvedTextViewerBounds({
  maxBytes = DEFAULT_MAX_BYTES,
  maxLines = DEFAULT_MAX_LINES,
}: TextViewerBounds = {}): Required<TextViewerBounds> {
  return {
    maxBytes: resolveTextViewerBound(maxBytes, "maxBytes"),
    maxLines: resolveTextViewerBound(maxLines, "maxLines"),
  }
}

export function assertTextWithinBounds(
  text: string,
  bounds: Required<TextViewerBounds>
) {
  if (new TextEncoder().encode(text).byteLength > bounds.maxBytes) {
    throw new TextViewerTooLargeError("bytes")
  }
  if (lineCountOf(text) > bounds.maxLines) {
    throw new TextViewerTooLargeError("lines")
  }
}

export function readTextResource({
  src,
  retryVersion,
  bounds,
}: {
  src: string
  retryVersion: number
  bounds: Required<TextViewerBounds>
}) {
  const resourceKey = textViewerResourceKey({ src, retryVersion, bounds })
  const resource = getTextResource({ src, resourceKey, bounds })

  if (resource.status === "fulfilled") return resource.value ?? ""
  if (resource.status === "rejected") throw resource.error

  throw resource.promise
}

function getTextResource({
  src,
  resourceKey,
  bounds,
}: {
  src: string
  resourceKey: string
  bounds: Required<TextViewerBounds>
}) {
  let resource = textResourceCache.get(resourceKey)
  if (!resource) {
    const nextResource: TextResource = {
      status: "pending",
      promise: fetchBoundedText(src, bounds),
    }
    nextResource.promise.then(
      (value) => {
        nextResource.status = "fulfilled"
        nextResource.value = value
      },
      (error) => {
        nextResource.status = "rejected"
        nextResource.error = error
      }
    )
    resource = nextResource
    textResourceCache.set(resourceKey, resource)
    trimTextResourceCache()
  }
  return resource
}

async function fetchBoundedText(
  src: string,
  bounds: Required<TextViewerBounds>
) {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Failed to load ${src}: ${response.status}`)

  const contentLength = response.headers.get("content-length")
  const contentByteLength = contentLength ? Number(contentLength) : null
  if (
    contentByteLength != null &&
    Number.isFinite(contentByteLength) &&
    contentByteLength > bounds.maxBytes
  ) {
    throw new TextViewerTooLargeError("bytes")
  }

  const text = await readBoundedResponseText(response, bounds.maxBytes)
  assertTextWithinBounds(text, bounds)
  return text
}

async function readBoundedResponseText(response: Response, maxBytes: number) {
  const body = response.body
  if (!body) {
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > maxBytes) throw new TextViewerTooLargeError("bytes")
    return new TextDecoder().decode(buffer)
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let receivedBytes = 0
  let text = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > maxBytes) {
      await reader.cancel()
      throw new TextViewerTooLargeError("bytes")
    }
    text += decoder.decode(value, { stream: true })
  }

  text += decoder.decode()
  return text
}

function lineCountOf(text: string) {
  return text.split("\n").length
}

function resolveTextViewerBound(value: number, boundName: TextViewerBoundName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TextViewerInvalidBoundsError(boundName)
  }
  return value
}

function trimTextResourceCache() {
  while (textResourceCache.size > MAX_TEXT_RESOURCE_CACHE_ENTRIES) {
    const firstKey = textResourceCache.keys().next().value
    if (firstKey === undefined) return
    textResourceCache.delete(firstKey)
  }
}
