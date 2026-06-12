# File Thumbnail Platonic Blueprint

This file is the source of truth for `DocumentThumbnail` and the
dependency-free `FileThumbnail` shell.

It is subordinate to
`components/viewers/VIEWER_CANONICAL_PLATONIC_BLUEPRINT.md`. Do not duplicate or
fork the viewer source, descriptor, resource, download, content, or error model.
Thumbnails are a small preview surface over the same canonical file
infrastructure.

The architectural reference is the final `FileViewer` model:

```txt
FileViewer receives source.
FileViewer creates ViewerResource.
FileViewer resolves descriptor.
FileViewer routes by descriptor.category.
Routes receive resource.
Expensive loaders receive narrow resource.content capabilities.
Errors project through the canonical viewer error layer.
```

`DocumentThumbnail` must be the thumbnail-sized version of that model, not a
parallel implementation.

## Standard

The thumbnail system must satisfy the same bar as the viewers:

- one public data entrypoint
- no legacy adapters
- no duplicated source model
- no hidden loading path
- no unbounded expensive cache
- no swallowed renderer failure
- no object URL leak
- no broad capability type where a narrow capability type is enough
- no presentation metadata in expensive cache identity
- no thumbnail-specific error taxonomy
- no route-level `src` or `value` vocabulary
- no renderer-local source normalization
- no second resource lifecycle

The end state should feel inevitable:

```txt
ViewerSource
  -> ViewerDescriptor
  -> ViewerResource
      -> FileThumbnail shell metadata
      -> ViewerResourceContent narrow capabilities
          -> thumbnail artifact loader
          -> bounded thumbnail artifact cache
          -> first-unit preview renderer
```

## FileViewer Alignment

`DocumentThumbnail` follows the same resource-first route model as
`FileViewer`.

Canonical flow:

```txt
DocumentThumbnail props.source
  -> createViewerResource(source)
  -> resolveThumbnailDescriptor({ source, as })
  -> getThumbnailKey({ resource, descriptor, options })
  -> getThumbnailRenderKey({ thumbnailKey, anchor, retryKey })
  -> route by descriptor.category
  -> renderer component receives ViewerResource
  -> loader helper receives narrow content capabilities
```

The route component may receive `ViewerResource` because it renders UI metadata
and passes `resource.content` to loaders. The loader must not receive
`ViewerResource` unless it truly needs presentation metadata for output. When it
needs metadata, pass a small explicit metadata object.

This mirrors FileViewer:

```txt
route surface        ViewerResource
load/cache surface   ViewerResourceContent capability subset
error surface        ResourceError | ViewerFormatError -> ViewerErrorInfo
```

Hard rules:

- Public callers never see `ViewerResource`.
- Renderers never receive public `ViewerSource`.
- Loader helpers never create `ViewerResource`.
- Loader helpers never call `createViewerResource`.
- Loader helpers never accept `src`, `url`, or `value`.
- Loader helpers key expensive work from `content.key` through
  `thumbnailKey`.
- Presentation-only metadata is passed separately and named explicitly.

## Public API

The public API is complete and should stay small:

```ts
export interface DocumentThumbnailProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  previewAspectRatio?: number
  anchor?: ThumbnailAnchor
  retryKey?: React.Key
  onError?: (error: unknown, info: ViewerErrorInfo) => void
}
```

Rules:

- `source` is the only file data entrypoint.
- Do not add `src`, `url`, `value`, `text`, `blob`, `bytes`, `downloadName`,
  `file`, or `resource` to the public API.
- `as` only overrides category inference for ambiguous inputs.
- `className` and `previewAspectRatio` only affect shell presentation.
- `anchor` only affects preview positioning.
- `retryKey` only remounts the current preview path and permits retry.
- `onError` receives the original thrown value plus canonical
  `ViewerErrorInfo`.

There is no thumbnail equivalent of FileViewer route-specific public props. A
thumbnail is not an editable viewer, not a download surface, and not a format
router exposed to callers.

## Naming Standard

Use these names exactly:

```txt
source
descriptor
resource
content
thumbnailKey
renderKey
anchor
retryKey
fileName
mimeType
sourceKind
previewImageUrl
artifact
entry
load
dispose
prune
```

