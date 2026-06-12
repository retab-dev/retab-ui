# File Thumbnail Platonic Blueprint

This is the target architecture for `FileThumbnail` and `DocumentThumbnail`,
derived from the canonical `FileViewer` system.

The goal is not to make thumbnails use the full viewers. The goal is to make
thumbnails share the same file boundary: one `ViewerSource`, one resolved
descriptor, one `ViewerResource`, and format-specific thumbnail loaders.

This document is now a final-perfection blueprint, not only a migration plan.
The canonical source/resource migration is complete. The remaining work is the
last purity pass: registry packaging, explicit option keys, bounded cache
lifecycle, typed format errors, and naming/module polish.

## North Star

`FileThumbnail` is a pure preview shell.

`DocumentThumbnail` is a small source-aware orchestrator that renders one
thumbnail unit from a `ViewerResource`.

The thumbnail stack must not invent a second file system.

The final shape is:

```txt
ViewerSource
  -> ViewerDescriptor
  -> ViewerResource
  -> thumbnail cache key
  -> render key
  -> first-unit renderer
  -> FileThumbnail shell
```

No step may smuggle in a second identity model.

```tsx
<DocumentThumbnail
  source={{
    kind: "url",
    url: "/samples/report.pdf",
    fileName: "report.pdf",
    mimeType: "application/pdf",
  }}
/>
```

Blob and inline text are first-class:

```tsx
<DocumentThumbnail
  source={{
    kind: "blob",
    blob,
    identityKey: upload.id,
    fileName: upload.name,
    mimeType: upload.type,
  }}
/>

<DocumentThumbnail
  source={{
    kind: "text",
    text,
    fileName: "notes.md",
    mimeType: "text/markdown",
  }}
/>
```

No public `src`, `name`, `type`, or `kind` props survive on canonical
`DocumentThumbnail`. Those are descriptor outputs or adapter concerns, not
parallel source inputs.

## Current Canonical State

The implemented system already has the right spine.

- `DocumentThumbnailProps` exposes `source` and optional `as`.
- `resolveThumbnailDescriptor` delegates to `resolveViewerDescriptor`.
- `createViewerResource(source)` is the only source capability creator.
- Renderer dispatch is keyed by `descriptor.category`.
- Renderers receive `resource`, `descriptor`, `cacheKey`, and `anchor`.
- URL image thumbnails use `resource.getDirectLoad()`.
- Blob image thumbnails use `resource.readBlob()` and `useObjectUrl`.
- Text-like thumbnails use `getThumbnailText(resource, cacheKey)`.
- Binary thumbnails use `resource.readArrayBuffer()` or shared viewer resource
  loaders.
- PDF and DOCX reuse viewer resource loaders.
- Retry identity is split from resource identity.
- Rejected thumbnail cache entries are retryable.
- Suspense and error-boundary behavior is made explicit through
  `useThumbnailResource`.

The remaining imperfections are not structural failures. They are the places
where the system still needs stronger invariants to deserve "platonic ideal."

## Remaining Imperfections

### 1. Registry Boundary

`FileThumbnail` is the registry component. `DocumentThumbnail` is an app-level
orchestrator in `components/`.

That can be correct, but it must be explicit. A perfect system has no ambiguity
about what a consumer receives when installing `@retab/file-thumbnail`.

Final decision required:

- Either ship `DocumentThumbnail` and its renderer infrastructure as a
  dependency-bearing registry item.
- Or keep the registry item dependency-free and document `DocumentThumbnail` as
  Retab app infrastructure, not part of the installable shell.

The second option is probably better. It preserves the shell's strongest
property: no PDF/DOCX/XLSX/PPTX dependencies.

### 2. Cache Lifecycle

The cache model is correct but not yet complete.

Current behavior:

- pending loads are shared
- fulfilled loads are retained
- rejected loads are observable once and then evictable
- Suspense state is tracked per promise with a `WeakMap`

Missing ideal behavior:

- bounded cache size per heavy artifact family
- explicit disposal hook for artifacts that own memory, object URLs, workers, or
  library instances
- test coverage for eviction and disposal

The ideal cache helper must distinguish "small reusable value" from "large
disposable artifact."

### 3. Thumbnail Option Keys

`getThumbnailCacheKey` supports options, but renderer constants are not fully
encoded.

Every option that changes generated thumbnail output must be named and included:

- text max bytes
- CSV max rows
- CSV max columns
- XLSX max rows
- XLSX max columns
- TIFF target width
- PDF render width if cached as an artifact later
- markdown renderer/sanitizer mode if configurable later

CSS-only framing options, such as `anchor`, must stay out of cache identity.

### 4. Typed Format Errors

Transport and bounds failures belong to `ResourceError`.

Format-specific failures are still too generic. A perfect system wraps parse,
decode, and render failures in a consistent viewer/thumbnail format error.

The UI can still show the same fallback. The point is diagnosability, testability,
and future telemetry.

### 5. Name Precision

`DocumentThumbnail` handles images, CSV, HTML, text, markdown, PDFs, office
documents, and TIFF.

The name is serviceable but not exact. The ideal semantic name is closer to:

- `FilePreviewThumbnail`
- `FileSourceThumbnail`
- `ViewerThumbnail`

Renaming is only worth doing if this orchestrator becomes public API. If it
remains internal app infrastructure, stability may beat semantic perfection.

## First Principles

1. A thumbnail is a view of a file source.
2. The source boundary is the same boundary used by `FileViewer`.
3. The shell does not load files.
4. The orchestrator does not parse formats.
5. Format-specific thumbnail loaders own format-specific work.
6. Render options are not source identity.
7. Retry is a render/load attempt version, not a fake source.
8. URL, Blob, and inline text must work without changing component shape.
9. Cache keys must mean loaded data identity.
10. Remount keys must mean React/error-boundary lifecycle.
11. Download naming, display naming, MIME detection, and category detection come
    from the descriptor.
12. Object URLs are created and revoked in one place.
13. Failed resource loads are evictable and retryable.
14. Decoded or parsed thumbnail products have explicit disposal when needed.
15. Heavy thumbnail work is concurrency-limited.
16. Thumbnail code may be smaller than viewer code, but it must not be less
    principled.

## What Stays

`FileThumbnail` remains the dumb shell:

- fixed-ratio frame
- loading shimmer
- loaded preview
- error fallback
- MIME/file extension label
- no document parsing
- no source resolution
- no registry dependency explosion

This component is already close to ideal. It should not learn about PDF, DOCX,
XLSX, workers, object URLs, or `ViewerResource`.

## What Changes

`DocumentThumbnail` changes from this:

```ts
export interface DocumentThumbnailProps {
  src: string
  name: string
  type: string
  kind: DocumentKind
  className?: string
  previewAspectRatio?: number
  anchor?: ThumbnailAnchor
  retryKey?: React.Key
}
```

To this:

```ts
export interface DocumentThumbnailProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  previewAspectRatio?: number
  anchor?: ThumbnailAnchor
  retryKey?: React.Key
}
```

`as` is only a category override, matching `FileViewer`. It exists for files
whose extension or MIME type is missing, wrong, or intentionally viewed as a
different text-like format.

## Terms

Use these words exactly.

| Term         | Meaning                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `source`     | Caller-provided file/text declaration. Same model as `FileViewer`.                                                        |
| `descriptor` | Synchronous normalized metadata: category, display name, MIME type, identity.                                             |
| `resource`   | Runtime file capability: read bytes, text, ranges, Blob, object URL, download.                                            |
| `thumbnail`  | A first-unit preview artifact ready to render in `FileThumbnail`.                                                         |
| `loader`     | Format-specific function that turns `ViewerResource` into a thumbnail artifact.                                           |
| `renderKey`  | React lifecycle key for remounting the thumbnail surface and error boundary.                                              |
| `cacheKey`   | Loaded resource or parsed-thumbnail identity. Derived from `resource.cacheKey` plus thumbnail options that change output. |
| `retryKey`   | Caller-controlled attempt version. It affects render/load attempt keys, not source identity.                              |
| `anchor`     | Visual crop/pinning policy. It affects output framing, not file bytes.                                                    |

