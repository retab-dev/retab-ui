# Viewer Source Canonical Blueprint

This blueprint defines the canonical source model for the viewer family.

It exists because the viewer public APIs currently mix several different ideas:

- where bytes come from
- what the file is called
- what type of file it is
- whether the user can download it
- how the viewer should load it
- whether data is raw file data or already parsed viewer data

Those concerns are related, but they are not the same concern. A perfect viewer
system keeps the public API uniform without pretending that every format can be
loaded or rendered the same way.

The target is:

```txt
source declaration -> normalized resource capabilities -> format loader -> viewer state
```

The public API should converge on one source declaration model. The performance
critical work remains component-specific.

## Executive Decision

There is no universal loader that should power every viewer.

There should be a universal source and capability layer.

The universal layer answers:

- What is this resource?
- What is its stable identity?
- What should the user see as its name?
- Can it be downloaded?
- Can it be read as a Blob?
- Can it be read as an ArrayBuffer?
- Can it be read as text?
- Can it be streamed?
- Can it be read by byte range?
- How is cleanup handled?

The format loaders answer:

- How does PDF.js want this input?
- How should an image be decoded and retained?
- Should a text file be fully loaded or range streamed?
- Should CSV parsing stream rows or parse a whole Blob in a worker?
- How should XLSX and PPTX worker or renderer state be cached?
- Which decoded assets should be retained, evicted, or disposed?

Trying to force those into one generic loader would make the system slower,
less clear, and less correct. The right abstraction is not "one loader." The
right abstraction is "one source contract, many loaders."

## Current Evidence

The existing implementation already proves that loading is format-specific.

| Viewer                  | Current input                                 | Loading model                                                                                                                                                       | Cache/retention model                                                                                               | Why it cannot be generic                                                                           |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `PdfViewer`             | `source: UrlViewerSource \| BlobViewerSource` | URL resources pass the load URL to `pdfjs.getDocument`; Blob resources read bytes and pass `{ data }`; pages load lazily with `document.getPage(pageNumber)`        | document cache keyed by `resource.cacheKey`, consumer counts, LRU pruning, `PDFDocumentProxy.destroy()` on eviction | PDF has a document object, page objects, range-capable URL loading, and library-owned worker state |
| `ImageViewer`           | `source: UrlViewerSource \| BlobViewerSource` | read Blob/bytes through `ViewerResource`, sniff TIFF/native image, create `ImageBitmap`s                                                                            | frame source manager keyed by `resource.cacheKey`, leases, decoded bitmap cache, disposal timers                    | image performance is about decoded frame retention, not just fetched bytes                         |
| `DocxViewer`            | `source: UrlViewerSource \| BlobViewerSource` | read full ArrayBuffer from `ViewerResource`, pass to `docx-preview`, render imperatively into DOM                                                                   | ArrayBuffer promise cache keyed by `resource.cacheKey`; DOM render is owned by an effect                            | DOCX rendering is full-file, DOM-producing, and not streamable in this implementation              |
| `XlsxViewer`            | `source: UrlViewerSource \| BlobViewerSource` | read full ArrayBuffer from `ViewerResource`, parse workbook in a worker                                                                                             | `XlsxSourceCache` keyed by `resource.cacheKey`; viewer stores active sheet and scroll requests                      | spreadsheet performance is parsed workbook structure plus virtualized grid cells                   |
| `PptxViewer`            | `source: UrlViewerSource \| BlobViewerSource` | read full ArrayBuffer from `ViewerResource`, create renderer, render slides to canvas                                                                               | retained `PptxSource`, queued slide renders, slide bitmap cache, disposable renderer keyed by `cacheKey`            | PPTX performance is renderer lifetime plus canvas bitmap caching                                   |
| `CsvViewer`             | `source: CsvViewerSource`                     | URL resources stream rows from the response body; Blob resources parse in a worker when available; text resources parse synchronously; table sources bypass loading | effect-owned abort controller; worker fallback for Blob parsing; no loaded table cache yet                          | CSV has real streaming semantics and parsed-table semantics                                        |
| `TextViewer`            | source descriptor with URL or inline text     | bounded full text load for URL; direct bounded read for inline text                                                                                                 | resource cache keyed by URL, retry version, and bounds                                                              | source-linked text needs all lines addressable, not FileViewer's incremental text strategy         |
| `FileViewer` text route | URL descriptor                                | byte range loading with stream/full modes                                                                                                                           | mode-aware text loader cache, abortable shared requests                                                             | large text/log preview requires incremental rendering; JSON may need full mode                     |

