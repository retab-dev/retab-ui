# Viewer System Source Of Truth Blueprint

This is the only active blueprint for the viewer system.

All older viewer, file viewer, thumbnail, source, download, error, PDF, image,
PPTX, CSV, text, and parse-viewer blueprints are superseded by this document.
Do not revive them. Do not implement from historical blueprint text.

## Goal

The viewer system must have one canonical model:

```txt
ViewerSource
  -> ViewerDescriptor
  -> ViewerResource
  -> format loader
  -> viewer state
  -> viewer UI

ViewerResource
  -> ViewerDownloadAction
  -> ViewerDownloadControl

ResourceError | ViewerFormatError | ViewerStateError
  -> ViewerErrorInfo
  -> ViewerErrorState
```

The target is a hard cutover, not a compatibility layer.

The standard is:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- consistent names
- no compatibility residue
- no duplicated lifecycle policy
- no accidental viewer-local abstractions

## Current Verdict

The canonical viewer model is now implemented as the active system.

The resource, download, error, FileViewer routing, and page-markdown download
boundaries follow the target shape. This does not mean every viewer is frozen
forever; it means future migrations should extend the canonical model instead
of introducing parallel source, download, cache, or error APIs.

What is strong:

- `ViewerResource` has the canonical target surface.
- The live resource vocabulary is clear:
  `content`, `originalDownload`, `directUrl`, `payload`, `readBytes`,
  `readStream`.
- The old resource vocabulary is forbidden in live code.
- URL PDF loading can stay fast through `resource.content.directUrl`.
- Blob/text sources can stay lazy and memory-conscious.
- Format loaders now have one shared resource contract.
- The canonical blueprint is the single documentation source.

What is now closed:

- FileViewer text, markdown, and HTML route internals use `ViewerResource`
  rather than raw URL strings as source identity.
- Text/markdown/HTML route-local caches use `resource.content.key`.
- Route-local reads use `resource.content.readText`,
  `resource.content.readBytes`, or `resource.content.readRange`.
- Route-local downloads use `resource.originalDownload`.
- Page-markdown downloads use `ViewerDownloadAction` and
  `triggerViewerDownload`; object URL and anchor click mechanics remain in
  `ui/viewer-download.tsx`.
- Whole-tree TypeScript health is an acceptance requirement for calling the
  system complete. If unrelated files are red, the viewer system may be usable
  but it is not in its final verified state.

What remains intentionally local:

- Format caches keep their own ownership rules because PDF, image, PPTX, DOCX,
  XLSX, CSV, text, and thumbnails have different disposal and retry lifecycles.
- Format-specific error creation stays near the format loader, but all
  user-facing projection flows through canonical viewer error types and UI.
- DOM attributes may still use browser-native names such as `src`, `href`, and
  `download` at the DOM boundary.

Future work should be a local improvement only when it removes real duplication
or closes a discovered bug. Do not start another broad resource rewrite.

## Non-Negotiable Rule

There must be exactly one live API for source/resource/download/error behavior.

Forbidden in live code:

```txt
getDirectLoad
DirectLoadCapability
getOriginalDownload
getInlineText
getBlob
readArrayBuffer
resource.stream(...)
legacy source adapters
parallel src/value props
viewer-local object URL download logic
viewer-local error projection policy
```

Allowed only in this document when describing what must be deleted.

## Public Viewer API

Every canonical viewer receives one data entrypoint named `source`.

Examples:

```tsx
<PdfViewer source={{ kind: "url", url, fileName, mimeType, downloadUrl }} />
<ImageViewer source={{ kind: "blob", blob, identityKey, fileName }} />
<TextViewer source={{ kind: "text", text, fileName: "notes.txt" }} />
<CsvViewer source={{ kind: "url", url, fileName: "data.csv" }} />
<DocxViewer source={{ kind: "blob", blob, identityKey, fileName }} />
<XlsxViewer source={{ kind: "url", url, fileName: "workbook.xlsx" }} />
<PptxViewer source={{ kind: "url", url, fileName: "deck.pptx" }} />
```

Do not add sibling data props such as `src`, `url`, `value`, `text`, `blob`,
`bytes`, `downloadName`, or `mimeType` when they duplicate `source`.

Viewer-specific interaction props are fine:

```txt
toolbar
bare
scale
defaultScale
onScaleChange
activeCell
renderPageOverlay
defaultSheetIndex
onSheetChange
```

## Source Model

Canonical source types:

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

Rules:

- URL sources preserve direct library loading.
- Blob sources require explicit identity.
- Text sources are distinct from file bytes.
- Parsed tables are viewer data, not `ViewerSource`.
- DOM attributes may still use browser names such as `href`, `src`, and
  `download` at the DOM boundary only.

## Descriptor Model

`ViewerDescriptor` normalizes presentation metadata.

It answers:

```txt
What category is this file?
What should the user see?
What filename should downloads use?
What MIME type is known?
What identity should key presentation behavior?
```

Rules:

- Descriptor resolution is centralized.
- Viewers do not infer filenames locally.
- Viewers do not infer MIME types locally.
- Format routing uses descriptor category.
- Metadata-only changes must not reload expensive content.

## Resource Model

`ViewerResource` is the canonical capability object.

Final live interface:

```ts
export type ViewerResourcePayload =
  | { kind: "url"; url: string }
  | { kind: "blob"; blob: Blob }
  | { kind: "text"; text: string }

export interface ViewerResourceContent {
  readonly key: string
  readonly sourceKind: ViewerSource["kind"]
  readonly directUrl: string | null
  readonly payload: ViewerResourcePayload

  readBlob(options?: ResourceReadOptions): Promise<Blob>
  readBytes(options?: ResourceReadOptions): Promise<ArrayBuffer>
  readText(options?: TextReadOptions): Promise<string>
  readStream(options?: ResourceReadOptions): Promise<ReadableStream<Uint8Array>>
  readRange(
    range: ByteRange,
    options?: ResourceReadOptions
  ): Promise<ByteRangeResult>
}

export type ViewerContentIdentity = Pick<
  ViewerResourceContent,
  "key" | "sourceKind"
>

export type ViewerContentDirectUrl = ViewerContentIdentity &
  Pick<ViewerResourceContent, "directUrl">

export type ViewerContentPayload = ViewerContentIdentity &
  Pick<ViewerResourceContent, "payload">

export type ViewerContentBlob = ViewerContentIdentity &
  Pick<ViewerResourceContent, "readBlob">

export type ViewerContentBytes = ViewerContentIdentity &
  Pick<ViewerResourceContent, "readBytes">

export type ViewerContentText = ViewerContentIdentity &
  Pick<ViewerResourceContent, "readText">

export type ViewerContentStream = ViewerContentIdentity &
  Pick<ViewerResourceContent, "readStream">

export type ViewerContentRange = ViewerContentIdentity &
  Pick<ViewerResourceContent, "readRange">

export interface ViewerResource {
  readonly descriptor: ViewerDescriptor
  readonly sourceKind: ViewerSource["kind"]
  readonly keys: ViewerResourceKeys
  readonly identityKey: string
  readonly fileName: string
  readonly mimeType?: string
  readonly content: ViewerResourceContent
  readonly originalDownload: ViewerDownloadAction
}
```

Rules:

- Properties describe stable capabilities.
- Methods perform work.
- `resource.content` is the content/load lifecycle object.
- Expensive format loaders should take the narrowest content capability type
  they need, not the full presentation resource.
- Metadata-only changes may create a new `ViewerResource`, but must reuse
  `resource.content` when `keys.load` is unchanged.