Avoid:

```txt
src
value
data when source/content/artifact is meant
file when resource or metadata is meant
cacheKey when the value is specifically thumbnailKey or renderKey
handler/manager when a narrower noun is available
previewResource for cached artifacts
```

The same concept must have the same name everywhere:

- `resource` means `ViewerResource`.
- `content` means loadable `resource.content`.
- `artifact` means a cached decoded/rendered thumbnail result.
- `thumbnailKey` means expensive artifact identity.
- `renderKey` means mounted preview identity.

## Current State

Already correct:

- `DocumentThumbnail` takes `source`, creates `ViewerResource`, and selects a
  renderer from the resolved descriptor.
- `FileThumbnail` remains dependency-free and shipped as the public registry
  shell.
- Cache keys use `resource.keys.load`.
- Render keys include `thumbnailKey`, `anchor`, and `retryKey`.
- Direct non-TIFF URL images use `resource.content.directUrl` and avoid fetch.
- Direct URL image failures are converted to `ViewerFormatError`.
- Resource and format failures project through `toViewerErrorInfo`.
- The static test prevents old legacy resource helpers from returning.

Not yet platonic:

- `getThumbnailText` takes the full `ViewerResource` even though it only needs
  file name, source kind, content identity, range reads, and text reads.
- Format renderers take full `ViewerResource` even when their loaders only need
  bytes, blob, direct URL, text, or identity.
- `markdownCache` is a plain `Map`, so markdown HTML artifacts are unbounded.
- `PdfFirstPage` swallows `page.render(...).promise` failures.
- `PptxFirstSlide` swallows `source.render(...).catch`.
- Blob/object URL image previews do not report `<img>` load failures through
  the canonical thumbnail error path.
- The implementation still permits too much broad resource access in loader
  helpers compared with the final FileViewer content-boundary model.

## Ownership

`DocumentThumbnail` owns orchestration:

- resolving `ViewerDescriptor`
- creating `ViewerResource`
- computing `thumbnailKey`
- computing `renderKey`
- choosing the renderer
- tracking render errors for the current render key
- projecting errors with `toViewerErrorInfo`
- calling `onError(error, info)`
- rendering `FileThumbnail`

`DocumentThumbnail` must not:

- parse file bytes
- sanitize markdown
- create object URLs
- own format-specific caches
- own worker protocols
- expose download behavior
- invent error categories

`FileThumbnail` owns the visual shell:

- aspect ratio
- preview framing
- shimmer
- fallback icon/extension
- loaded/error/loading state presentation
- dependency-free image URL preview
- primitive `onPreviewError` callback

`FileThumbnail` must not:

- import document parsers
- import viewer resources
- import workers
- understand file formats beyond fallback labels
- own canonical error projection

Renderers own one first-unit preview:

- PDF: first page
- image: first image frame
- TIFF: first page
- DOCX: first page
- PPTX: first slide
- XLSX: first sheet region
- CSV: first rows
- markdown: bounded rendered document
- HTML: bounded sandboxed document
- text: bounded first lines

Renderers must not:

- normalize public sources
- choose public API behavior
- use full `ViewerResource` in expensive loader functions
- pass full `ViewerResource` into cache helpers
- create unbounded caches
- swallow failures that should reach the error boundary

## Module Boundaries

Target module responsibilities:

```txt
components/document-thumbnail.tsx
  public orchestration, descriptor resolution, resource creation, routing,
  render key state, canonical error projection

components/document-thumbnail/cache.ts
  thumbnail constants, bounded artifact cache primitive, decode gate,
  text thumbnail loader, thumbnail format error mapper

components/document-thumbnail/keys.ts
  thumbnailKey/renderKey construction only

components/document-thumbnail/errors.tsx
  thumbnail-local error boundary only

components/document-thumbnail/renderers/*
  first-unit route components and private format loaders

registry/new-york-v4/ui/file-thumbnail.tsx
  dependency-free shell only
```

Forbidden dependencies:

- `file-thumbnail.tsx` must not import `viewer-resource`, parser libraries, or
  workers.