The conclusion is mechanical: the source boundary can be shared, but the loader
must stay per format.

## Terms

Use these words precisely.

| Term           | Meaning                                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`       | Public declaration from the caller. It says where the bytes or text come from and what metadata the caller knows.                               |
| `descriptor`   | Synchronous normalized metadata used for routing, display, reset keys, and default download naming.                                             |
| `resource`     | Runtime capability object derived from a source. It can read Blob, bytes, text, stream, range, or create object URLs when supported.            |
| `loader`       | Format-specific module that transforms a resource into viewer-ready data.                                                                       |
| `viewer state` | Component state needed to render and interact with the loaded document.                                                                         |
| `asset`        | A decoded or parsed object that must be retained or disposed, such as `PDFDocumentProxy`, `ImageBitmap`, `PptxSource`, or parsed workbook data. |
| `identityKey`  | Caller/content identity for source-linked behavior and high-level equality.                                                                     |
| `cacheKey`     | Loaded-resource lifecycle key. It includes descriptor inputs plus payload identity needed to prevent stale bytes.                               |
| `download`     | User-facing file export behavior. It may be a URL, object URL, generated Blob, or disabled state.                                               |

## Non-Negotiables

1. Public file viewers use one source vocabulary.
2. `src`, `value`, `bytes`, `fileName`, and `downloadName` do not appear as
   parallel public entrypoints on canonical viewers.
3. The source model does not claim performance semantics it cannot provide.
4. Parsed viewer data is not confused with file source data.
5. Every source has a stable identity.
6. Every source has a deterministic display name.
7. Every source has a deterministic download filename.
8. Download behavior is explicit and derived from source capabilities.
9. Object URLs are created and revoked in one place.
10. Format loaders own parsing, worker use, virtualized state, and disposal.
11. The source layer knows nothing about PDF pages, image frames, spreadsheet
    cells, presentation slides, CSV rows, or text line ranges.
12. The viewer layer does not re-infer file names, MIME types, or download URLs.
13. Cache keys include every input that changes loaded output.
14. Aborts are owned by the loader or resource operation that starts work.
15. A source change cannot let stale async work render into the new viewer.
16. The design works for URL, Blob, and inline text without adding ad hoc props.

## Canonical Public Source Model

The canonical source should have three variants.

```ts
export type ViewerSource = UrlViewerSource | BlobViewerSource | TextSource

export interface UrlViewerSource {
  kind: "url"
  url: string
  fileName?: string
  mimeType?: string
  downloadUrl?: string
  identityKey?: string
}

export interface BlobViewerSource {
  kind: "blob"
  blob: Blob
  identityKey: string
  fileName?: string
  mimeType?: string
  downloadUrl?: string
}

export interface TextSource {
  kind: "text"
  text: string
  fileName?: string
  mimeType?: string
  identityKey?: string
}
```

### Why `blob`, Not `bytes`

The current source model has `bytes: ArrayBuffer | Uint8Array | Blob`.

That is too loose for the canonical model.

`Blob` is the better boundary:

- It has a stable `size`.
- It has a `type`.
- It supports `slice`, which gives partial-read semantics for local data.
- It can produce `arrayBuffer()`.
- It can produce `text()`.
- It can back an object URL for download.
- It is accepted by several browser APIs.
- It avoids repeating normalization logic in every viewer.

`ArrayBuffer` and `Uint8Array` can still be accepted by small helper functions,
but not as the public canonical source kind:

```ts
export function blobSource(
  bytes: Blob | ArrayBuffer | Uint8Array,
  metadata: SourceMetadata & { identityKey: string }
): BlobViewerSource
```

That helper normalizes bytes once:

```ts
const blob =
  bytes instanceof Blob
    ? bytes
    : new Blob([bytes], { type: metadata?.mimeType ?? "" })
```

The public type remains simple:

```ts
{
  kind: "blob"
  blob
  fileName
  mimeType
}
```

### Why Parsed Data Is Not A `ViewerSource`

CSV accepts pre-parsed `CsvTable` values through a CSV-specific table source.

That is useful, but it is not a file source. It is already parsed viewer data,
so it must not be promoted into the universal `ViewerSource` union.

Putting parsed data into the universal source model would pollute every viewer:

- PDF does not have a generic parsed data shape.
- Image parsed data would be frame descriptors and decoded bitmaps.
- XLSX parsed data would be workbook/sheet/cell structures.
- PPTX parsed data would be renderer state or slide descriptions.
- DOCX parsed data would be rendered DOM or document model.

Parsed data belongs to viewer-specific source unions.

For example:

```ts
export type CsvViewerSource =
  | UrlViewerSource
  | BlobViewerSource
  | TextSource
  | {
      kind: "table"
      table: CsvTable
      fileName?: string
      identityKey?: string
      dialect?: CsvDialect
    }
