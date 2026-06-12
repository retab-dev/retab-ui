import { ResourceError, type ViewerResource } from "@/lib/viewer-resource"

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
  resource,
  retryVersion,
  bounds,
}: {
  resource: ViewerResource
  retryVersion: number
  bounds: Required<TextViewerBounds>
}) {
  return `${resource.identityKey}\0${retryVersion}\0${bounds.maxBytes}\0${bounds.maxLines}`
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
  resource,
  retryVersion,
  bounds,
}: {
  resource: ViewerResource
  retryVersion: number
  bounds: Required<TextViewerBounds>
}) {
  if (resource.source.kind === "text") {
    assertTextWithinBounds(resource.source.text, bounds)
    return resource.source.text
  }

  const resourceKey = textViewerResourceKey({ resource, retryVersion, bounds })
  const textResource = getTextResource({ resource, resourceKey, bounds })

  if (textResource.status === "fulfilled") return textResource.value ?? ""
  if (textResource.status === "rejected") throw textResource.error

  throw textResource.promise
}

function getTextResource({
  resource,
  resourceKey,
  bounds,
}: {
  resource: ViewerResource
  resourceKey: string
  bounds: Required<TextViewerBounds>
}) {
  let textResource = textResourceCache.get(resourceKey)
  if (!textResource) {
    const nextResource: TextResource = {
      status: "pending",
      promise: readBoundedTextResource(resource, bounds),
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
    textResource = nextResource
    textResourceCache.set(resourceKey, textResource)
    trimTextResourceCache()
  }
  return textResource
}

async function readBoundedTextResource(
  resource: ViewerResource,
  bounds: Required<TextViewerBounds>
) {
  try {
    return await resource.readText(bounds)
  } catch (error) {
    if (error instanceof ResourceError && error.kind === "too_large") {
      throw new TextViewerTooLargeError(error.tooLargeReason ?? "bytes")
    }
    throw error
  }
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