- `resource.content.directUrl` is the only direct-load signal.
- `originalDownload` is the only original download action.
- `resource.content.payload` is the only synchronous source fast path.
- `resource.content.readBytes` is the byte operation.
- `resource.content.readStream` is the stream operation.
- `createViewerResource` returns frozen canonical resource objects.
- `resourceBase` must not add compatibility aliases.

### Resource Content System

The viewer system has two distinct resource identities:

```txt
ViewerResource
  presentation identity
  download metadata
  filename/mime/category
  viewer chrome state

ViewerResource.content
  load identity
  bytes/text/blob/url capability
  expensive parser/cache identity
```

This split is the canonical answer to metadata-only source changes.

Public callers still pass one source object:

```tsx
<PdfViewer source={source} />
<ImageViewer source={source} />
<PptxViewer source={source} />
<TextViewer source={source} />
```

Public APIs do not expose `ViewerResourceContent`. Public callers describe a
file-like source. Viewer internals decide whether a subsystem needs the full
presentation resource or only the load/content resource.

Resource creation:

```ts
const resource = createViewerResource(source)
```

This produces three keys:

```txt
resource.keys.load          content identity
resource.keys.presentation  filename/download/display metadata identity
resource.keys.resource      full resource identity
```

It also produces:

```ts
resource.content
```

`resource.content` is stable across metadata-only changes:

```ts
const first = createViewerResource({
  kind: "url",
  url: "/same.pdf",
  fileName: "a.pdf",
  downloadUrl: "/download/a.pdf",
})

const second = createViewerResource({
  kind: "url",
  url: "/same.pdf",
  fileName: "b.pdf",
  downloadUrl: "/download/b.pdf",
})

first !== second
first.keys.presentation !== second.keys.presentation
first.content === second.content
```

Use the full `ViewerResource` when code cares about presentation:

```txt
toolbar labels
download action
filename
mime type
viewer reset key
error boundary metadata
source kind for UI
```

Use `ViewerResourceContent` when code cares about expensive content work:

```txt
PDF document loading
image frame decoding
DOCX buffer loading
XLSX workbook parsing
PPTX renderer loading
text payload fetching
CSV parsing
format cache keys
load timing
retry/eviction for parsed assets
```

The loader rule is strict:

```txt
If a function parses, decodes, renders, caches, fetches, or evicts expensive
content, it should take ViewerResourceContent.
```

Current exemplar:

```ts
getPptxSource(content)
subscribePptxSourceLoadTiming(content, callback)
evictPptxSource(content)
```

Future migration targets:

```ts
getPdfDocument(content)
getImageSource(content)
getDocxBuffer(content)
getXlsxWorkbook(content)
loadTextContent(content)
parseCsvContent(content)
```

Viewer components still receive full resources internally because UI needs both
layers:

```tsx
function PdfResourceViewer({ resource }: { resource: ViewerResource }) {
  const document = usePdfDocument(resource.content)
  const download = resource.originalDownload
}
```

The component boundary stays ergonomic. The expensive loader boundary becomes
precise.

Cache rule:

```txt
Caches for parsed/decoded/rendered content key from content.key.
```

Do not key content caches from:

```txt
resource.keys.resource
resource.keys.presentation
fileName
downloadUrl
```

unless the cached artifact truly depends on presentation metadata. That should
be rare and must be documented at the cache owner.

Current migration state:

```txt
PPTX parse/cache -> ViewerContentBytes
PPTX timing/eviction -> ViewerContentIdentity
PDF document/cache loading -> ViewerContentDirectUrl & ViewerContentBytes
PDF retain/release/eviction -> ViewerContentIdentity
Image source/cache/decoding -> ViewerContentDirectUrl & ViewerContentPayload & ViewerContentBlob & ViewerContentBytes
Image retain/release -> ViewerContentIdentity
DOCX buffer/cache loading -> ViewerContentBytes
DOCX eviction -> ViewerContentIdentity
XLSX workbook/cache loading -> ViewerContentBytes
Text resource loading -> ViewerContentText
Text chunk loading -> ViewerContentBytes & ViewerContentRange
Text markdown/html rendering -> ViewerContentIdentity plus text-resource output
CSV parser/worker state -> ViewerContentPayload & ViewerContentStream
```

Remaining content-boundary migrations in the current viewer set:

```txt
none
```

Final desired shape:

```txt
Public source
  -> ViewerResource
      -> UI/chrome/download/error metadata
      -> ViewerResourceContent
          -> all expensive loading/parsing/caching
```

Design confidence:

```txt
Current confidence: very high.
```

The conceptual split has now survived the main viewer set. This is the correct
architecture.
Final precision:

- `ViewerResourceContent` remains one canonical object because construction,
  interning, and identity are simpler that way.
- Loaders and caches consume narrow capability types so code cannot silently
  depend on unrelated operations.
- Eviction, retain, release, reset keys, and timing subscriptions use
  `ViewerContentIdentity` when they only need `content.key`.
- The name `content` means loadable source content, not rendered content,
  parsed content, or file body. It remains the best current name because the
  migrated call sites read naturally.

## Resource Keys

Current key model:

```ts
export interface ViewerResourceKeys {
  readonly load: string
  readonly presentation: string
  readonly resource: string
}
```

Use:

```txt
keys.load          parsed/decoded asset cache
keys.presentation  toolbar, labels, download metadata
keys.resource      resource object identity
```

Rules:

- Expensive parsed assets use `keys.load`.
- UI metadata reactions use `keys.presentation`.
- Resource interning uses `keys.resource`.
- Do not use `keys.resource` when metadata-only changes should not reload
  content.

## Download Model

The canonical download type is `ViewerDownloadAction`.

Rules:

- `ViewerResource` owns `originalDownload`.
- Viewers may add derived download actions.
- All browser download mechanics live in `ui/viewer-download.tsx`.
- No viewer creates object URLs.
- No viewer programmatically clicks anchors.
- No viewer serializes derived exports during render.
- Derived export payloads are lazy.

Standard action ids:

```txt
download-original
export-csv
export-current-sheet-csv
export-current-page-png
```

## Error Model

The viewer system has exactly four canonical viewer-domain error classes:

```txt
ResourceError
ViewerFormatError
ViewerStateError
ViewerUnsupportedError
```

These classes are not interchangeable. Each marks the layer that owns the
failure.

```txt
ViewerResource read failed
  -> ResourceError

Format library, parser, decoder, renderer, worker, or page/slide/frame loader failed
  -> ViewerFormatError

Viewer state, target, bounds, stale handle, or user-controlled parameter is invalid
  -> ViewerStateError

The source is valid but this viewer intentionally cannot preview it
  -> ViewerUnsupportedError
```

Canonical preview projection remains centralized:

```txt
toViewerErrorInfo(error, context)
ViewerErrorState
ViewerErrorBoundary
```

### Ownership Rules

`ViewerResource` owns transport and source access failures.

It must throw `ResourceError` for:

- network failure
- HTTP failure
- abort/cancellation
- invalid byte range
- partial response where full content was required
- configured text/byte/line limits
- missing resource capability
- unknown source read failure

Format loaders own file interpretation failures.

They must throw `ViewerFormatError` for:

- corrupt file bytes
- parser failure
- decoder failure
- renderer failure
- worker failure
- page, slide, frame, or sheet load failure
- invalid page, slide, frame, sheet, row, column, or cell index
- disposed source accessed after disposal
- format-level bounds failures
- format-specific invariant violations, such as zero usable pages or slides

Viewer components own interactive state failures.

They must throw `ViewerStateError` for:

- invalid controlled props
- invalid target descriptors
- target out of range
- stale imperative handles
- stale resource state that escapes normal cancellation
- impossible UI state transitions

Unsupported routing owns preview impossibility.

It must use `ViewerUnsupportedError` only when the system successfully
understands the source but intentionally cannot preview it.

### Boundary Rules