```

But `FileViewer` and shared viewer infrastructure should only accept
file-like `ViewerSource` variants unless a route explicitly supports a
viewer-specific source variant.

## Descriptor Model

The descriptor is synchronous. It contains only metadata that can be known
without asynchronous loading.

```ts
export interface ViewerDescriptor {
  source: ViewerSource
  category: FileCategory
  identityKey: string
  displayName: string
  fileName: string
  mimeType?: string
}
```

Rules:

- `descriptor.source` is the original source declaration.
- `descriptor.category` is detected from `fileName`, MIME type, or override.
- `descriptor.identityKey` is caller/content identity.
- `descriptor.displayName` is what the viewer header shows.
- `descriptor.fileName` is the canonical file name for download and format
  hints.
- `descriptor` does not expose load URLs, download URLs, object URLs, streams,
  ranges, blobs, or text reads. Those are resource capabilities.

### Default Names

Defaults should be deterministic and boring.

For URL:

```ts
displayName = source.fileName ?? source.url
fileName = source.fileName ?? extractName(source.url)
```

For Blob:

```ts
displayName = source.fileName ?? "file"
fileName = source.fileName ?? "file"
```

For text:

```ts
displayName = source.fileName ?? "text.txt"
fileName = source.fileName ?? "text.txt"
```

### Identity Keys

Identity must be stable enough for source-linked behavior and high-level
equality. Loaded caches use `resource.cacheKey`, not `identityKey` alone.

Defaults:

```ts
url identity = `url:${url}`
blob identity = explicit identityKey required for long-lived correctness
text identity = `text:${text}`
```

Blob identity is the hard case. A default like `blob:${blob.size}:${blob.type}`
is not unique enough. Two different files can share size and type.

The canonical rule should be:

```ts
BlobViewerSource.identityKey is required.
```

Tests should document that callers must pass an explicit identity key for Blob
sources. Convenience helpers may normalize `ArrayBuffer` and `Uint8Array` into
`Blob`, but they should not invent content identity from weak signals such as
size/type.

The resource layer may still include Blob object identity in `cacheKey`. That is
not content identity; it is a lifecycle guard so a caller who accidentally reuses
an `identityKey` for different Blob objects cannot receive stale loaded bytes.

## Resource Capability Model

The resource layer converts a `ViewerSource` into operations.

It should not parse file formats.

```ts
export interface ViewerResource {
  readonly source: ViewerSource
  readonly descriptor: ViewerDescriptor
  readonly cacheKey: string
  readonly identityKey: string
  readonly fileName: string
  readonly mimeType?: string

  getDirectLoad(): DirectLoadCapability
  getOriginalDownload(): ViewerDownloadAction
  readBlob(options?: ResourceReadOptions): Promise<Blob>
  readArrayBuffer(options?: ResourceReadOptions): Promise<ArrayBuffer>
  readText(options?: TextReadOptions): Promise<string>
  stream?(options?: ResourceReadOptions): Promise<ReadableStream<Uint8Array>>
  readRange?(
    range: ByteRange,
    options?: ResourceReadOptions
  ): Promise<ByteRangeResult>
  createObjectUrl?(): ResourceObjectUrl
}

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

export interface ResourceObjectUrl {
  url: string
  revoke(): void
}
```

`getDirectLoad()` is intentionally separate from download:

```ts
export type DirectLoadCapability =
  | { kind: "url"; url: string }
  | { kind: "none" }