## Public API

```ts
export type ThumbnailAnchor = "top-left" | "top-right" | "bottom-left"

export interface DocumentThumbnailProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  previewAspectRatio?: number
  anchor?: ThumbnailAnchor
  retryKey?: React.Key
}
```

The canonical component does not accept:

- `src`
- `name`
- `type`
- `kind`
- `file`
- `downloadFileName`
- `resourceKey`

Compatibility adapters may exist briefly, but they must not be the canonical
API and must be deleted after call sites migrate.

## Source Resolution

`DocumentThumbnail` follows the same shape as `FileViewer`:

```ts
export function resolveThumbnailDescriptor({
  source,
  as,
}: {
  source: ViewerSource
  as?: FileCategory
}): ViewerDescriptor
```

Rules:

- Use `FileCategory` exactly as `FileViewer` does.
- Use `resolveViewerDescriptor({ source, category: as })`.
- Use `descriptor.displayName` for the shell file name.
- Use `descriptor.mimeType` for the shell MIME type.
- Use `descriptor.category` for renderer selection.
- Do not create a thumbnail-only descriptor subtype unless there is new
  thumbnail-only metadata. There is none in the ideal design.
- Do not reparse file names in `DocumentThumbnail`.
- Do not pass `name` or `type` separately once a descriptor exists.

## Resource Creation

`DocumentThumbnail` creates one resource:

```ts
const descriptor = resolveThumbnailDescriptor(props)
const resource = React.useMemo(
  () => createViewerResource(props.source),
  [props.source]
)
const directLoad = resource.getDirectLoad()
```

If `as` changes category, descriptor and route change. Resource identity remains
file identity. Format caches must include the category/options they need.
Direct browser-load paths come from `resource.getDirectLoad()`, not
`descriptor`, not `source.url`, and not download metadata.

## Lifecycle Keys

There are three keys, and they must not be conflated.

### Resource Cache Key

`resource.cacheKey`

Used for loaded bytes/text and shared parsed source state. This is the same
semantic key the viewers use.

### Thumbnail Cache Key

```ts
thumbnailCacheKey = [
  resource.cacheKey,
  descriptor.category,
  thumbnailUnit,
  thumbnailOptionsKey,
].join("\0")
```

Used for artifacts that depend on thumbnail-specific output:

- first page canvas
- first slide renderer
- first sheet rows
- first TIFF frame Blob
- sanitized markdown HTML

`anchor` is included only when it changes the generated artifact. If it only
changes CSS positioning, it belongs in `renderKey`, not cache identity.

### Render Key

```ts
renderKey = [thumbnailCacheKey, anchor, encodeRetryKey(retryKey)].join("\0")
```

Used for React remounts and error-boundary resets.

Changing `retryKey` must force a fresh attempt. It may also bypass a rejected
thumbnail cache entry. It must not pretend the file is a different source.

## Module Boundaries

Target files:

```txt
registry/new-york-v4/ui/file-thumbnail.tsx

components/document-thumbnail.tsx
components/document-thumbnail/types.ts
components/document-thumbnail/descriptor.ts
components/document-thumbnail/keys.ts
components/document-thumbnail/cache.ts
components/document-thumbnail/errors.tsx
components/document-thumbnail/renderers/layout.tsx
components/document-thumbnail/renderers/use-object-url.ts
components/document-thumbnail/renderers/pdf-thumbnail.tsx
components/document-thumbnail/renderers/docx-thumbnail.tsx
components/document-thumbnail/renderers/pptx-thumbnail.tsx
components/document-thumbnail/renderers/xlsx-thumbnail.tsx
components/document-thumbnail/renderers/image-thumbnail.tsx
components/document-thumbnail/renderers/tiff-thumbnail.tsx
components/document-thumbnail/renderers/csv-thumbnail.tsx
components/document-thumbnail/renderers/markdown-thumbnail.tsx
components/document-thumbnail/renderers/html-thumbnail.tsx
components/document-thumbnail/renderers/text-thumbnail.tsx
```