Every boundary has one job:

```txt
ViewerResource
  reads bytes/text/blob/stream/ranges
  throws ResourceError

format resource adapter
  calls ViewerResource
  preserves ResourceError
  maps non-resource failures to ViewerFormatError

format viewer component
  owns local state and reset/retry behavior
  throws typed state or format errors

ViewerErrorBoundary
  catches unknown
  calls toViewerErrorInfo
  renders ViewerErrorState
```

Rules:

- A `ResourceError` must never be wrapped as `ViewerFormatError`.
- A third-party library error must not escape a format loader raw unless the
  viewer deliberately treats it as unknown.
- Abort/disposal from normal teardown must not become user-facing.
- Late stale async failures must be ignored, not rendered.
- UI must not parse `error.message`.
- User-facing copy must stay in `toViewerErrorInfo` projection helpers.
- Shared error boundaries must not log unconditionally.
- Logging/reporting policy is injected through callbacks.
- Tests may assert `data-error-domain`, `data-error-kind`, and
  `data-error-message`, but user-facing copy should be asserted only when the
  copy itself is the contract.

### Format Error Kinds

The canonical `ViewerFormatErrorKind` vocabulary is intentionally small:

```txt
bounds
decode_failed
disposed
index_out_of_range
load_failed
parse_failed
render_failed
worker_failed
unknown
```

Mapping rules:

- File/package parsing failures use `parse_failed`.
- Format-library document loads use `load_failed`.
- Bitmap/image/text/frame decoding uses `decode_failed`.
- DOM/canvas/page/slide rendering uses `render_failed`.
- Worker startup, worker message, worker protocol, and worker crash failures use
  `worker_failed`.
- Explicit invalid page, slide, frame, sheet, row, column, or cell indexes use
  `index_out_of_range`.
- User-configured format bounds use `bounds`.
- Access to a disposed format source uses `disposed`.
- `unknown` is allowed only at the final catch-all in a mapping function.

Format-specific subclasses are allowed only when they add typed fields that the
viewer or tests consume. They must extend `ViewerFormatError`; they must not
create a second projection path.

### State Error Kinds

The canonical `ViewerStateErrorKind` vocabulary is:

```txt
invalid_bounds
invalid_target
out_of_range
stale_resource
unknown
```

Mapping rules:

- Invalid props or invalid controlled ranges use `invalid_bounds`.
- Bad public targets or malformed target descriptors use `invalid_target`.
- Valid target shapes that point outside the loaded document use
  `out_of_range`.
- An imperative handle or async continuation that references a replaced
  resource uses `stale_resource` only if it cannot be ignored safely.
- `unknown` is allowed only at the final catch-all in a mapping function.

### Projection Policy

`toViewerErrorInfo(error, context)` is the only preview display projection
function.

Its output owns:

```txt
domain
format
kind
message
status
isRetryable
isDownloadUseful
userMessage
cause
```

Rules:

- `domain` and `kind` are machine-readable.
- `message` is diagnostic and may include raw error detail.
- `userMessage` is stable user-facing copy.
- `status` is present only when the error really has a transport status.
- `cause` is preserved for logging and debugging, not UI parsing.
- Retry and download decisions come from `ViewerErrorInfo`, not individual
  viewers.

Default retry policy:

```txt
ResourceError:
  retry URL fetch/load failures
  do not retry abort, invalid_range, too_large, unsupported_capability

ViewerFormatError:
  retry URL-backed load/parse/decode/render/worker failures
  do not retry text bounds failures
  do not retry disposed/index errors by default

ViewerStateError:
  do not retry by default

ViewerUnsupportedError:
  do not retry

unknown:
  retry only when sourceKind is url
```

`ViewerErrorContext.retry` may override the default with `always` or `never`,
but local viewers should use that sparingly. A viewer-specific retry override is
a policy decision, not a convenience escape hatch.

Default download usefulness:

```txt
ResourceError:
  download is useful except for aborted loads

ViewerFormatError:
  download is useful when a download action exists

ViewerStateError:
  download is useful when a download action exists

ViewerUnsupportedError:
  download is useful when a download action exists

unknown:
  download is useful when a download action exists
```

### Download Error Policy

Preview errors and download errors are different surfaces.

`toViewerErrorInfo` remains the preview/display projection. Download controls
use typed download errors from `viewer-download.tsx` and report them through
`onError`.

Rules:

- Download failure must not replace the viewer preview with
  `ViewerErrorState`.
- Single download buttons and menu download items must call the same download
  error reporting path.
- Download controls may expose transient UI state such as loading or disabled.
- Download controls must not parse viewer-format errors.
- Derived export payload failures should stay download-action failures unless
  the same failure also prevents preview.
- Original downloads use `resource.originalDownload`.
- Derived downloads are lazy actions and report their own errors.
- Browser download mechanics live in `ui/viewer-download.tsx`.

This keeps preview failures and export failures separate while still typing
both systems.

### Canonical Mapping Functions

Every format with non-trivial third-party or worker integration should expose
one small mapper near its loader:

```ts
function toPdfFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError
function toImageFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError
function toTextFormatError(
  error: unknown,
  options?: ViewerFormatErrorMapperOptions
): ViewerFormatError
function toCsvFormatError(
  error: unknown,
  options?: ViewerFormatErrorMapperOptions
): ViewerFormatError
function toDocxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError
function toXlsxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError
function toPptxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError
```

Mapper rules:

- Resource boundaries preserve `ResourceError` before calling a format mapper.
- A `to{Format}FormatError` mapper must return only `ViewerFormatError`.
- If `isAbortError(error)` from normal teardown, do not project it to UI.
- If `isViewerFormatError(error)`, preserve it unless the mapper must add the
  current format.
- Map worker transport/protocol failures to `worker_failed`.
- Map parser/library load failures to `parse_failed` or `load_failed`.
- Map render failures to `render_failed`.
- Preserve the original error as `cause`.
- Do not use raw string matching except at third-party boundaries where no
  structured signal exists.

The mapper may be a local function until two viewers need the exact same
mapping helper. Do not create a generic abstraction before duplication proves
itself.

### Required Error Tests

Each migrated viewer must have tests for:

- resource fetch failure keeps `domain: resource`
- format/library failure maps to `domain: format`
- worker failure maps to `kind: worker_failed` when the viewer uses a worker
- stale async failure after source change is ignored
- normal unmount/disposal does not render an error
- retry appears only when policy says it is retryable
- download remains available on preview failure when useful
- metadata-only source changes reset only presentation, not content caches

Shared tests must cover:

- `toViewerErrorInfo` projection for every error class
- retry policy overrides
- download usefulness projection
- unknown error fallback
- cross-realm/type-erased error-like objects

### Format Error Mapper Completion Blueprint

Current verdict: the mapper model is correct, but the implementation should not
be called perfect until the contract is explicit everywhere and the repo-wide
verification baseline is green.

The goal is not to remove typed subclasses. The goal is to make every external
failure cross a named boundary before it reaches viewer state or preview UI.

#### Final Shape

Each non-trivial viewer format has one named mapper:

```ts
function toPdfFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError

function toImageFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError

function toTextFormatError(
  error: unknown,
  options?: ViewerFormatErrorMapperOptions
): ViewerFormatError

function toCsvFormatError(
  error: unknown,
  options?: ViewerFormatErrorMapperOptions
): ViewerFormatError

function toDocxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError

function toXlsxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError

function toPptxFormatError(
  error: unknown,
  options: ViewerFormatErrorMapperOptions
): ViewerFormatError
```

The shared option shape should be small:

```ts
interface ViewerFormatErrorMapperOptions {
  kind: ViewerFormatErrorKind
  message: string
}
```