```

### URL Resource Behavior

For URL sources:

```ts
readBlob() -> fetch(url).blob()
readArrayBuffer() -> fetch(url).arrayBuffer()
readText() -> bounded fetch and decode
stream() -> response.body when available
readRange() -> fetch(url, { headers: { Range } })
download -> href(downloadUrl ?? url)
objectUrl -> usually unnecessary
```

Rules:

- `downloadUrl` is only for user download.
- `url` is the load URL.
- If a signed download URL differs from load URL, keep both explicit.
- Fetch errors normalize to resource errors, not generic thrown strings.
- Range support is optimistic. A server may ignore Range and return `200`.
  Callers must handle that.

### Blob Resource Behavior

For Blob sources:

```ts
readBlob() -> blob
readArrayBuffer() -> blob.arrayBuffer()
readText() -> bounded blob read
stream() -> blob.stream()
readRange() -> blob.slice(start, end + 1).arrayBuffer()
download -> href(downloadUrl) if provided, otherwise generated object URL
objectUrl -> URL.createObjectURL(blob), explicitly revoked
```

Rules:

- Object URL ownership must live in one hook or resource helper.
- Generated object URLs are not identity keys.
- Generated object URLs must not be stored in long-lived caches.
- Blob reads are abort-limited. Browser `blob.arrayBuffer()` is not universally
  cancellable once started, so callers should avoid starting huge reads unless
  the loader policy allows it.

### Text Resource Behavior

For text sources:

```ts
readBlob() -> new Blob([text], { type: mimeType ?? "text/plain" })
readArrayBuffer() -> TextEncoder encoded bytes
readText() -> bounded inline text
stream() -> optional synthetic stream, rarely needed
readRange() -> optional encoded byte slice, usually not needed
download -> text or generated Blob
```

Rules:

- Inline text has no network failure state.
- Inline text can fail bounds validation.
- Inline text download is generated locally.
- Inline text identity defaults to exact text. For very large text, callers may
  pass `identityKey`.

## Source Error Model

Do not let each viewer invent different error shapes for source access.

```ts
export type ResourceErrorKind =
  | "fetch_failed"
  | "http_error"
  | "aborted"
  | "too_large"
  | "unsupported_capability"
  | "unknown"

export class ResourceError extends Error {
  readonly kind: ResourceErrorKind
  readonly status?: number
  readonly cause?: unknown
}

export type ViewerFormatErrorKind =
  | "bounds"
  | "decode_failed"
  | "disposed"
  | "index_out_of_range"
  | "load_failed"
  | "parse_failed"
  | "render_failed"
  | "unknown"

export class ViewerFormatError extends Error {
  readonly format: string
  readonly kind: ViewerFormatErrorKind
  readonly cause?: unknown
}
```

Resource errors stay resource errors. Format loaders should not hide transport,
abort, bounds, or capability failures behind parse/render names.

Examples:

```ts
ResourceError("http_error")
ViewerFormatError({ format: "pdf", kind: "parse_failed" })
ImageDecodeError({ kind: "decode_failed", cause: Error("bad image bytes") })
TextViewerTooLargeError("bytes")
```

Decode, parse, render, and worker-protocol failures are format errors, not
resource errors. The resource layer owns transport, bounds, abort, and capability
failures only.

## Download Model

Download is a capability, not a prop sprinkled across viewers.

The canonical viewer toolbar asks:

```ts
const download = resource.getOriginalDownload()
```

Rendering rules:

- `href` action renders a normal anchor.
- `blob` action creates an object URL at click time.
- `text` action creates a Blob and object URL at click time.
- Viewers omit the button when no action should be offered.

```tsx
<ViewerDownloadButton action={resource.getOriginalDownload()} />
```

The download button owns object URL creation, click dispatch, and immediate
revocation for generated downloads.

No leaf viewer should separately decide:

- href
- download filename
- object URL lifecycle
- whether inline text is downloadable

## Loader Model

Every format gets its own loader.

The loader accepts a resource and returns viewer-ready data.

```ts
export interface ViewerLoader<Loaded> {
  load(resource: ViewerResource, options: LoaderOptions): Promise<Loaded>
  retain?(resourceKey: string, loaded: Loaded): LoaderRelease
  clear?(): void
}

export interface LoaderOptions {
  signal?: AbortSignal
}