Responsibilities:

| Module                   | Responsibility                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `file-thumbnail.tsx`     | Pure shell only.                                                                                 |
| `document-thumbnail.tsx` | Source orchestration, resource creation, client/in-view gate, error boundary, renderer dispatch. |
| `types.ts`               | Public types only. No key construction.                                                          |
| `descriptor.ts`          | Descriptor resolution and category override.                                                     |
| `keys.ts`                | `thumbnailCacheKey`, `renderKey`, retry key encoding.                                            |
| `cache.ts`               | Shared thumbnail cache helpers, rejected-entry eviction, decode concurrency, profiling.          |
| `errors.tsx`             | Boundary that reports failure to shell state.                                                    |
| `renderers/*`            | Format-specific first-unit loading and rendering.                                                |

No renderer imports another renderer. No renderer owns public API types. No
renderer accepts raw `src`.

## Renderer Contract

Every renderer receives the same object:

```ts
export interface ThumbnailRendererProps {
  resource: ViewerResource
  descriptor: ViewerDescriptor
  cacheKey: string
  anchor: ThumbnailAnchor
}

export type ThumbnailRenderer = (
  props: ThumbnailRendererProps
) => React.ReactNode
```

Renderer registry:

```ts
const THUMBNAIL_RENDERERS: Record<
  Exclude<FileCategory, "unsupported">,
  ThumbnailRenderer
>
```

Unsupported category renders the `FileThumbnail` fallback through shell state.

## Loader Contract

Format loaders use one cache helper:

```ts
export interface ThumbnailCacheEntry<T> {
  promise: Promise<T>
  status: "pending" | "fulfilled" | "rejected"
}

export function cachedThumbnailResource<T>(
  cache: Map<string, ThumbnailCacheEntry<T>>,
  key: string,
  load: () => Promise<T>
): Promise<T>
```

Rules:

- Return the same promise for concurrent calls.
- Keep rejected promises observable long enough for the error boundary to see
  them.
- Evict rejected entries on the next lookup so retry can create a fresh promise.
- Let fulfilled promises stay reusable until cache eviction.
- Support explicit cache size limits where artifacts are large.
- Dispose artifacts on eviction when they have disposal semantics.
- Never make `retryKey` part of source identity.

## Shared Cache Helpers

`cache.ts` should expose:

```ts
export function withThumbnailDecodeSlot<T>(load: () => Promise<T>): Promise<T>

export function cachedThumbnailResource<T>(
  cache: Map<string, ThumbnailCacheEntry<T>>,
  key: string,
  load: () => Promise<T>
): Promise<T>

export function useThumbnailResource<T>(promise: Promise<T>): T

export function timedThumbnail<T>(
  label: string,
  load: () => Promise<T>
): Promise<T>
```

The concurrency gate stays. It is valuable. Rename it from generic
`withDecodeSlot` to `withThumbnailDecodeSlot` so its domain is obvious.

`useThumbnailResource` is not optional ceremony. It gives every renderer the same
Suspense/error contract:

- pending promise throws the promise
- fulfilled promise returns the value
- rejected promise throws the error

The record must live outside the suspended component instance, keyed by promise,
because React can discard a component instance before commit.

## Format Policies

### Image

Fast path.

For URL sources:

- use `resource.getDirectLoad()`
- render with `<img>`
- no fetch
- no object URL

For Blob sources:

- create object URL through one hook
- revoke on cleanup

For text sources:

- unsupported

Image thumbnail must not use `previewImageUrl={src}` because `src` no longer
exists.

Image thumbnail must not use `resource.getOriginalDownload()` as a loading URL.
Downloads and direct browser loads are separate capabilities in the actual
`FileViewer` system.