Do not create a generic `toFormatError(format, error, options)` implementation
unless two or more mappers become mechanically identical and the extracted
helper makes the call sites more obvious. A shared type is enough until then.

#### Mapper Contract

Every mapper must follow the same ordering:

1. If `isResourceError(error)`, preserve the resource failure at the boundary
   before calling the mapper. A `to{Format}FormatError` mapper must not return
   or throw `ResourceError`.
2. If the failure is a normal abort, disposal, or stale async continuation,
   ignore it at the lifecycle boundary instead of projecting it to preview UI.
3. If `isViewerFormatError(error)`, return it unchanged unless the mapper is
   deliberately normalizing an unformatted cross-realm object into the current
   format.
4. If the error came from a worker crash, worker startup failure, worker
   message failure, or invalid worker protocol, map it to `worker_failed`.
5. If the error came from a parser or format library, map it to `parse_failed`
   or `load_failed` according to the layer that failed.
6. If the error came from bitmap/text/frame decoding, map it to
   `decode_failed`.
7. If the error came from DOM, canvas, page, slide, or document rendering, map
   it to `render_failed`.
8. Always preserve the original value as `cause` when a new
   `ViewerFormatError` is created.
9. Use `unknown` only as the final fallback, not as a convenient default.

#### Direct Error Construction Policy

Direct construction of `ViewerFormatError` subclasses is allowed only when the
viewer itself creates the failure.

Allowed:

- invalid page, slide, frame, sheet, row, column, or cell index
- invalid dimensions or impossible format invariants discovered by local code
- configured text or format bounds failures
- disposed source access inside a locally owned source object
- worker protocol errors created after validating an impossible worker message
- typed subclasses with fields consumed by viewer logic or tests

Not allowed:

- wrapping an unknown `catch (error)` from a third-party library directly with
  `new ViewerFormatError(...)`
- wrapping browser decode, canvas, PDF, DOCX, PPTX, XLSX, CSV, TIFF, or worker
  transport failures outside the named mapper
- constructing raw `Error` for failures that can reach preview UI
- parsing `error.message` in viewer UI to decide retry, download, or copy

This distinction keeps useful subclasses without letting every catch block
become its own private error policy.

#### Format-Specific Subclass Policy

Subclasses are precision tools, not a second model.

They are allowed when they add one of:

- a typed field used by code, such as `reason`, `boundName`, `pageIndex`, or
  `frameIndex`
- a stable test assertion that prevents a real regression
- a format-specific lifecycle name that makes ownership clearer, such as a
  disposed source error

They are not allowed when they only rename `ViewerFormatError` without adding
meaning. A plain `ViewerFormatError` with the correct `format`, `kind`,
`message`, and `cause` is better than a decorative subclass.

All subclasses must:

- extend `ViewerFormatError`
- set the canonical `format`
- set one canonical `ViewerFormatErrorKind`
- preserve `cause` when created from another error
- flow through `toViewerErrorInfo` without custom UI projection

#### Current Target State

The desired end state is:

- PDF has `toPdfFormatError`.
- Image has `toImageFormatError`.
- Text has `toTextFormatError`.
- CSV has `toCsvFormatError` or an equivalently named worker/state mapper.
- DOCX has `toDocxFormatError`.
- XLSX has `toXlsxFormatError`.
- PPTX has `toPptxFormatError`.
- Worker-backed formats map transport and protocol failures to
  `worker_failed`.
- Library parse failures map to `parse_failed`.
- Library document-load failures map to `load_failed`.
- Render failures map to `render_failed`.
- Bounds and out-of-range format failures remain non-retryable by default.
- URL-backed external load/parse/decode/render/worker failures remain retryable
  by default.

#### Implementation Steps

1. Inventory the current code:

```sh
rg -n "catch \\(|new Error\\(|new ViewerFormatError|new .*Error|onerror|onmessageerror" registry/new-york-v4/lib registry/new-york-v4/ui tests
```

2. For every match, classify the failure as one of:

```txt
resource
format-created
format-external
state
unsupported
download
normal-lifecycle
test-only
```

3. Leave `resource`, `state`, `unsupported`, `download`, `normal-lifecycle`,
   and `test-only` failures in their owning systems.
4. Route every `format-external` failure through the format's named mapper.
5. Keep `format-created` direct subclasses only when they satisfy the subclass
   policy above.
6. Normalize all mapper signatures to `error` plus
   `ViewerFormatErrorMapperOptions` unless a viewer has a proven reason for a
   stricter local option type.
7. Export a mapper only when tests or another module need it. Otherwise keep it
   local to the loader.
8. Update tests so every mapper has at least:
   - boundary preserves `ResourceError` before mapper use
   - mapper preserves existing `ViewerFormatError`
   - maps unknown external failure to the correct `kind`
   - preserves `cause`
   - handles cross-realm/type-erased canonical errors when applicable
9. Update viewer UI tests so the visible error state exposes the expected
   `data-error-domain` and `data-error-kind`.
10. Run focused tests, registry build, diff hygiene, and whole-tree typecheck.

#### Acceptance Criteria

The mapper standardization is complete only when:

- no preview-reachable third-party, browser, or worker failure bypasses the
  format's named mapper
- no viewer UI decides policy by parsing `error.message`
- `ResourceError` is never wrapped as `ViewerFormatError`
- normal abort/disposal/stale async paths do not render preview errors
- all worker-backed viewers use `worker_failed` for worker transport and
  protocol failures
- all format-specific subclasses extend `ViewerFormatError` and carry useful
  typed meaning
- `toViewerErrorInfo` remains the only preview projection function
- focused viewer tests pass
- `./node_modules/.bin/shadcn build --output public/r` passes
- `git diff --check` passes
- `./node_modules/.bin/tsc --noEmit --pretty false` passes

If `tsc` is red because of unrelated files, the final handoff must name those
files and lines. The viewer system is then improved, but not verified as
complete.

#### Non-Goals

Do not do these as part of mapper completion:

- introduce a universal cache abstraction
- introduce a generic table-driven error registry
- merge preview errors and download-action errors
- remove useful typed subclasses just for visual symmetry
- add compatibility aliases for old source or resource APIs
- broaden public viewer props
- change user-facing error copy unless the projection policy requires it

Do not over-table the error system. A clear named function beside the loader is
better than a global message table if the function is easier to audit. The
ideal is one obvious boundary policy, not one giant abstraction.

## Cache Model

Do not create a universal viewer cache.

The viewers have legitimately different lifecycle needs:

```txt
PDF document cache
PDF page cache
image source lease cache
decoded bitmap cache
PPTX renderer cache
PPTX slide bitmap cache
DOCX byte cache
XLSX workbook cache
CSV stream/worker state
text resource cache
thumbnail caches
```

Shared vocabulary:

```txt
cache owner
cache key
load key
presentation key
local key
entry
pending entry
resolved entry
rejected entry
retained entry
evictable entry
retain
release
dispose
evict
abort
retry
reset
```

Rules:

- Every expensive cache has an explicit max size or lifecycle reason for no max.
- Disposable assets are disposed on eviction/reset.
- Failed loads can retry the same source.
- Metadata-only changes do not reload content caches.
- Rejected promises do not poison retries forever.

### Cache State

The cache architecture is intentionally format-specific and uses the canonical
resource key vocabulary.

Do not collapse all caches into one generic cache. The format-specific
lifecycle differences are real:

- PDF has document and page lifetimes.
- Image has source leases and decoded frame disposal.
- PPTX has renderer and slide bitmap lifetimes.
- DOCX has byte caching plus imperative DOM render cleanup.
- XLSX has workbook worker output and lazy CSV export.
- Text has bounded request caching.
- Thumbnails have small retryable render caches.

Add shared helpers only when they remove real duplication in at least two
places. Candidate helper shapes:

```ts
export interface ViewerDisposable {
  dispose(): void | Promise<void>
}

export function disposeQuietly(asset: ViewerDisposable | null | undefined): void
export function isRejectedEntry(entry: { status: string }): boolean
export function pruneLru<K, V>(entries: Map<K, V>, options: unknown): void
```

Rules for future cache changes:

- Keep format-specific ownership visible.
- Keep disposal rules explicit.
- Use `keys.load` for content identity.
- Use `keys.presentation` for metadata reactions.
- Evict rejected entries when retry should be possible.
- Add tests before extracting helpers.
- Delete any helper that makes the caller harder to reason about.

### Cache Vocabulary Target

The viewer system should have one cache language, not one cache implementation.

This is the current gap:

- Text, markdown, and HTML now key by `resource.keys.load`.
- PDF, image, PPTX, DOCX, XLSX, CSV, text, and thumbnail caches mostly use the
  right key concepts.
- The lifecycle model is still written locally in each viewer. That local code
  is often correct, but the vocabulary is not yet inevitable.

The platonic target is:

```txt
Every cache entry says:
  who owns it
  what identity keys it
  what state it is in
  whether it is retained by a mounted viewer
  whether it can be evicted
  what happens when it is evicted
  what happens when its load rejects
  what happens when the source changes
  what happens when only presentation metadata changes
```

Do not interpret this as a mandate for a generic `ViewerCache<T>`. A universal
cache class would hide too much. The target is a universal vocabulary and a few
small lifecycle primitives, used only where the same logic appears in multiple
formats.

#### Cache Owners

Every cache must name its owner.

Allowed owner shapes:

```txt
module-owned cache
viewer-instance retained cache
resource-owned fast path
derived export cache
thumbnail render cache
third-party library cache
```

Definitions:

- A `module-owned cache` is shared across mounted viewers of the same format.
- A `viewer-instance retained cache` keeps an entry alive while one mounted
  viewer still needs it.
- A `resource-owned fast path` is synchronous information already present on
  `ViewerResource.payload` or `ViewerResource.directUrl`.
- A `derived export cache` stores expensive derived output, such as a sheet CSV
  export or page image export.
- A `thumbnail render cache` stores small preview output and must never poison
  the full viewer.
- A `third-party library cache` belongs to PDF.js, docx-preview, SheetJS, image
  decode internals, or the browser. Viewer code may benefit from it but must not
  pretend to own it.

Every cache module should make ownership visible in one of these places:

```txt
type name
entry name
top-level constant name
function name
module comment when the ownership is non-obvious
```

Bad:

```ts
const cache = new Map<string, Promise<unknown>>()
```

Good:

```ts
const documentCache = new Map<string, PdfDocumentEntry>()
const workbookCache = new XlsxSourceCache({ maxEntries: 4 })
const sourceCache = new DisposableLruCache<string, PptxSourceEntry>(...)
```

#### Cache Keys

Every cache key must say which identity it represents.

Canonical keys:

```txt
resource.keys.load
resource.keys.presentation
resource.keys.resource
local derived key
third-party object identity
```

Rules:

- Use `resource.keys.load` for parsed bytes, decoded assets, fetched text,
  rendered markdown, loaded PDF documents, loaded PPTX decks, DOCX bytes, XLSX
  workbooks, image byte signatures, and source-level thumbnails.
- Use `resource.keys.presentation` only when labels, display names, toolbar
  state, MIME metadata, or download metadata must update without reloading
  content.
- Use `resource.keys.resource` only when both load identity and presentation
  identity matter.
- Use a `local derived key` only when the cached value depends on additional
  non-source inputs, such as page number, sheet index, render scale, rotation,
  text bounds, or retry version.
- Use `third-party object identity` only when the library owns the parent object,
  such as PDF page cache entries keyed by `PDFDocumentProxy`.

Local derived keys must be named after the extra identity they add:

```txt
pageKey
sheetKey
bitmapKey
renderKey
textBoundsKey
thumbnailKey
```

Avoid `cacheKey` unless the function is itself a generic cache helper and the
caller already made the identity explicit.

#### Cache Entries

Every non-trivial cache should model entries explicitly.

Canonical entry states:

```txt
pending
resolved
rejected
disposed
```

Use the smallest representation that expresses the real lifecycle.

Allowed forms:

```ts
type Entry<T> =
  | { status: "pending"; promise: Promise<T>; controller?: AbortController }
  | { status: "resolved"; value: T; lastUsedAt?: number }
  | { status: "rejected"; error: unknown; promise: Promise<T> }
  | { status: "disposed" }
```

This is a vocabulary, not a required exact type. If a cache only needs a
`Promise<ArrayBuffer>`, it may stay that simple, but the rejection and eviction
policy must still be explicit in code or tests.

Rules:

- A pending entry may be shared.
- A resolved entry may be reused.
- A rejected entry may be retained only when the UI needs to render a stable
  error for the current resource.
- A rejected entry must be evictable or replaceable so retry can work.
- A disposed entry must not be returned to new callers.
- A stale pending entry may resolve late but must not commit UI.

#### Lifecycle Verbs

Use these verbs consistently:

```txt
load      start or return the shared expensive operation
read      consume bytes/text/blob/stream from ViewerResource
retain    mark an entry as needed by a mounted viewer
release   remove one mounted-viewer claim
abort     cancel pending work that has no remaining subscribers
dispose   free external resources owned by a resolved entry
evict     remove an entry from the cache
reset     clear a cache for tests or global teardown
retry     replace a failed entry with a fresh load
prune     evict entries until cache policy is satisfied
```

Meanings:

- `load` returns cached work when valid and starts work only when necessary.
- `read` belongs to `ViewerResource` and low-level format loaders, not UI
  components.
- `retain` and `release` are for mounted lifetime ownership.
- `abort` is for pending work.
- `dispose` is for resolved resources with external memory, object URLs,
  bitmaps, PDF documents, workers, renderer instances, or library handles.
- `evict` removes cache ownership and may call `abort` or `dispose`.
- `reset` is a test/global teardown operation, not a normal UI event.
- `retry` must not require changing the source URL.
- `prune` is cache policy, not semantic source invalidation.

Do not use:

```txt
clear when only one entry is removed
dispose when only a promise is forgotten
abort when a resolved asset is freed
invalidate when the actual behavior is evict, retry, or reset
manager when the module only owns a map
```

#### Rejection Policy

Every expensive cache must choose one rejection policy.

Allowed policies:

```txt
evict-on-reject
retain-current-rejection
retain-rejection-until-source-change
retain-rejection-until-explicit-retry
```

Rules:

- `evict-on-reject` is the default for resource loads that should retry on the
  next call.
- `retain-current-rejection` is allowed when React error boundaries need the
  same promise/error for stable rendering.
- `retain-rejection-until-source-change` is allowed for viewer-level state that
  should remain visibly failed until the user changes source.
- `retain-rejection-until-explicit-retry` is allowed only when a retry button is
  present and tested.
- Rejected module-level entries must never poison all future viewers for the same
  source unless that is an explicit, tested policy.

Required tests:

```txt
failed load can retry same source
failed load recovers on source change
late failure from stale source is ignored
shared failure notifies all current subscribers
aborted load does not become user-facing failure
```

#### Subscriber Policy

Any cache that shares pending work across mounted viewers must define subscriber
behavior.

Canonical rules:

- Multiple subscribers to the same load key share one pending operation.
- Aborting one subscriber must not abort shared work while another subscriber is
  active.
- When the final subscriber aborts, pending work may be aborted.
- Settled entries must remove subscriber bookkeeping.
- Subscriber bookkeeping must not be the source of permanent retention.