export type LoaderRelease = () => void
```

This is a shape, not necessarily a shared runtime class. Some viewers are easier
to read with direct functions. The invariant is the same: loaders depend on
resources, not loose public props.

### PDF Loader

Target shape:

```ts
getPdfDocument(resource: ViewerResource): Promise<PDFDocumentProxy>
getPdfPage(document: PDFDocumentProxy, pageNumber: number): Promise<PDFPageProxy>
retainPdfDocument(resource.cacheKey, document)
releasePdfDocument(resource.cacheKey, document)
```

Implementation notes:

- URL resource passes `resource.getDirectLoad().url` directly to PDF.js to
  preserve native URL/range/worker behavior.
- Blob resource reads bytes and passes `{ data: Uint8Array }` to PDF.js.
- Cache key must include `resource.cacheKey`.
- Page cache stays a WeakMap by document.
- Document eviction must call `destroy()`.

PDF is a good example where capability abstraction must not destroy library
performance. If PDF.js can use URL range loading internally, do not force
`readArrayBuffer()` first.

### Image Loader

Target shape:

```ts
getImageFrameSource(resource: ViewerResource): Promise<FrameSource>
retainImageFrameSource(resource.cacheKey, source)
```

Implementation notes:

- URL resource can fetch and inspect content type.
- Blob resource can inspect `blob.type` and read enough bytes for TIFF sniffing.
- Native image path should prefer Blob and `createImageBitmap`.
- TIFF path needs ArrayBuffer and worker decode.
- Decoded bitmap cache stays image-specific.
- Frame leases stay image-specific.

### DOCX Loader

Target shape:

```ts
getDocxBuffer(resource: ViewerResource): Promise<ArrayBuffer>
```

Implementation notes:

- DOCX reads a full ArrayBuffer through `ViewerResource`.
- `docx-preview` receives ArrayBuffer for deterministic JSZip behavior.
- Cache key is `resource.cacheKey`.
- Rendering remains effect-owned because `docx-preview` mutates the DOM.

### XLSX Loader

Target shape:

```ts
getXlsxSource(resource: ViewerResource): Promise<XlsxSource>
```

Implementation notes:

- Reads full ArrayBuffer.
- Parses in worker.
- Cache key is `resource.cacheKey`.
- Worker transfer should transfer the buffer.
- Parsed workbook cache stays XLSX-specific.

### PPTX Loader

Target shape:

```ts
getPptxSource(resource: ViewerResource): Promise<PptxSource>
```

Implementation notes:

- Reads full ArrayBuffer.
- Creates PPTX renderer.
- Retains renderer source while mounted.
- Queues slide rendering.
- Caches slide bitmaps.
- Disposes renderer on cache eviction.

### CSV Loader

Target shape:

```ts
type CsvViewerSource =
  | UrlViewerSource
  | BlobViewerSource
  | TextSource
  | { kind: "table"; table: CsvTable; fileName?: string }
```

For source input:

```ts
streamCsvResource(resource, dialect, callbacks, signal)
```

Implementation notes:

- URL source should prefer response body streaming.
- Blob source can parse in worker or stream in main thread.
- Text source can parse synchronously for small text, but bounds policy should
  still exist.
- Parsed table input bypasses resource loading completely.
- Parsed table input is a CSV-specific fast path, not a universal file source.

### Text Loader

There are two text use cases and they should remain separate unless a later pass
proves they can be unified cleanly.

#### Source-Linked `TextViewer`

Purpose:

Render a bounded whole text document where every line is addressable for source
linking.

Loader:

```ts
readBoundedText(resource, bounds, retryVersion)
```

Properties:

- whole text is loaded
- byte limit enforced
- line limit enforced
- retry version participates in resource key
- inline text is synchronous except bounds validation
- all rendered lines are addressable

#### Large Text Route In `FileViewer`

Purpose:

Preview large text/log/JSON files.

Loader:

```ts
loadFirstTextChunk(resource, mode, signal)
loadNextTextChunk(resource, mode, signal)
```

Properties:

- range loading when supported
- incremental decode
- virtualized rendering
- mode-aware cache keys
- full mode for JSON when needed
- stream mode for logs/text

These two loaders can share low-level resource capabilities and abort helpers.
They should not be forced into the same UI component.

## Canonical TextViewer API

`TextViewer` should be the pilot implementation for the canonical source model.

```ts
export type TextDocumentSource = UrlViewerSource | BlobViewerSource | TextSource