### PDF

Use shared PDF resource cache.

```ts
const doc = React.use(getDocumentResource(resource))
const page = React.use(getPageResource(doc, 1))
```

Rules:

- Do not re-fetch PDF bytes.
- Preserve PDF.js URL loading behavior through the existing PDF loader.
- Canvas render task is owned by the thumbnail component and cancelled on
  cleanup.
- `anchor` is CSS only.

### DOCX

Use the shared DOCX resource loader.

```ts
const buffer = React.use(getDocxResource(resource))
```

Rules:

- Do not duplicate DOCX fetch/cache logic.
- Pass `buffer.slice(0)` to `docx-preview` if the library mutates or transfers.
- Rendering remains effect/ref-owned because `docx-preview` mutates the DOM.
- Limit concurrent renders through `withThumbnailDecodeSlot`.

### PPTX

Use `resource.readArrayBuffer()` through a thumbnail loader.

Target:

```ts
getPptxThumbnailSource(resource, cacheKey): Promise<PptxThumbnailSource>
```

Rules:

- No raw fetch.
- Parse/render first slide only.
- Retain renderer only as long as cache policy allows.
- Dispose renderer if the library exposes disposal.
- Slide size detection remains format-specific.

Later ideal: share lower-level PPTX source creation with `PptxViewer` without
forcing the thumbnail to mount the viewer.

### XLSX

Use `resource.readArrayBuffer()` through the worker parser.

Rules:

- No raw fetch.
- Parse first sheet preview only.
- Keep max rows/columns explicit thumbnail options.
- Worker message includes only thumbnail limits.
- Cache key includes rows/columns limits.

Later ideal: once `XlsxViewer` migrates to `ViewerResource`, share workbook
parse primitives where it is cheaper than duplicating.

### TIFF

TIFF is not a public `FileCategory`; descriptor detection classifies it as
`image`. It is an internal image-thumbnail subroute selected by extension or
MIME type when the image fast path is not enough.

Use `resource.readArrayBuffer()` and worker decode.

Rules:

- No raw fetch.
- Worker returns a Blob or ImageBitmap for first frame only.
- Object URL ownership stays in `useObjectUrl`.
- Decode target width is a named thumbnail option and part of cache key.

### Text

Use `resource.readText({ maxBytes })`.

Rules:

- URL resources may use `readRange` if available and useful.
- Blob/text resources must work.
- JSON pretty-printing remains display logic.
- Cache key includes max bytes.
- Rejected loads are evicted.

### CSV

Use thumbnail text loading, then parse first rows.

Rules:

- No `line.split(",")` as the final model.
- Use the same CSV delimiter inference/parser as `CsvViewer` where practical.
- Keep max rows/columns explicit.
- Parsed table input, if ever supported, is CSV-specific and not `ViewerSource`.

### Markdown

Use thumbnail text loading, then markdown/sanitize.

Rules:

- No raw fetch.
- Sanitization remains mandatory.
- Cache key includes max bytes and sanitizer/renderer-relevant options if they
  become configurable.

### HTML

Use thumbnail text loading or inline text source.

Rules:

- No raw fetch.
- Render into sandboxed iframe.
- Scripts disabled.
- Blob HTML can be read as text.

## Error Model

Thumbnail errors should preserve source of failure.

Use:

- `ResourceError` for fetch, HTTP, abort, range, size.
- `ViewerFormatError` for parse/decode/render failures.

The error boundary does not need to show detailed errors in the UI, but tests
should assert that the loader throws meaningful error types.

Rejected cache entries must be removed. A user should not need to alter the
source to recover from one transient failure.

## Retry Model

`retryKey` means "try rendering again."

It affects:

- React `key`
- error boundary reset key
- optionally a retry version passed to `cachedThumbnailResource`

It does not affect:

- `resource.identityKey`
- `resource.cacheKey`
- descriptor category
- display name

If a cache entry rejects, it is evicted automatically. Therefore most retries do
not need a new cache key. `retryKey` still matters for resetting the boundary and
remounting imperative renderers.