Use a shared helper only for this narrow pattern. The helper may own:

```txt
WeakMap<AbortSignal, Promise<T>>
Set<AbortSignal>
AbortController
onNoSubscribers callback
```

The helper must not own:

```txt
format-specific disposal
format-specific retry policy
format-specific cache keys
format-specific user-facing errors
```

#### Disposal Policy

Every cache entry that owns external resources must expose an explicit disposal
path.

Disposable assets include:

```txt
PDFDocumentProxy
PDFPageProxy
ImageBitmap
Object URL
Worker
PPTX renderer/source object
Canvas bitmap snapshot
library document handle
large detached DOM subtree
```

Rules:

- Disposal runs on eviction.
- Disposal runs on reset.
- Disposal runs when stale resolved work finishes after its owner was evicted.
- Disposal errors are normally swallowed or logged internally; they are not
  user-facing viewer failures unless the disposal is itself a user action.
- A disposed entry must not be returned to new callers.

#### Cache Size Policy

Every cache must document why its size is bounded or why it is not bounded.

Allowed policies:

```txt
fixed max entries
per-source max entries
mounted-lifetime retention
worker-lifetime cache
browser/library-owned cache
no cache
```

Rules:

- Module-owned caches should normally have a fixed max.
- Per-page or per-slide bitmap caches should normally have a per-source max.
- Mounted-lifetime retained entries may exceed LRU temporarily but must become
  evictable on release.
- Caches with no max need a written reason and should be rare.

#### Metadata Policy

Metadata-only changes must not reload content.

Examples of metadata-only changes:

```txt
fileName
displayName
mimeType
downloadUrl
toolbar visibility
className
bare
controlled scale
highlight target
active sheet selection
```

Rules:

- Content caches must not include `keys.presentation` unless the content really
  depends on presentation metadata.
- Download controls must update from `resource.originalDownload` even when
  content is reused from `keys.load`.
- Viewer reset keys may include `keys.resource` only when the rendered UI must
  reset for metadata changes.

#### Expected Final Shape

The final cache system should look like this:

```txt
shared tiny lifecycle helpers
  abortable subscriber helper
  LRU prune helper
  disposable LRU helper
  quiet dispose helper

format-owned caches
  PDF document/page cache
  image source/frame cache
  PPTX source/bitmap cache
  DOCX byte/render cache
  XLSX workbook/export cache
  CSV stream/worker state
  text/markdown/html text cache
  thumbnail render cache
```

The helpers are allowed because they encode mechanics. The format caches remain
because they encode ownership.

The success condition is not fewer files. The success condition is that every
cache reads as if the same engineer chose the same words for the same lifecycle
concepts everywhere.

#### Live Code Grounding

This is the current cache map. Keep this table true when changing cache code.

```txt
File                                                          Owner                         Key
registry/new-york-v4/lib/pdf-document-resource.ts                module-owned PDF documents    resource.keys.load
registry/new-york-v4/lib/pdf-document-resource.ts                PDF pages by PDF document     PDFDocumentProxy + pageNumber
registry/new-york-v4/lib/image-source-cache.ts                image frame source manager    resource.keys.load
registry/new-york-v4/ui/pptx-viewer-source.ts                 module-owned PPTX sources     resource.keys.load
registry/new-york-v4/ui/pptx-viewer-source.ts                 per-source slide bitmaps      slideIndex + renderScale
registry/new-york-v4/lib/docx-document-resource.ts               module-owned DOCX bytes       resource.keys.load
registry/new-york-v4/lib/xlsx-workbook.ts                     workbook source cache         resource.keys.load at call site
registry/new-york-v4/ui/text-viewer-resource.ts               text viewer bounded text      resource.keys.load + retry + bounds
registry/new-york-v4/ui/file-viewer-text-resource.ts          FileViewer text resource      resource.keys.load
registry/new-york-v4/ui/file-viewer-text-loader.ts            FileViewer chunked text       resource.keys.load + mode
registry/new-york-v4/ui/file-viewer-markdown-viewer.tsx       rendered markdown HTML        resource.keys.load
registry/new-york-v4/ui/file-viewer-html-viewer.tsx           loaded HTML text              resource.keys.load
registry/new-york-v4/ui/csv-viewer-state.ts                   viewer-instance CSV stream    no module cache
```

Current code already matches the most important rule: expensive source-level
content is keyed by `resource.keys.load`, and metadata-only changes can update
UI/downloads without refetching or reparsing content.

The code also proves that a single universal cache class would be wrong:

- PDF needs `retainPdfDocumentResource` and `releasePdfDocumentResource` because
  mounted viewers may keep a document alive past LRU eviction.
- Image needs leases, delayed disposal timers, TIFF/native branching, and abort
  propagation through `FrameSourceManager`.
- PPTX needs a disposable source cache plus a separate per-source bitmap LRU.
- DOCX byte caching is intentionally just a promise map because the cached value
  is plain bytes and has no disposal path.
- XLSX evicts by both entry count and estimated bytes.
- CSV has no module cache because it streams batches into local React state and
  aborts on unmount/source change.
- FileViewer text/markdown/HTML share abortable text requests and subscriber
  bookkeeping because multiple mounted route viewers can request the same
  resource concurrently.

Therefore the ideal is:

```txt
one key model
one lifecycle vocabulary
format-owned cache implementations
small shared mechanics only where repeated
```

Not:

```txt
one ViewerCache class
one entry type forced on every viewer
one disposal model for bytes, documents, workers, bitmaps, and streams
```

#### Vocabulary Cutover State

These concrete vocabulary mismatches have been closed in live viewer-cache code.

1. Viewer-owned cache entry status names use the canonical vocabulary.

Current examples:

```txt
pdf-document-resource.ts: "pending" | "resolved" | "rejected"
text-viewer-resource.ts: "pending" | "resolved" | "rejected"
document-thumbnail/thumbnail-cache.ts: "pending" | "resolved" | "rejected"
image-source-cache.ts: "pending" | "resolved" | "evictable" | "disposed"
```

Canonical vocabulary:

```txt
pending
resolved
rejected
disposed
retained
evictable
```

CSV still uses `ready` as viewer data state, not cache-entry state. That is
allowed.

2. Generic `cacheKey` names have been removed from viewer cache APIs where a
   better identity name exists.

Current examples:

```ts
XlsxSourceCache.get(loadKey, load)
XlsxSourceCache.setResolvedForTest(loadKey, source)
getThumbnailKey(...)
getThumbnailRenderKey({ thumbnailKey, anchor, retryKey })
```

`cacheKey` may still appear outside the viewer cache system, for example syntax
highlighting. Those are not part of this viewer blueprint.

3. Retry policy is correct but not always named.

Current examples:

- PDF deletes rejected document/page entries unless `retainRejected` is set.
- DOCX deletes rejected byte promises unless `retainRejected` is set.
- PPTX schedules failed source eviction.
- XLSX deletes failed workbook entries.
- FileViewer text-resource deletes failed entries.

Ideal: every cache module should make the chosen policy obvious in code names or
tests:

```txt
evict-on-reject
retain-current-rejection
retain-rejection-until-explicit-retry
```

4. Test-only reset names use `reset...ForTests` where the operation is test
   teardown.

Current examples:

```txt
resetImageSourceCacheForTests()
resetDocxDocumentResourceCacheForTests()
disposePptxSourceCache()
XlsxSourceCache.clear()
```

`disposePptxSourceCache` is intentionally not renamed because it semantically
disposes renderer/source resources. `XlsxSourceCache.clear()` is an object API,
not a test-only global helper.

5. Shared lifecycle helpers exist but are split by feature history.

Current helpers:

```txt
viewer-abortable-request.ts          abortable subscriber mechanics
viewer-lru-cache.ts                  lruGet/lruSet
pptx-viewer-cache.ts                 DisposableLruCache
```