export interface TextViewerProps extends TextViewerBounds {
  source: TextDocumentSource
  className?: string
  toolbar?: boolean
  highlight?: TextLineRange | null
  bare?: boolean
}
```

This is intentionally descriptor-first and adapter-free.

Forbidden public props:

```ts
src?: string
value?: string
downloadName?: string
downloadFileName?: string
fileName?: string
mimeType?: string
```

Those belong inside `source`.

### TextViewer Source Semantics

`source.kind === "url"`:

- may suspend while fetching
- may show loading state
- may show fetch error state
- may show retry
- may download via `downloadUrl ?? url`
- uses `source.url` as default identity

`source.kind === "blob"`:

- may suspend while reading
- cannot show HTTP fetch error
- may show decode or bounds error
- may download via generated object URL unless `downloadUrl` exists
- should use explicit `identityKey` when caller can replace Blob contents

`source.kind === "text"`:

- does not fetch
- may show bounds error
- should not show retry
- may download generated text Blob
- uses exact text as default identity unless `identityKey` exists

### TextViewer Internal Modules

Target shape:

```txt
registry/new-york-v4/ui/text-viewer.tsx
registry/new-york-v4/ui/text-viewer-resource.ts
registry/new-york-v4/ui/text-viewer-ranges.ts
registry/new-york-v4/ui/text-viewer-layout.ts
registry/new-york-v4/ui/text-viewer-chrome.tsx
registry/new-york-v4/ui/viewer-download.tsx
```

Responsibilities:

- `text-viewer.tsx`: public component, ref, state composition, line rendering
- `text-viewer-resource.ts`: source to bounded text resource
- `text-viewer-ranges.ts`: pure range normalization and membership
- `text-viewer-layout.ts`: pure scroll geometry and DOM helpers
- `text-viewer-chrome.tsx`: frame, toolbar, fallback, error, download button
- `viewer-download.tsx`: React-only object URL lifecycle for download anchors

The current implementation follows this split. Future viewers should reuse the
same source and resource model before adding format-specific loading code.

### TextViewer State Model

Use exact states.

```ts
type TextViewerStatus =
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "too_large"; reason: "bytes" | "lines" }
  | { status: "invalid_bounds"; boundName: "maxBytes" | "maxLines" }
  | { status: "error"; canRetry: boolean }
