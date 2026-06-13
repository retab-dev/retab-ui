import {
  isResourceError,
  isViewerFormatError,
  ViewerFormatError,
  type ViewerFormatErrorMapperOptions,
} from "@/lib/viewer-errors"
import type {
  ViewerContentIdentity,
  ViewerContentPayload,
  ViewerContentText,
} from "@/lib/viewer-resource"

export const DEFAULT_MAX_BYTES = 1_000_000
export const DEFAULT_MAX_LINES = 10_000
export const MAX_TEXT_RESOURCE_CACHE_ENTRIES = 64

export interface TextViewerBounds {
  maxBytes?: number
  maxLines?: number
}

export type TextViewerTooLargeReason = "bytes" | "lines"
export type TextViewerBoundName = "maxBytes" | "maxLines"

export class TextViewerTooLargeError extends ViewerFormatError {
  readonly reason: TextViewerTooLargeReason

  constructor(reason: TextViewerTooLargeReason) {
    super({
      format: "text",
      kind: "bounds",
      message: `Text file exceeds ${reason} limit`,
    })
    this.name = "TextViewerTooLargeError"
    this.reason = reason
  }
}

export class TextViewerInvalidBoundsError extends ViewerFormatError {
  readonly boundName: TextViewerBoundName

  constructor(boundName: TextViewerBoundName) {
    super({
      format: "text",
      kind: "bounds",
      message: `${boundName} must be a positive integer`,
    })
    this.name = "TextViewerInvalidBoundsError"
    this.boundName = boundName
  }
}

export function toTextFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions = {
    kind: "load_failed",
    message: "Failed to load text.",
  }
): ViewerFormatError {
  if (isViewerFormatError(error)) return error
  return new ViewerFormatError({
    format: "text",
    kind: options.kind,
    message: options.message,
    cause: error,
  })
}

interface TextResource {
  promise: Promise<string>
  status: "pending" | "resolved" | "rejected"
  value?: string
  error?: unknown
}

const textResourceCache = new Map<string, TextResource>()

export type TextViewerContent = ViewerContentIdentity &
  ViewerContentPayload &
  ViewerContentText

function textViewerResourceKey({
  content,
  retryVersion,
  bounds,
}: {
  content: ViewerContentIdentity
  retryVersion: number
  bounds: Required<TextViewerBounds>
}) {
  return `${content.key}\0${retryVersion}\0${bounds.maxBytes}\0${bounds.maxLines}`
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

// Split into stable source lines. The prose viewer may wrap each source line
// into several visual lines, but highlighting and scroll APIs stay source-line
// based.
export function splitTextLines(text: string) {
  return text.split(/\r\n|[\n\r\u2028\u2029]/g)
}

export function readTextResource({
  content,
  retryVersion,
  bounds,
}: {
  content: TextViewerContent
  retryVersion: number
  bounds: Required<TextViewerBounds>
}) {
  const inlineText = inlineTextResource(content)
  if (inlineText != null) {
    assertTextWithinBounds(inlineText, bounds)
    return inlineText
  }

  const resourceKey = textViewerResourceKey({ content, retryVersion, bounds })
  const textResource = getTextResource({ content, resourceKey, bounds })

  if (textResource.status === "resolved") return textResource.value ?? ""
  if (textResource.status === "rejected") throw textResource.error

  throw textResource.promise
}

function inlineTextResource(content: ViewerContentPayload) {
  return content.payload.kind === "text" ? content.payload.text : null
}

function getTextResource({
  content,
  resourceKey,
  bounds,
}: {
  content: TextViewerContent
  resourceKey: string
  bounds: Required<TextViewerBounds>
}) {
  let textResource = textResourceCache.get(resourceKey)
  if (!textResource) {
    const nextResource: TextResource = {
      status: "pending",
      promise: readBoundedTextResource(content, bounds),
    }
    nextResource.promise.then(
      (value) => {
        nextResource.status = "resolved"
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
  content: ViewerContentText,
  bounds: Required<TextViewerBounds>
) {
  try {
    return await content.readText(bounds)
  } catch (error) {
    if (isResourceError(error)) throw error
    throw toTextFormatError(error)
  }
}

function lineCountOf(text: string) {
  return splitTextLines(text).length
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