- `keys.ts` must not import parser libraries or React runtime helpers beyond
  type-only `React.Key`.
- `cache.ts` must not import `DocumentThumbnail` or renderer modules.
- renderers must not import public `DocumentThumbnailProps`.
- renderers must not import viewer source constructors.

## Capability Contracts

Use the narrow viewer content capability types introduced by the canonical
viewer system.

Allowed broad type:

```txt
ViewerResource
```

Only top-level renderer components may accept `ViewerResource`, because they
need presentation metadata such as `fileName`, `mimeType`, and
`originalDownload`, and they pass narrow data into loader helpers.

Loader helper functions must accept narrow contracts.

Canonical thumbnail contracts:

```ts
type ThumbnailFileMeta = {
  fileName: string
  mimeType?: string
  sourceKind: ViewerSource["kind"]
}

type ThumbnailTextContent = ViewerContentIdentity &
  ViewerContentText &
  ViewerContentRange

type ThumbnailBytesContent = ViewerContentIdentity & ViewerContentBytes

type ThumbnailBlobContent = ViewerContentIdentity & ViewerContentBlob

type ThumbnailImageContent = ViewerContentIdentity &
  ViewerContentDirectUrl &
  ViewerContentBlob
```

Format-specific target:

```txt
getThumbnailText(meta, content, thumbnailKey) -> Promise<string>
getMarkdownDoc(meta, content, thumbnailKey) -> Promise<string>
getPptxFirstSlide(meta, content, thumbnailKey) -> Promise<PptxFirstSlideSource>
getXlsxPreview(meta, content, thumbnailKey) -> Promise<XlsxPreview>
getTiffFirstPageBlob(meta, content, thumbnailKey) -> Promise<Blob>
ImageBlobPreview(content, anchor, onError) -> ReactNode
PdfFirstPage(resource) -> may call shared PDF viewer loader with content
DocxFirstPage(resource) -> may call shared DOCX viewer loader with content
```

Where the inputs are:

```txt
getThumbnailText(meta: ThumbnailFileMeta, content: ThumbnailTextContent, ...)
getMarkdownDoc(meta: ThumbnailFileMeta, content: ThumbnailTextContent, ...)
getPptxFirstSlide(meta: ThumbnailFileMeta, content: ThumbnailBytesContent, ...)
getXlsxPreview(meta: ThumbnailFileMeta, content: ThumbnailBytesContent, ...)
getTiffFirstPageBlob(meta: ThumbnailFileMeta, content: ThumbnailBytesContent, ...)
ImageBlobPreview(content: ThumbnailBlobContent, ...)
```

Rationale:

- `ViewerResource` remains the UI/presentation object.
- `ViewerResourceContent` remains the canonical interned load object.
- Thumbnail loaders declare exactly which reads they perform.
- Cache helpers can no longer accidentally reach unrelated resource fields.
- Tests can enforce the boundary with TypeScript and static scans.

Do not split `ViewerResourceContent` into thumbnail-specific runtime objects.
The viewer system already settled this: one canonical content object, narrow
TypeScript capability views at the use site.

## Cache Model

There are two identities:

```txt
thumbnailKey = expensive artifact identity
renderKey    = mounted React preview identity
```

`thumbnailKey` includes:

- `resource.keys.load`
- resolved descriptor category
- unit, currently `first`
- output-affecting options

`thumbnailKey` excludes:

- `resource.fileName`
- `resource.mimeType`, unless it changes parsing output for that renderer
- `anchor`
- `retryKey`
- shell `className`
- shell `previewAspectRatio`

`renderKey` includes:

- `thumbnailKey`
- `anchor`
- `retryKey`

This is intentional. Metadata-only changes should update labels and callbacks
without throwing away decoded artifacts.

Key rules copied from the viewer system:

- Use `resource.keys.load` for content identity.
- Do not use `resource.keys.presentation` for parsed bytes, decoded frames,
  rendered markdown, worker results, or text fetches.
- Do not use `resource.keys.resource` unless presentation metadata is part of
  the artifact output.
- Do not use array joins with ambiguous delimiters. Keep length-prefixed
  `encodePart`.