```

Suspense and error boundaries can remain implementation details, but visible UI
must map to those states.

Rules:

- URL pending maps to `loading`.
- URL failure maps to `error` with `canRetry: true`.
- Blob read failure maps to `error` with `canRetry: false` unless retrying the
  same read is meaningful.
- Text bounds failure maps to `too_large`.
- Invalid props map to `invalid_bounds`.
- Inline text never maps to `loading`.

### TextViewer Cache Key

The cache key must include every input that changes loaded text.

```ts
resourceKey = [
  resource.cacheKey,
  retryVersion,
  bounds.maxBytes,
  bounds.maxLines,
].join("\0")
```

Do not key URL text by URL alone if bounds differ.

Do not key Blob text by size/type alone.

Do not key inline text by filename.

### TextViewer Retry

Retry is a source capability consequence.

Rules:

- URL source fetch errors are retryable.
- Blob source read errors are usually not retryable unless the error came from a
  transient resource operation.
- Inline text errors are not retryable.
- Bounds errors are not retryable.
- Changing `source.identityKey` resets the boundary.
- Same-source retry increments `retryVersion`.

### TextViewer Download

TextViewer should not receive a download prop.

It asks the resource:

```ts
const download = resource.getOriginalDownload()
```

Rules:

- URL text downloads via href.
- Blob text downloads via object URL.
- Inline text downloads via generated Blob.
- Download filename is `descriptor.fileName`.
- If toolbar is hidden, no download action is shown.
- Error UI may still show download when source is downloadable.

## FileViewer API After Source Canonicalization

`FileViewer` should stay a router.

```ts
export interface FileViewerProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}
```

Rules:

- `FileViewer` creates a descriptor and resource.
- `FileViewer` routes by descriptor category.
- `FileViewer` does not fetch directly except through format loaders.
- Leaf viewers should gradually accept `source` or `resource`, not `src`.
- Until leaf migration is complete, `FileViewer` may adapt `UrlViewerSource` to
  existing `src` leaf props internally. That adapter must not leak publicly.
- Non-URL sources route only to viewers whose loaders can consume them.

## Migration Strategy

Do not migrate every viewer at once.

The ideal sequence:

1. Replace `BytesViewerSource` with `BlobViewerSource` in the shared source
   model.
2. Add `ViewerResource` construction helpers.
3. Add a canonical `ViewerDownloadButton` that consumes `ViewerDownloadAction`.
4. Refactor `TextViewer` to consume `ViewerResource`.
5. Add Blob source support to `TextViewer`.
6. Move TextViewer chrome to `text-viewer-chrome.tsx`.
7. Move TextViewer resource loading to resource capabilities.
8. Update TextViewer tests to cover URL, Blob, text, download, retry, and bounds.
9. Migrate `CsvViewer` to a single `source` prop, while keeping parsed table as
   a CSV-specific source variant.
10. Migrate `ImageViewer` to `ViewerSource` because image Blob support maps
    naturally to the existing frame source manager.
11. Migrate `XlsxViewer` to `ViewerSource` by reading ArrayBuffer from resource.
12. Evaluate PDF last, because URL-based PDF.js loading may have performance
    advantages that should not be lost.
13. Remove internal leaf `src` adapters when every leaf accepts source/resource.
14. Update stale blueprints and examples so no docs teach the old API.

## TextViewer Implementation Blueprint

This section is the immediate next iteration target.

### Target Files

```txt
registry/new-york-v4/lib/viewer-source.ts
registry/new-york-v4/lib/viewer-resource.ts
registry/new-york-v4/ui/text-viewer.tsx
registry/new-york-v4/ui/text-viewer-resource.ts
registry/new-york-v4/ui/text-viewer-chrome.tsx
registry/new-york-v4/ui/viewer-download.tsx
registry/new-york-v4/ui/text-viewer-ranges.ts
registry/new-york-v4/ui/text-viewer-layout.ts
tests/text-viewer.test.tsx
```

### `viewer-source.ts`

Owns only types and synchronous metadata.

Should export:

```ts
ViewerSource
UrlViewerSource
BlobViewerSource
TextSource
ViewerDescriptor
resolveViewerDescriptor
detectCategory
extensionOf
extractName
```

Should not export:

- React hooks
- object URL helpers
- fetch helpers
- parser helpers
- test-only cache clearing

### `viewer-resource.ts`

Owns runtime source capabilities.

Should export:

```ts
createViewerResource(source: ViewerSource)
ViewerResource
ViewerDownloadAction
ResourceError
ViewerFormatError
readBoundedText
```

Rules:

- It can import from `viewer-source.ts`.
- It cannot import from any viewer component.
- It cannot know about PDF, image, DOCX, XLSX, PPTX, CSV, or line ranges.
- It owns resource-level error normalization.

### `viewer-download.tsx`

Owns React-only download presentation.

Should export:

```ts
ViewerDownloadButton
```

Rules:

- It may call `URL.createObjectURL`.
- It must revoke object URLs after generated download clicks.
- It can import `ViewerDownloadAction` from `viewer-download.ts`.
- `viewer-resource.ts` must never import React to support it.

### `text-viewer-resource.ts`

Owns text-specific loading policy.

Should export:

```ts
TextViewerBounds
TextViewerTooLargeError
TextViewerInvalidBoundsError
readTextResource
resolvedTextViewerBounds
clearTextViewerResourceCacheForTests
```

Target resource input:

```ts
readTextResource({
  resource,
  retryVersion,
  bounds,
})
```

Not:

```ts
readTextResource({ src, retryVersion, bounds })
```

### `text-viewer-chrome.tsx`

Owns UI frame and local states.

Should export:

```ts
TextViewerFrame
TextViewerToolbar
TextViewerFallback
TextViewerErrorState
```

Rules:

- No text loading.
- No range normalization.
- No line rendering.
- Download button consumes `ViewerDownloadAction`.

### `text-viewer.tsx`

Owns composition.

Should do:

- create resource from source
- resolve bounds
- manage retry version
- read text resource
- compute lines
- expose imperative scroll handle
- render frame, toolbar, lines

Should not do:

- create object URLs directly
- fetch directly
- infer download filenames
- parse source metadata
- expose cache helpers

## Acceptance Tests

The next TextViewer pass is complete only when these behaviors are tested.

### Public API Tests

- `TextViewerProps` requires `source`.
- Passing old `src` prop is a TypeScript error in type tests or caught by
  implementation boundary search.
- Passing old `value` prop is not supported.
- Passing old `downloadName` or `downloadFileName` is not supported.

### URL Source Tests

- Renders bounded text from URL.
- Shows fallback while URL is pending.
- Shows retry on URL fetch failure.
- Retry refetches the same URL.
- Changing URL source clears the error.
- Download link uses `downloadUrl` when provided.
- Download link falls back to `url`.
- Download filename uses `source.fileName`.
- Cache key includes bounds.

### Blob Source Tests

- Renders text from Blob.
- Enforces byte limit.
- Enforces line limit.
- Download uses generated object URL.
- Object URL is revoked on unmount or source change.
- Identity key controls cache invalidation.

### Inline Text Source Tests

- Renders inline text synchronously.
- Does not show loading.
- Does not show retry.
- Enforces byte limit.
- Enforces line limit.
- Download uses generated Blob.
- `identityKey` overrides exact text identity.

### Layout Tests

- Normalizes reversed ranges.
- Clamps out-of-bounds ranges.
- Ignores fully invalid ranges.
- Scrolls fitting ranges to center.
- Top-aligns oversized ranges.
- Exposes viewport element.

### Boundary Tests

- Component module does not contain fetch.
- Component module does not contain object URL creation.
- Resource module does not import React components.
- Range module does not import React.
- Layout pure helpers are tested without rendering the full viewer.

## Naming Standard

Use one vocabulary.

| Concept              | Canonical name    |
| -------------------- | ----------------- |
| Public input         | `source`          |
| Runtime capability   | `resource`        |
| Synchronous metadata | `descriptor`      |
| Stable identity      | `identityKey`     |
| User-visible name    | `displayName`     |
| Download filename    | `fileName`        |
| Download behavior    | `download`        |
| Network URL          | `url`             |
| Generated object URL | `objectUrl`       |
| Text content         | `text`            |
| Text lines array     | `textLines`       |
| Scroll container     | `viewportElement` |
| Retry nonce          | `retryVersion`    |
| Bounds object        | `bounds`          |
| Resource lifecycle   | `cacheKey`        |

Forbidden aliases in canonical files:

- `src` as public API
- `value` as text source
- `downloadName`
- `fileName` as a top-level viewer prop
- `bytes` as a source kind
- `data` as a universal source
- `resourceKey` when the concept is already called `cacheKey`

Internal leaf viewers may still use `src` until migrated. Canonical public
components should not.

## Performance Rules

1. Never force URL PDF loading through ArrayBuffer unless measured and accepted.
2. Never read a whole large text file when range preview is intended.
3. Never parse XLSX, PPTX, DOCX, or TIFF on every render.
4. Never create object URLs during render.
5. Never use generated object URLs as cache identity.
6. Never keep decoded image bitmaps without an eviction policy.
7. Never keep PDF documents without destroy-on-evict.
8. Never let one aborted subscriber abort another active subscriber.
9. Never permanently cache failed loads that should be retryable.
10. Never use filename alone as a cache key.
11. Prefer streaming for CSV URL sources.
12. Prefer worker parsing for expensive binary formats where current code
    already uses workers.

## Why This Is Transferable

The transferable part is not the loader implementation. The transferable part is
the contract.

Every viewer can converge on:

```ts
source -> descriptor -> resource -> loader -> state
```

But each viewer keeps its own loader:

```txt
PDF: resource -> PDFDocumentProxy -> PDFPageProxy
Image: resource -> FrameSource -> ImageBitmap
DOCX: resource -> ArrayBuffer -> docx-preview DOM
XLSX: resource -> ArrayBuffer -> worker -> workbook source
PPTX: resource -> ArrayBuffer -> renderer -> slide bitmaps
CSV: resource/table -> streamed rows -> grid
Text: resource -> bounded text -> addressable lines
File text preview: resource -> range chunks -> virtual rows
```

This gives the system a perfect public shape without flattening the real
differences that make each viewer fast.

## Definition Of Done

The source architecture is canonical when:

- `ViewerSource` has URL, Blob, and text variants.
- No canonical viewer public API exposes parallel `src` or `value` props.
- Download behavior is derived from `ViewerDownloadAction`.
- Object URL lifecycle is centralized.
- TextViewer supports URL, Blob, and text sources.
- TextViewer has no public legacy adapters.
- TextViewer loading is resource-based, not URL-string based.
- CSV exposes one public `source` prop and keeps parsed table input as a
  CSV-specific source variant.
- FileViewer can route non-URL sources only to supported viewers.
- Leaf viewers no longer re-infer names or download filenames.
- Every cache key is based on `identityKey` plus loader-specific inputs.
- Stale async work cannot render into a newer source.
- Generated registry artifacts match the source.
- Old blueprints and examples no longer teach stale APIs.

The goal is not to remove format-specific logic. The goal is to put it where it
belongs, behind one rigorous source boundary.

# Superseded Download Note

Download behavior now uses `ViewerDownloadAction` and
`ViewerResource.getOriginalDownload()`. Older mentions of
`DownloadCapability`, `getDownload()`, `ViewerDownloadAnchor`, or
`useDownloadHref()` in this document are historical design notes, not the
current runtime contract.