Ideal:

- Keep `viewer-abortable-request.ts` as the neutral home for abortable
  subscriber fan-out.
- Do not broaden abortable subscriber mechanics beyond this small primitive
  unless another viewer needs exactly the same behavior.
- Keep `viewer-lru-cache.ts` as the neutral home for bare LRU touch/set
  mechanics.
- Keep `DisposableLruCache` only for disposable entries.
- Do not merge promise LRU and disposable LRU unless it reduces real duplication
  without obscuring disposal.

#### Code-Level Acceptance Checklist

A cache change is acceptable only when the touched module answers these
questions in code or tests:

```txt
What owns the cache?
Which key is used: load, presentation, resource, local, or third-party object?
What does a pending entry contain?
What does a resolved entry contain?
Can a rejected entry be retried?
What aborts pending work?
What disposes resolved work?
What prevents metadata-only changes from reloading content?
What is the max-size or retention policy?
What test proves stale async work cannot commit UI?
```

Concrete checks to run after cache work:

```sh
rg -n "cacheKey" registry/new-york-v4/lib registry/new-york-v4/ui components/document-thumbnail components/document-thumbnail.tsx tests/*thumbnail*
rg -n "\"fulfilled\"|\"ready\"|\"released\"" registry/new-york-v4/lib registry/new-york-v4/ui
rg -n "retainRejected|rejected|catch\\(" registry/new-york-v4/ui/*viewer* registry/new-york-v4/lib/*viewer*
```

The first two searches are not forbidden-pattern scans. They are review prompts:
each hit must either be intentionally local or renamed to the canonical
vocabulary.

## FileViewer Model

`FileViewer` is a router over `ViewerSource`.

Ideal internal flow:

```txt
FileViewer receives source.
FileViewer creates ViewerResource.
FileViewer resolves descriptor.
FileViewer routes by descriptor.category.
Routes receive resource or canonical source.
Routes do not invent downloads.
Routes do not fetch raw URL strings except through ViewerResource.
```

Allowed raw URL usage:

- DOM media/image/embed boundaries.
- Third-party libraries that explicitly require a URL and benefit from direct
  URL loading.

All other route data access goes through `ViewerResource`.

### FileViewer State

FileViewer now follows the canonical resource-first route model.

The outer flow is:

```txt
FileViewer props.source
  -> createViewerResource(source)
  -> resolve descriptor
  -> route by descriptor.category
```

Route modules use this shape:

```ts
interface FileViewerRouteProps {
  resource: ViewerResource
  descriptor: FileDescriptor
  className?: string
  bare?: boolean
  isolateStyles?: boolean
  descriptorSignal: AbortSignal
}
```

Route behavior:

- Text route accepts `resource`, not `url`.
- Markdown route accepts `resource`, not `url`.
- HTML route accepts `resource`, not `url`, except at DOM iframe/blob
  boundaries.
- Route-local caches key by `resource.keys.load` or `resource.keys.presentation`
  intentionally.
- Route-local fetches use `resource.content.readText`,
  `resource.content.readBlob`, or `resource.content.readStream`.
- Route-local downloads use `resource.originalDownload`.
- Route props do not split URL, file name, MIME type, download behavior, and
  abort lifecycle into parallel inputs.

Do not force FileViewer text/markdown/HTML routes through the public
`TextViewer`. Those routes may need specialized incremental loading,
sanitization, markdown rendering, iframe behavior, or SSR fallback behavior. The
goal is canonical inputs, not one generic renderer.

### FileViewer Text Error Coercion Blueprint

Resolved gap: `file-viewer-text-viewer.tsx` previously had defensive fallback
coercions:

```ts
error instanceof Error ? error : new Error(String(error))
```

Those fallbacks were not the main error path. Normal resource failures should
already arrive as `ResourceError` from `ViewerResource`, and normal aborts are
ignored. The fallback path only handles abnormal non-canonical throws from the
chunked text loader path.

Generic fallback coercion is not acceptable because a non-Error throw becomes a
generic `Error`. That loses canonical `domain`, `format`, `kind`, and `cause`,
so `toViewerErrorInfo` must project it as `unknown`.

#### Ownership Decision

FileViewer text is not the same component as public `TextViewer`.

It owns:

- incremental chunk loading
- streamed range loading
- JSON pretty-print rendering
- syntax highlighting
- scroll-triggered load-more behavior
- FileViewer shell integration

It does not own:

- transport failures
- source capability failures
- byte/range/text read failures
- abort lifecycle

Therefore the clean boundary is a small FileViewer text mapper, not a forced
reuse of `TextViewer` internals and not a generic `new Error(String(error))`.

#### Final Shape

Own the mapper in `file-viewer-text-errors.ts`:

```ts
export function toFileViewerTextError(error: unknown): Error
```

The return type is `Error`, not `ViewerFormatError`, because this route must
preserve `ResourceError` for the shared `ViewerErrorState` projection.

Rules:

1. If `isAbortError(error)`, the caller ignores it and never calls the mapper.
2. If `isResourceError(error)`, return it unchanged.
3. If `isViewerFormatError(error)`, return it unchanged.
4. If `isViewerStateError(error)`, return it unchanged.
5. Convert all other thrown values, including generic `Error` instances, to
   `ViewerFormatError` with:
   - `format: "text"`
   - `kind: "load_failed"`
   - message `"Failed to load text preview."`
   - `cause: error`

The default should be typed. Unknown projection should be reserved for truly
foreign errors that intentionally bypass the viewer-domain model.

#### Implementation Steps

1. Create `file-viewer-text-errors.ts`.
2. Import canonical predicates from `viewer-errors` in that module:
   - `isResourceError`
   - `isViewerFormatError`
   - `isViewerStateError`
   - `ViewerFormatError`
3. Export `toFileViewerTextError(error: unknown): Error` from the error module.
4. Import it into `file-viewer-text-viewer.tsx`.
5. Replace both `new Error(String(error))` fallback coercions with
   `toFileViewerTextError(error)`.
6. Keep abort handling at the call site before the mapper.
7. Do not change chunked loading, virtualized rendering, JSON formatting, or
   cache behavior.
8. Do not route FileViewer text through public `TextViewer`.

#### Required Tests

Add or update FileViewer text tests to prove:

- `ResourceError` is preserved and projects as `data-error-domain="resource"`.
- `ViewerFormatError` is preserved and projects as `data-error-domain="format"`.
- a non-Error thrown value becomes `data-error-domain="format"` and
  `data-error-kind="load_failed"`.
- aborts still do not render errors.
- stale failures after source changes are still ignored.
- load-more failures use the same mapper as first-chunk failures.

#### Acceptance Criteria

This cleanup is complete when:

- `rg -n "new Error\\(String\\(error\\)\\)" registry/new-york-v4/ui/file-viewer-text-viewer.tsx`
  returns no matches.
- FileViewer text route has exactly one local error coercion function, owned by
  `file-viewer-text-errors.ts`, not exported from the React component file.
- No resource error is wrapped as a format error.
- No abort path renders an error.
- Focused FileViewer tests pass.
- Whole-tree `tsc --noEmit --pretty false` passes.
- Registry build passes.
- `git diff --check` passes.

## Format-Specific Rules

### Text

- Uses `source`.
- Uses `resource.content.readText`.
- Uses `resource.content.payload.kind === "text"` for synchronous inline text
  fast path.
- Bounds errors are typed format/state errors.
- Large files remain virtualized.

### CSV

- URL/Blob/Text file inputs use `ViewerSource`.
- Parsed table input remains a CSV-specific source variant.
- Blob parsing may use workers.
- Text fast path uses `resource.content.payload.kind === "text"`.
- Blob fast path uses `resource.content.payload.kind === "blob"`.
- Streaming uses `resource.content.readStream`.