- Do not include `retryKey` in `thumbnailKey`; retries remount and allow rejected
  entries to be observed then evicted.

## Cache Infrastructure

Use one bounded cache primitive:

```ts
createThumbnailArtifactCache<T>({
  maxEntries,
  dispose,
})
```

Required behavior:

- LRU touch on `get`.
- `pending` entries are not evicted while every entry is pending.
- resolved evictions call `dispose(value)` when provided.
- rejected entries are retained for one observable read, then deleted so the
  next call retries.
- every format cache must have an explicit `maxEntries`.
- cache names must describe the artifact, not the input source.

Current required cache conversions:

- Keep `textCache` as bounded.
- Keep `pptxCache`, `xlsxCache`, and `tiffCache` as bounded.
- Convert `markdownCache` from `Map` to `createThumbnailArtifactCache`.
- Do not introduce new plain global `Map` caches for artifacts.

Cache vocabulary:

```txt
load      create the artifact
read      consume ViewerResourceContent capabilities
retain    keep an artifact/source alive while mounted
release   drop a mounted retain
dispose   free external resources owned by a resolved artifact
prune     enforce cache policy
retry     repeat a failed load without requiring a source URL change
```

Use this vocabulary consistently. Do not call artifact caches "resources" unless
the code is specifically adapting a Promise for React suspense through
`useThumbnailResource`.

## Loading Model

Correct loading order:

1. `DocumentThumbnail` resolves descriptor.
2. It creates `ViewerResource`.
3. It computes `thumbnailKey`.
4. It computes `renderKey`.
5. Unsupported files render only the `FileThumbnail` shell.
6. Non-TIFF direct URL images use `FileThumbnail.previewImageUrl`.
7. Browser image failures synthesize `ViewerFormatError` and enter the same
   error state as renderer failures.
8. Other formats mount `ClientPreview`.
9. `ClientPreview` gates work until near the viewport.
10. Renderer calls a bounded artifact loader.
11. Loader reads only through narrow content capabilities.
12. Renderer paints the first unit.
13. Any thrown renderer/loader failure reaches `ThumbnailErrorBoundary`.
14. `DocumentThumbnail` records the failure for the current `renderKey`.

The viewport gate is thumbnail-specific. Full viewers must not inherit this
lazy-loading policy.

Retry rule:

- A failed `thumbnailKey` is observable once in the cache.
- A second read deletes the rejected entry and starts a new load.
- Changing `retryKey` must remount the preview and allow same-source retry.
- Changing `source` to a new load identity must ignore stale failures from the
  old render key.
- Changing only metadata must not reload expensive artifacts.

## Error Model

Thumbnail errors use the viewer error system.

Rules:

- Transport, abort, size, range, and HTTP failures remain `ResourceError`.
- Decode, parse, sanitize, worker, and render failures become
  `ViewerFormatError`.
- Browser `<img>` failures become `ViewerFormatError` with format `image` and
  kind `load_failed`.
- `toViewerErrorInfo` is the only user-safe projection.
- UI displays compact failure state through `FileThumbnail`, not a full
  `ViewerErrorState`.
- `aria-label`, `title`, and `data-error-*` attributes carry compact diagnostic
  state.
- `onError` receives the original error and the projected `ViewerErrorInfo`.

No renderer may catch and ignore a failure that prevents the thumbnail from
rendering correctly.

Allowed catch cases:

- cleanup cancellation where unmounted work should not update React state
- best-effort disposal
- optional metadata probing fallback, such as PPTX slide size fallback

Forbidden catch cases:

```ts
page.render(...).promise.catch(() => {})
source.render(...).catch(() => {})
img.onerror without onError propagation
```

Mapping rule:

- Preserve `ResourceError`.
- Map non-resource failures at the smallest format boundary.
- Do not map all failures in `DocumentThumbnail`; it should project already
  typed failures.
- Use `thumbnailCategoryFormat(category)` only when the thumbnail category is
  not already a concrete viewer format.

## Renderer Targets

### Direct URL Images

Target:

- Use `FileThumbnail.previewImageUrl`.
- No fetch.
- No object URL.
- `onPreviewError` emits a canonical image `ViewerFormatError`.
- The shell moves to error state for the current `renderKey`.
- This is the only thumbnail path that may use `previewImageUrl` directly from
  `DocumentThumbnail`.

### Blob Images

Target:

- Loader uses `ViewerContentBlob`.
- Blob read suspends through `useThumbnailResource`.
- Object URL is component-scoped through `useObjectUrl`.
- `<img>` load failure is reported through the same canonical image error path
  as direct URL images.
- No blob image helper may read bytes when `readBlob` is enough.

### TIFF

Target:

- Loader uses `ViewerContentBytes`.
- Worker cache is bounded with `createThumbnailArtifactCache`.
- Worker failures become image `ViewerFormatError(kind: "decode_failed")`.
- Object URL is component-scoped and revoked.
- Image element failures report canonical image load errors.

### PDF

Target:

- Reuse the full PDF viewer document/page resource loaders.
- Loader calls stay keyed by `resource.content.key`.
- URL PDFs keep the PDF.js direct URL fast path through the shared PDF loader.
- Canvas render failure must surface as
  `ViewerFormatError(format: "pdf", kind: "render_failed")`.
- Cancel render tasks on unmount.

### DOCX

Target:

- Reuse the full DOCX byte resource loader.
- Render failures become
  `ViewerFormatError(format: "docx", kind: "render_failed")`.
- Do not cache DOM nodes; cache bytes only through the shared DOCX loader.
- DOCX thumbnail render state is local React state, not a module cache.

### PPTX

Target:

- Loader uses `ViewerContentBytes`.
- Cache is bounded.
- Parse failures become
  `ViewerFormatError(format: "pptx", kind: "parse_failed")`.
- Render failures become
  `ViewerFormatError(format: "pptx", kind: "render_failed")`.
- `source.render(canvas, scale)` failures must reach the error boundary.
- Dispose cached renderer sources when evicted.

### XLSX

Target:

- Loader uses `ViewerContentBytes`.
- Cache is bounded.
- Worker failures become
  `ViewerFormatError(format: "xlsx", kind: "parse_failed")`.
- Parsed rows are capped by `XLSX_THUMBNAIL_MAX_ROWS` and
  `XLSX_THUMBNAIL_MAX_COLUMNS`.

### Text

Target:

- Loader uses `ThumbnailTextContent`.
- URL resources prefer `readRange` for the first
  `TEXT_THUMBNAIL_MAX_BYTES`.
- Blob/text resources use bounded `readText`.
- Cache is bounded.
- JSON pretty-printing is presentation-only and must not affect cache identity.
- Inline text must not fetch.
- Blob text must not fetch.

### CSV

Target:

- Reuse `getThumbnailText`.
- Parsing happens in-memory on bounded text.
- Row/column caps are applied after parsing.
- Dialect inference may use `fileName` and `mimeType` as presentation/parser
  metadata, but expensive text fetch identity must stay content-based.

### Markdown

Target:

- Reuse `getThumbnailText`.
- Markdown-to-HTML artifact cache is bounded.
- Sanitizer failure becomes text `ViewerFormatError(kind: "render_failed")`.
- Sanitized output is rendered in the sandboxed thumbnail iframe.
- Markdown rendering uses the same bounded text input as text thumbnails.

### HTML

Target:

- Reuse `getThumbnailText`.
- Render bounded HTML in sandboxed iframe.
- No scripts, no pointer events, no parent DOM mutation.

## Performance Requirements

Required:

- Direct URL images do not fetch.
- Text-like thumbnails read at most `TEXT_THUMBNAIL_MAX_BYTES`.
- Expensive binary decodes run through `withThumbnailDecodeSlot`.
- Global artifact caches are bounded.
- Metadata-only changes do not invalidate expensive caches.
- Object URLs are revoked on unmount or blob change.
- Render failures do not leave invisible loaded thumbnails.
- Shared viewer loaders are reused where they already provide stronger caching
  than thumbnail-local code.

Non-goals:

- Perfect visual fidelity with full viewers.
- Multi-page preview.
- User controls.
- Download controls.
- Full `ViewerErrorState` UI.
- A generic universal thumbnail cache class beyond the existing bounded artifact
  cache primitive.

## Hard Cut Rules

The thumbnail migration is hard-cut, like the viewer migration.

Forbidden compatibility work:

- Do not keep overloads that accept the old full-resource loader shape.
- Do not keep adapter wrappers named `legacy`, `compat`, `fromSrc`, or
  `fromValue`.
- Do not add aliases from `resource.content` back onto `resource`.
- Do not introduce a thumbnail source type that duplicates `ViewerSource`.
- Do not keep old unbounded caches after bounded caches exist.

If a test needs an old path, update the test to the canonical path.

## Test Requirements

Existing tests to keep:

- `FileThumbnail` state inference.
- dependency-free shell registry item.
- stable `thumbnailKey` for identical load identity.
- metadata-only URL changes preserve expensive cache identity.
- `renderKey` changes for anchor and retry key.
- encoded key parts avoid delimiter collisions.
- output-affecting options change `thumbnailKey`.
- rejected cache entries are observable once before retry.
- artifact caches dispose evicted resolved values.
- shared text cache is bounded.
- object URLs are revoked.
- format errors wrap non-resource failures and preserve `ResourceError`.
- direct URL images avoid fetch.
- direct URL image failures expose canonical errors.
- inline and blob text avoid fetch.
- source change and `retryKey` retry failures.

Tests to add:

- static scan fails when thumbnail loader helpers accept
  `ViewerResourceContent` or full `ViewerResource` unnecessarily.
- `getThumbnailText` can be called with narrow content capabilities.
- `markdownCache` is bounded and evicts old rendered HTML artifacts.
- PDF canvas render rejection reaches `onError` with
  `ViewerFormatError(format: "pdf", kind: "render_failed")`.
- PPTX slide render rejection reaches `onError` with
  `ViewerFormatError(format: "pptx", kind: "render_failed")`.
- Blob image `<img>` error reaches `onError` with image `load_failed`.
- TIFF object URL image error reaches `onError` with image `load_failed`.
- renderer helper signatures do not expose unrelated content operations.
- metadata-only changes update `fileName` display while reusing the same text
  thumbnail artifact.
- same-source retry after a failed thumbnail read succeeds without changing
  `source.url`.
- static scan proves no plain global `new Map<string, ThumbnailCacheEntry` is
  used for rendered artifacts.

## Implementation Order

1. Add thumbnail-local narrow helper types in
   `components/document-thumbnail/cache.ts`.
2. Change `getThumbnailText` to accept file metadata and narrow text content.
3. Update text, CSV, HTML, and markdown renderers to pass narrow content.
4. Convert `markdownCache` to `createThumbnailArtifactCache`.
5. Change PPTX, XLSX, and TIFF loader helpers to accept file metadata plus
   `ViewerContentBytes`.
6. Add a reusable image load error callback path for blob/object URL previews.
7. Make PDF canvas render failures throw through React state instead of being
   swallowed.
8. Make PPTX canvas render failures throw through React state instead of being
   swallowed.
9. Add the missing tests.
10. Update the static forbidden-resource test to enforce narrow loader
    signatures.
11. Run focused thumbnail tests.
12. Run typecheck.
13. Rebuild registry output.

## Acceptance Criteria

Done means:

1. `DocumentThumbnail` still has one public data entrypoint: `source`.
2. `FileThumbnail` remains dependency-free.
3. No thumbnail live code uses legacy resource helpers or mirrored
   `ViewerResource` read aliases.
4. Loader helpers use narrow content capability types.
5. Every global artifact cache is bounded.
6. Direct URL images avoid fetch and report load failures canonically.
7. Blob/object URL image failures report load failures canonically.
8. PDF and PPTX render failures are not swallowed.
9. Cache identity and render identity remain separate.
10. Metadata-only changes do not reload expensive artifacts.
11. Same-source retry works after failure.
12. Stale failures after source changes cannot mark the current render as
    failed.
13. Focused thumbnail tests pass.
14. Full typecheck passes.
15. Registry output is rebuilt.