## In-View Loading

Keep lazy in-view loading.

Rules:

- Do not start heavy parsing before the thumbnail is near the viewport.
- Keep `rootMargin` explicit.
- Name the hook `useThumbnailInView`.
- It returns `{ ref, isSeen }`.
- Once seen, it stays seen.

This is render scheduling, not source identity.

## Shell State

`DocumentThumbnail` maps loader state to `FileThumbnail` state.

```tsx
<FileThumbnail
  file={{
    name: descriptor.displayName,
    type: descriptor.mimeType ?? "",
  }}
  state={failedRenderKey === renderKey ? "error" : "loaded"}
  previewContent={<ClientPreview key={renderKey} ... />}
/>
```

The shell should not know whether the preview came from PDF.js, a worker, an
iframe, or an object URL.

## Naming Rules

Use these names consistently:

| Concept                      | Name         |
| ---------------------------- | ------------ |
| Caller file declaration      | `source`     |
| Normalized metadata          | `descriptor` |
| Runtime capabilities         | `resource`   |
| Format category              | `category`   |
| React reset key              | `renderKey`  |
| Loader cache key             | `cacheKey`   |
| Crop pinning                 | `anchor`     |
| First page/slide/sheet       | `unit`       |
| Thumbnail dimensions/options | `options`    |

Forbidden names in canonical thumbnail code:

- `src`
- `name` as a public prop
- `type` as a public prop
- `kind` as a public prop
- `resourceKey`
- `requestKey`
- `downloadFileName`

Internal DOM attributes such as iframe `srcDoc` are fine because they are native
browser concepts, not file-source API.

## Final Perfection Plan

The migration is complete. The remaining plan is not a rewrite. It is four small
purity passes.

### Phase 1: Registry Boundary

Decide and encode the packaging truth.

Preferred final model:

- `FileThumbnail` remains the registry component.
- `FileThumbnail` remains dependency-free.
- `DocumentThumbnail` remains app infrastructure because it pulls viewer
  dependencies and format workers.
- Docs clearly separate installable shell API from Retab's first-unit
  orchestrator API.

Implementation steps:

1. Audit `registry.json` for `file-thumbnail`.
2. Ensure the registry item includes only the shell and shell dependencies.
3. Update docs language so `DocumentThumbnail` is described as an app-side
   helper built on the shell, not automatically installed by the registry item
   unless that is actually true.
4. If `DocumentThumbnail` should become installable, create a separate registry
   item such as `document-thumbnail` or `file-preview-thumbnail` with explicit
   dependencies.
5. Do not silently make `file-thumbnail` pull PDF/DOCX/XLSX/PPTX libraries.

Success criteria:

- A consumer knows exactly what `npx shadcn add @retab/file-thumbnail` installs.
- The dependency boundary is visible in docs and registry metadata.
- `FileThumbnail` stays pure.

### Phase 2: Explicit Thumbnail Options

Create named constants and feed them into `getThumbnailCacheKey`.

Target constants:

```ts
const TEXT_THUMBNAIL_MAX_BYTES = 64 * 1024
const CSV_THUMBNAIL_MAX_ROWS = 16
const CSV_THUMBNAIL_MAX_COLUMNS = 6
const XLSX_THUMBNAIL_MAX_ROWS = 16
const XLSX_THUMBNAIL_MAX_COLUMNS = 6
const TIFF_THUMBNAIL_TARGET_WIDTH = 320
```

Target option keys:

```ts
getThumbnailCacheKey({
  resource,
  descriptor,
  options: [thumbnailOption("text-max-bytes", TEXT_THUMBNAIL_MAX_BYTES)],
})
```

Rules:

- Every output-changing constant has a name.
- Every output-changing constant is in the cache key.
- CSS-only layout choices stay out of the cache key.
- Option key construction uses length-prefixed encoding, never ad hoc joins.

Success criteria:

- Changing `XLSX_THUMBNAIL_MAX_ROWS` changes the XLSX thumbnail cache key.
- Changing `TIFF_THUMBNAIL_TARGET_WIDTH` changes the TIFF thumbnail cache key.
- Changing `anchor` changes only the render key.

### Phase 3: Bounded Disposable Caches

Add a small cache primitive for heavy thumbnail artifacts.

Target API:

```ts
export interface DisposableThumbnailValue {
  dispose?: () => void
}

export interface ThumbnailArtifactCacheOptions<T> {
  maxEntries: number
  dispose?: (value: T) => void
}

export function createThumbnailArtifactCache<T>(
  options: ThumbnailArtifactCacheOptions<T>
): ThumbnailArtifactCache<T>
```

Rules:

- Text cache can remain simple.
- Markdown HTML can remain simple unless memory growth is observed.
- TIFF Blob cache should be bounded.
- PPTX renderer/source cache should be bounded.
- XLSX preview cache should be bounded.
- Evicting fulfilled entries calls `dispose` when provided.
- Evicting rejected entries does not call `dispose`.
- Pending entries are not evicted unless the cache explicitly supports abort.

Initial max sizes:

- TIFF first-frame blobs: 48 entries
- PPTX first-slide sources: 16 entries
- XLSX previews: 64 entries
- Markdown HTML: 128 entries, optional
- Text heads: 256 entries, optional

Success criteria:

- A large thumbnail grid cannot grow binary caches without bound.
- Disposal is tested.
- Cache behavior remains deterministic under concurrent loads.

### Phase 4: Typed Format Errors

Add a format-error wrapper shared with the viewer system if one exists; otherwise
add a thumbnail-local type that can later be promoted.

Target shape:

```ts
export type ThumbnailFormatErrorKind =
  | "parse_failed"
  | "decode_failed"
  | "render_failed"
  | "unsupported_format"

export class ThumbnailFormatError extends Error {
  readonly kind: ThumbnailFormatErrorKind
  readonly category: FileCategory
  readonly fileName: string
  readonly cause?: unknown
}
```

Rules:

- Resource loading failures stay `ResourceError`.
- CSV parser failures become `parse_failed`.
- Markdown sanitizer/renderer failures become `render_failed`.
- HTML read failures stay resource failures; iframe rendering failures are
  render failures only if detectable.
- PPTX load/render failures become `parse_failed` or `render_failed`.
- XLSX worker failures become `parse_failed`.
- TIFF worker failures become `decode_failed`.
- DOCX `docx-preview` failures become `render_failed`.
- PDF.js document/page failures should preserve the original PDF.js error as
  `cause`.

Success criteria:

- Tests assert at least one typed format error from text-like and binary
  renderer paths.
- Error boundary behavior does not change visually.
- Future telemetry can distinguish network, bounds, parse, decode, and render
  failures.

### Phase 5: Naming Decision

Decide whether `DocumentThumbnail` is public enough to rename.

If it remains internal:

- Keep `DocumentThumbnail`.
- Document that it handles files broadly, not only documents.
- Avoid churn.

If it becomes public:

- Rename to `FilePreviewThumbnail` or `ViewerThumbnail`.
- Keep a short temporary adapter only for local call-site migration.
- Delete the adapter before declaring the component ideal.

Preferred decision today:

- Keep `DocumentThumbnail` unless packaging changes make it public API.

Success criteria:

- There is no ambiguity in docs or exports about what is public and what is
  Retab app infrastructure.

## Tests

The current tests already cover the canonical source API, render keys, fallback
behavior, retry, object URL cleanup, URL image fast path, Blob text, and inline
text. The final pass adds tests for option identity, bounded caches, and typed
errors.

### Source API Tests

- URL source renders name/type from descriptor.
- Blob source renders name/type from descriptor.
- Text source renders text thumbnail.
- `as` overrides category.
- Old `src/name/type/kind` props are TypeScript errors or absent from docs.

### Key Tests