### Image

- Uses `resource.content.directUrl` for native URL image paths.
- Uses `resource.content.readBytes` for TIFF/signature paths.
- Decode/render failures become image format errors.
- Normal disposal paths are not user-facing errors.

### PDF

- URL PDFs must remain URL-loaded through `resource.content.directUrl`.
- Blob PDFs use `resource.content.readBytes`.
- Document/page caches use `resource.content.key`.
- Metadata-only changes update UI/downloads without reloading PDF.js documents.

### PPTX

- Uses `resource.content.readBytes`.
- Renderer failures become PPTX format errors.
- Renderer and slide bitmap caches have explicit disposal.
- Zero-slide decks are format errors.

### DOCX

- Uses `resource.content.readBytes`.
- Render failures become DOCX format errors.
- Stale async renders are ignored.
- CSS Highlight API absence is normal feature detection.

### XLSX

- Uses `resource.content.readBytes`.
- Workbook cache uses `resource.content.key`.
- Worker failures become XLSX format errors.
- Current-sheet CSV export is a lazy derived download.

### Thumbnails

- Use `ViewerResource`.
- URL image/PDF shortcuts use `resource.content.directUrl`.
- Binary renderers use `resource.content.readBytes`.
- Thumbnail failures are isolated and retryable.

## Module Boundaries

Canonical modules:

```txt
registry/new-york-v4/lib/viewer-source.ts
registry/new-york-v4/lib/viewer-resource.ts
registry/new-york-v4/lib/viewer-download.ts
registry/new-york-v4/lib/viewer-errors.ts
registry/new-york-v4/ui/viewer-download.tsx
registry/new-york-v4/ui/viewer-error.tsx
```

Forbidden dependencies:

```txt
viewer-resource -> React
viewer-resource -> format viewers
viewer-errors -> React
viewer-download -> React
format loaders -> viewer chrome
download mechanics -> format loaders
error UI -> format loaders
```

Allowed dependencies:

```txt
viewer components -> resource, errors, download, format loaders
format loaders -> resource, errors
download UI -> download types
error UI -> error projection, download UI
```

## Naming Standard

Use:

```txt
source
descriptor
resource
format
category
fileName
displayName
mimeType
downloadUrl
originalDownload
derivedDownload
downloadAction
downloadActions
directUrl
payload
readBytes
readText
readBlob
readStream
readRange
keys.load
keys.presentation
keys.resource
```

Avoid:

```txt
src as viewer-domain input
value as viewer-domain input
data when source/resource/payload is meant
file when source/resource is meant
cacheKey without saying which identity it represents
handler/manager names unless the module coordinates multiple lifecycles
```

## Implementation Order

1. Close `ViewerResource`.
2. Migrate all call sites to canonical names.
3. Delete compatibility aliases and adapters.
4. Convert FileViewer internals to resource-first route inputs.
5. Remove unconditional shared logging.
6. Normalize download action usage.
7. Normalize cache lifecycle names only where duplication is real.
8. Rebuild registry output.
9. Delete stale blueprints.
10. Add/keep tests that prevent the old API from returning.

## Maintenance Work

Do future work in this order. Do not start with a new abstraction.

### 1. Cache Vocabulary Cleanup

Goal: make cache lifecycle language consistent without hiding ownership.

Steps:

1. Audit PDF, image, PPTX, DOCX, XLSX, text, CSV, and thumbnail caches.
2. Write down each cache key: `keys.load`, `keys.presentation`, or local state.
3. Write down each disposal rule.
4. Extract only helpers used by at least two caches.
5. Add tests for retry after rejected entries where missing.

Acceptance:

- Every expensive cache has an explicit key choice.
- Every disposable cache entry has an explicit disposal path.
- Rejected entries do not permanently poison retry.
- Extracted helpers reduce code rather than obscure behavior.

### 2. Error And Download Policy Cleanup

Goal: one projection policy for viewer failures and observable download
failures.

Steps:

1. Audit all `ViewerFormatError` creation sites when touching a format loader.
2. Normalize worker failures to `worker_failed` where appropriate.
3. Keep normal disposal/cancellation paths out of user-facing error UI.

Acceptance:

- No user-facing viewer UI parses `error.message`.
- Download failures remain observable and consistently typed.
- Format loaders emit specific format error kinds.

### 3. Whole-Tree Type Health

Goal: the viewer system is not considered perfect while repo-wide typecheck is
red.

Acceptance:

- `./node_modules/.bin/tsc --noEmit --pretty false` passes.
- If unrelated failures remain, they are documented in the final handoff with
  file and line references.

### 4. Concurrency Ownership

Goal: prevent another compatibility edit war.

Steps:

1. Before editing viewer infrastructure, check:

```sh
find registry/new-york-v4 components tests lib -flags uchg -print
```

2. Before a large migration, check for other active agents in this repository.
3. If viewer files change underneath the run, stop and resolve ownership.
4. Do not reintroduce compatibility adapters to make two agents' changes fit.

Acceptance:

- No `uchg` flags on viewer files.
- No simultaneous agent is editing viewer infrastructure.
- Legacy API grep stays clean after a short delay and after registry build.

## Acceptance Gates

The implementation is not done until these searches return no live-code hits:

```sh
rg "getDirectLoad|getOriginalDownload|getInlineText|getBlob|readArrayBuffer|DirectLoadCapability|DownloadCapability" \
  registry/new-york-v4 components tests lib \
  --glob '!public/r/**/*.json' \
  --glob '!components/viewers/VIEWER_CANONICAL_PLATONIC_BLUEPRINT.md'
```

The implementation is not done until these commands pass or have only
documented unrelated failures:

```sh
./node_modules/.bin/tsc --noEmit --pretty false
./node_modules/.bin/vitest run tests/file-viewer.test.tsx tests/text-viewer.test.tsx tests/csv-viewer.test.tsx
./node_modules/.bin/vitest run tests/pdf-viewer-resource.test.ts tests/docx-viewer-resource.test.ts
./node_modules/.bin/vitest run tests/pdf-viewer.test.tsx tests/image-viewer.test.tsx tests/pptx-viewer.test.tsx tests/docx-viewer.test.tsx
./node_modules/.bin/vitest run tests/xlsx-viewer-ref.test.tsx tests/xlsx-components.test.tsx tests/xlsx-workbook.test.ts tests/xlsx-flattener.test.ts
./node_modules/.bin/shadcn build --output public/r
git diff --check
```

## Done Means

Done means:

1. Every canonical viewer has one public data entrypoint: `source`.
2. `ViewerResource` has no legacy methods and no mirrored content read aliases.
3. `resourceBase` creates no compatibility aliases.
4. Direct URL loading uses `resource.content.directUrl`.
5. Original downloads use `originalDownload`.
6. Byte reads use `resource.content.readBytes`.
7. Stream reads use `resource.content.readStream`.
8. Sync text/blob fast paths use `resource.content.payload`.
9. FileViewer routes do not split source identity away from resource behavior.
10. All download mechanics are centralized.
11. All viewer errors project through the canonical error layer.
12. Expensive caches use the right resource key.
13. Metadata-only changes do not reload content.
14. Same-source retry works after failure.
15. Expensive loaders accept the narrowest content capability type they need.
16. Registry output is rebuilt.
17. This document is the only active viewer blueprint.

## Concurrency Warning

Do not run multiple agents that edit viewer files at the same time.

If an agent sees viewer files changing underneath it, or sees macOS immutable
flags such as `uchg` on viewer files, stop and resolve ownership before
continuing. An edit war can leave a hybrid system where TypeScript sees one API
and runtime objects expose another.