- `resource.cacheKey` changes when file bytes/source identity changes.
- `cacheKey` changes when category or thumbnail output options change.
- `cacheKey` changes when renderer constants that affect output change.
- `renderKey` changes when `anchor` changes.
- `renderKey` changes when `retryKey` changes.
- `retryKey` preserves primitive type distinctions.

### Loader Tests

- Rejected entries are evicted.
- Rejected entries are observable by the error boundary before eviction.
- Concurrent same-key loads share one promise.
- Heavy caches evict oldest fulfilled artifacts.
- Heavy caches call disposal on eviction.
- Blob sources do not call `fetch`.
- Text sources do not call `fetch`.
- URL sources use resource methods, not raw renderer fetches.

### Renderer Tests

- PDF uses shared `getDocumentResource(resource)`.
- DOCX uses shared `getDocxResource(resource)`.
- PPTX reads through `resource.readArrayBuffer()`.
- XLSX reads through `resource.readArrayBuffer()`.
- TIFF reads through `resource.readArrayBuffer()`.
- Image Blob path creates and revokes object URL.
- HTML iframe is sandboxed.
- Markdown output is sanitized.
- CSV uses the shared parser/inference path.

### Integration Tests

- Failed render shows `FileThumbnail` fallback.
- Changing `source` recovers from error.
- Changing `retryKey` recovers from error.
- In-view gate delays renderer work until seen.
- A grid of many thumbnails respects decode concurrency.
- Registry install metadata matches the documented dependency boundary.

## Completed Success Criteria

The canonical migration is complete when:

- `DocumentThumbnailProps` exposes `source`, not `src`.
- No canonical thumbnail renderer accepts `src`.
- No renderer calls `fetch` directly except through `ViewerResource`.
- Blob sources work for every binary thumbnail that can reasonably render them.
- Inline text works for text, markdown, HTML, and CSV where applicable.
- PDF and DOCX thumbnails reuse their viewer resource loaders.
- Failed loads are retryable without changing source identity.
- `FileThumbnail` remains dependency-free and unaware of document formats.
- Docs teach only the canonical API.
- Tests cover URL, Blob, inline text, retry, cache identity, and object URL
  cleanup.

These are now the implemented baseline.

## Platonic Success Criteria

The component deserves "platonic ideal" only when the remaining criteria are
also true:

- The registry boundary is explicit and tested against registry metadata.
- `DocumentThumbnail` is either clearly internal or separately packaged.
- Every output-changing thumbnail constant is included in `cacheKey`.
- Heavy artifact caches are bounded.
- Heavy artifact caches dispose values that need disposal.
- Rejected cache entries are observable once, then retryable.
- Format-specific failures are typed.
- Tests cover transport errors and format errors separately.
- Naming is either exact or intentionally preserved for stability.
- The docs contain no ambiguity between the shell and the orchestrator.

## Final Shape

```tsx
export function DocumentThumbnail(props: DocumentThumbnailProps) {
  const descriptor = resolveThumbnailDescriptor(props)
  const resource = React.useMemo(
    () => createViewerResource(props.source),
    [props.source]
  )
  const directLoad = resource.getDirectLoad()
  const cacheKey = getThumbnailCacheKey({ resource, descriptor, options })
  const renderKey = getThumbnailRenderKey({
    cacheKey,
    anchor,
    retryKey,
  })

  return (
    <FileThumbnail
      file={{
        name: descriptor.displayName,
        type: descriptor.mimeType ?? "",
      }}
      previewAspectRatio={previewAspectRatio}
      className={className}
      state={failedRenderKey === renderKey ? "error" : "loaded"}
      previewContent={
        <ClientPreview
          key={renderKey}
          resource={resource}
          descriptor={descriptor}
          cacheKey={cacheKey}
          anchor={anchor}
          onError={() => setFailedRenderKey(renderKey)}
        />
      }
    />
  )
}
```

That is the ideal: everything needed, nothing more. The file boundary is shared
with `FileViewer`; the thumbnail-specific work remains thumbnail-specific; the
shell stays pure.
