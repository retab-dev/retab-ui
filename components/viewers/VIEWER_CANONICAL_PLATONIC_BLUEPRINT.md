# Viewer Canonical Platonic Blueprint

This blueprint defines the remaining work required to take the viewer
infrastructure from "strong canonical v1" to the closest practical version of
the platonic ideal.

Platonic ideal means:

- simplicity
- speed
- everything needed
- nothing more
- perfect modularization
- high-entropy code
- perfectly consistent variable names
- no compatibility residue
- no accidental local policy
- no duplicated lifecycle logic

The current system is much better than the original state. The shared model now
exists:

```txt
ViewerSource -> ViewerDescriptor -> ViewerResource
ViewerResource -> format loader -> viewer state
ViewerResource -> ViewerDownloadAction -> ViewerDownloadControl
ResourceError | ViewerFormatError | ViewerStateError -> ViewerErrorInfo -> ViewerErrorState
```

That is the correct shape. The remaining work is not another rewrite. It is a
precision pass: reduce the public and internal surface to the irreducible model,
delete transitional vocabulary, make all naming exact, and prove every
cross-cutting primitive under at least two non-text viewers.

## Verdict

We have not reached the platonic ideal yet.

We have reached a good canonical foundation.

The foundation has survived:

- `TextViewer`
- `CsvViewer`
- `ImageViewer`
- `PdfViewer`
- `PptxViewer`
- `DocxViewer`
- `XlsxViewer`
- `FileViewer` routing

That is enough proof that the shared primitives are real. It is not enough to
declare perfection because several details still carry historical pressure:

- `ViewerResource` exposes more methods than most viewers need.
- `getOriginalDownload()` is accurate but not the final name.
- `src` still exists inside FileViewer text, markdown, and HTML internals.
- error UI is canonical, but error policy is still a hand-coded function.
- download failure state exists structurally but is not unified with viewer
  error presentation.
- cache lifecycle conventions are repeated per format.
- some root files are alias re-exports instead of first-class canonical modules.
- old blueprint files still describe superseded concepts.

The ideal is reachable, but it requires one focused pass across source,
resource, download, error, cache, and FileViewer internals.

## Current Canonical Modules

The current important modules are:

```txt
registry/new-york-v4/lib/viewer-source.ts
registry/new-york-v4/lib/viewer-resource.ts
registry/new-york-v4/lib/viewer-download.ts
registry/new-york-v4/lib/viewer-errors.ts
registry/new-york-v4/ui/viewer-download.tsx
registry/new-york-v4/ui/viewer-error.tsx
```

Root alias files currently exist:

```txt
lib/viewer-download.ts
lib/viewer-errors.ts
components/ui/viewer-error.tsx
```

Those root files re-export registry implementations. That is acceptable for the
current registry architecture, but it is not conceptually perfect. A perfect
system has one obvious canonical source file for application code and one
registry-copy strategy that does not make readers wonder which file owns the
logic.

## Current Architecture Audit

### Source

The canonical public source model is:

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

This is the right public shape.

Good:

- one public source prop on canonical viewers
- no public `src` plus `value` ambiguity
- URL, Blob, and inline text are explicit
- Blob sources require explicit identity
- URL sources preserve library direct-load behavior
- text sources remain distinct from file bytes

Not perfect:

- internal FileViewer text/HTML/markdown modules still name URL strings `src`
- some older helper types and docs still mention `src` as a conceptual input
- source metadata and presentation keys are close but not linguistically final

The ideal does not ban the word `src` in every browser-specific call. It bans
`src` as a viewer-domain concept. If a function takes a URL string, it should say
`url` unless it is literally passing an iframe/image DOM `src` prop.

### Descriptor

`ViewerDescriptor` is the normalized metadata layer. It should answer only:

```txt
What category is this file?
What should the user see?
What filename should downloads use?
What MIME type do we know?
What stable identity should the resource use?
```

Good:

- descriptor logic is centralized
- `fileName` is now the canonical filename field
- category is resolved once
- FileViewer routing is increasingly descriptor-driven

Not perfect:

- old tests and docs were still using `downloadFileName` until recent cutovers
- `descriptor.identityKey` and `resource.identityKey` need a final naming audit
- descriptor currently participates in multiple key concepts without each key
  having a fully obvious name at call sites

The ideal descriptor type should feel boring:

```ts
export interface ViewerDescriptor {
  category: ViewerCategory
  displayName: string
  fileName: string
  mimeType?: string
  sourceIdentity: string
}
```

Whether the final field is `sourceIdentity`, `identityKey`, or `stableIdentity`
matters less than making the same term appear everywhere.

### Resource

`ViewerResource` currently exposes:

```ts
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
```

This is powerful and useful. It is not minimal.

Good:

- one resource object per source identity
- URL and Blob resources are interned
- inline text resources are intentionally not globally interned
- resource objects are frozen
- direct URL loading is preserved for PDF and other libraries
- byte, text, Blob, stream, and range reads are standardized
- resource errors are typed
- source identity and presentation identity are separated through keys

Not perfect:

- the interface exposes every capability to every caller
- `getInlineText()` and `getBlob()` are escape hatches
- `getDirectLoad()` is named around the consumer, not around the capability
- `getOriginalDownload()` is correct but verbose and method-shaped
- `keys.load`, `keys.presentation`, `keys.resource` are good, but not yet
  self-evident enough to prevent misuse
- `identityKey` may duplicate `descriptor.identityKey`
- `readRange` semantics differ subtly between URL, Blob, and text

The ideal resource interface should separate capability groups without making
call sites heavy.

Target:

```ts
export interface ViewerResource {
  readonly source: ViewerSource
  readonly descriptor: ViewerDescriptor
  readonly kind: ViewerSource["kind"]
  readonly keys: ViewerResourceKeys

  readonly originalDownload: ViewerDownloadAction
  readonly directUrl: string | null

  readBlob(options?: ResourceReadOptions): Promise<Blob>
  readBytes(options?: ResourceReadOptions): Promise<ArrayBuffer>
  readText(options?: TextReadOptions): Promise<string>
  readStream(options?: ResourceReadOptions): Promise<ReadableStream<Uint8Array>>
  readRange(
    range: ByteRange,
    options?: ResourceReadOptions
  ): Promise<ByteRangeResult>
}
```

Delete or replace:

```txt
getOriginalDownload() -> originalDownload
getDirectLoad() -> directUrl
readArrayBuffer() -> readBytes()
stream() -> readStream()
getInlineText() -> inlineText capability or no public method
getBlob() -> blob capability or no public method
```

The question is whether `getInlineText()` and `getBlob()` are actually needed.
They exist for fast-path loaders. If a loader genuinely needs a synchronous
fast-path, make that explicit:

```ts
export type ViewerResourcePayload =
  | { kind: "url"; url: string }
  | { kind: "blob"; blob: Blob }
  | { kind: "text"; text: string }

resource.payload
```

That is cleaner than three separate methods.

But do not add `payload` until every current `getInlineText()` and `getBlob()`
call is audited. The perfect model may be:

```ts
resource.directUrl
resource.readText()
resource.readBlob()
```

with no synchronous payload access at all except where performance proves it.

### Resource Keys

Current:

```ts
export interface ViewerResourceKeys {
  readonly load: string
  readonly presentation: string
  readonly resource: string
}
```

This is one of the best parts of the current system. It captures a real
distinction:

- `load`: bytes/content identity
- `presentation`: metadata that changes display/download/chrome
- `resource`: full identity of the resource object

Good usage:

- PDF document cache should use `keys.load`
- XLSX parsed workbook cache should use `keys.load`
- viewer reset for source bytes should use `keys.load`
- toolbar labels/download metadata should respond to `keys.presentation`
- resource interning should use `keys.resource`

Not perfect:

- the names are slightly abstract
- some call sites still need an audit to ensure they use the right key
- test coverage should assert every format uses `load` versus `resource`
  intentionally

Potential final names:

```ts
export interface ViewerResourceKeys {
  readonly content: string
  readonly presentation: string
  readonly resource: string
}
```

`content` may be clearer than `load`. It says what the key represents, not what
the viewer does with it.

If renamed:

```txt
keys.load -> keys.content
```

Do not rename unless it improves every call site. `load` is already acceptable.
The platonic test is whether a new contributor can choose the right key without
reading the key builder implementation.

### Download

Current:

```ts
export type ViewerDownloadOrigin = "original" | "derived"

export type ViewerDownloadPayload =
  | { kind: "href"; href: string }
  | { kind: "blob"; blob: Blob }
  | { kind: "text"; text: string; mimeType?: string }
  | { kind: "none" }

export interface ViewerDownloadAction {
  id: string
  label: string
  fileName: string
  origin: ViewerDownloadOrigin
  isDisabled?: boolean
  getPayload: (options?: {
    signal?: AbortSignal
  }) => ViewerDownloadPayload | Promise<ViewerDownloadPayload>
}
```

This is close to ideal.

Good:

- original and derived downloads share one action model
- browser mechanics live in one UI module
- true href downloads render as anchors
- Blob/text/derived payloads materialize lazily on click
- object URL creation and revocation are centralized
- abort lifecycle is now present in the control
- menu and single-button controls share the same action model
- XLSX current-sheet CSV export proves a second derived export path

Not perfect:

- `getOriginalDownload()` should become `originalDownload`
- download errors are not integrated into shared viewer error presentation
- error callback exists, but default visual behavior is intentionally quiet
- `ViewerDownloadAction.id` uniqueness rules need one documented invariant
- multi-action labels are viewer-local and not fully standardized

The ideal download invariant:

```txt
ViewerResource owns originalDownload.
Viewers may add derived downloads.
ViewerDownloadControl executes all download actions.
No viewer creates object URLs.
No viewer clicks anchors.
No viewer serializes derived bytes during render.
```

Final API target:

```ts
export interface ViewerDownloadAction {
  id: ViewerDownloadActionId
  label: string
  fileName: string
  origin: "original" | "derived"
  getPayload(options?: ViewerDownloadOptions): Awaitable<ViewerDownloadPayload>
}
```

Consider removing `isDisabled` from actions and representing disabled as either:

```ts
ViewerDownloadAction | null
```

or:

```ts
{
  kind: "disabled"
  reason: string
}
```

Current `isDisabled` is pragmatic. It is not perfectly high entropy because it
creates an action that cannot act.

Recommendation: keep `isDisabled` until at least one real disabled user-facing
case appears. If none appears, delete it and use `null`.

### Errors

Current:

```ts
ResourceError
ViewerFormatError
ViewerStateError
ViewerUnsupportedError
toViewerErrorInfo()
ViewerErrorState
ViewerErrorBoundary
```

This is good canonical infrastructure.

Good:

- errors are no longer owned by `viewer-resource`
- typed domains exist
- UI projection is centralized
- boundaries keep actual errors, not booleans
- resource and format failures are separated
- text bounds, image decode, PDF parse, XLSX parse, PPTX render, DOCX render,
  and CSV parse all map to canonical error display

Not perfect:

- `toViewerErrorInfo()` is a hand-coded decision tree
- format messages are centralized but not table-driven
- download failures are not projected through this layer
- `ViewerErrorBoundary` logs unconditionally
- `ViewerErrorState` owns layout variants but not all viewer-specific chrome
  needs
- `ViewerErrorContext.sourceKind` repeats information already on resource

The ideal projection model:

```ts
export interface ViewerErrorProjectionInput {
  error: unknown
  format?: ViewerFormat
  sourceKind?: ViewerSourceKind
  canDownload?: boolean
  retry?: "auto" | "always" | "never"
}

export interface ViewerErrorInfo {
  domain: ViewerErrorDomain
  format?: ViewerFormat
  kind: string
  message: string
  status?: number
  isRetryable: boolean
  isDownloadUseful: boolean
  userMessage: string
  cause?: unknown
}
```

This already exists in spirit. The improvement is making policy data-driven:

```ts
const FORMAT_ERROR_MESSAGES: Record<
  ViewerFormat,
  Partial<Record<ViewerFormatErrorKind, string>>
>
```

But only do this if it reduces complexity. A bad table can be less readable than
a good function. The platonic criterion is not "table" versus "function"; it is
"one obvious place, no message parsing, no duplicated policy."

`ViewerErrorBoundary` should accept:

```ts
onCaughtError?: (error: unknown, info: React.ErrorInfo) => void
```

Default console logging should be removed or development-gated. A reusable
viewer should not impose logging policy.

### Caches

The system has several necessary cache types:

- URL resource registry
- Blob resource WeakMap registry
- PDF document cache
- PDF page cache
- image source cache
- image decoded bitmap cache
- PPTX source cache
- PPTX slide bitmap cache
- DOCX byte cache
- XLSX parsed workbook cache
- CSV worker/effect state
- FileViewer text/markdown/HTML caches
- thumbnail caches

These cannot collapse into one generic cache. Their lifecycles differ.

The platonic goal is not one cache implementation. It is one cache vocabulary:

```txt
content key
presentation key
resource key
retain
release
dispose
evict
abort
retry after rejection
```

Current good patterns:

- PDF retains and releases document resources.
- image source manager has leases and disposal.
- PPTX disposes renderer/bitmaps.
- XLSX cache is keyed by resource content.
- failed promises are usually evicted.

Remaining imperfections:

- each cache invents local names for the same lifecycle concepts
- rejected-entry behavior is not consistently expressed
- disposal APIs differ by asset
- some tests assert behavior, but there is no shared cache contract test helper

Target support module:

```txt
registry/new-york-v4/lib/viewer-cache.ts
```

Do not make it a universal cache. Make it a vocabulary/helper module:

```ts
export interface ViewerDisposable {
  dispose(): void | Promise<void>
}

export interface ViewerRetainedEntry<T> {
  promise: Promise<T>
  status: "pending" | "fulfilled" | "rejected"
  value?: T
  error?: unknown
  consumers: number
  lastUsedAt: number
}

export function isRejectedEntry(entry): boolean
export function evictRejectedOnLookup(...)
export function disposeQuietly(...)
export function pruneLru(...)
```

Only add helpers that remove real duplication in PDF/PPTX/image/DOCX/XLSX.

### FileViewer

FileViewer is the largest remaining imperfection.

It is both:

- canonical router for source descriptors
- holder of legacy route-specific loading systems

Current good state:

- FileViewer resolves one descriptor for routing/display/download
- it creates a `ViewerResource`
- format routes increasingly receive canonical resource/download metadata
- unsupported fallback uses canonical download actions
- boundary errors now go through shared error UI

Current weak state:

- text, markdown, and HTML internals still use `src`
- text/markdown/HTML loaders predate `ViewerResource`
- some subroutes fetch directly by URL instead of reading through resource
- some modules still combine URL identity, fetch mechanics, and render state
- FileViewer chrome still accepts fallback `src` and constructs href downloads

The FileViewer ideal:

```txt
FileViewer receives source.
FileViewer creates ViewerResource.
FileViewer resolves category from resource.descriptor.
FileViewer routes resource to a format route.
Routes either call canonical viewers or route-local loaders that accept resource.
No FileViewer submodule accepts src except DOM iframe/img boundaries.
No FileViewer submodule invents downloads.
```

Target route props:

```ts
interface FileViewerRouteProps {
  resource: ViewerResource
  descriptor: FileDescriptor
  className?: string
  bare?: boolean
}
```

Delete route props like:

```ts
src?: string
fileName: string
downloadAction?: ViewerDownloadAction
descriptorSignal?: AbortSignal
```

Replace them with:

```ts
resource: ViewerResource
descriptor: FileDescriptor
lifecycle: ViewerRouteLifecycle
```

Only create `ViewerRouteLifecycle` if it removes real duplication. Do not add a
generic lifecycle object unless at least two FileViewer subroutes need the same
abort/reset behavior.

### Text Viewer

TextViewer is now the canonical model for source/resource/error/download.

Remaining possible refinements:

- change reset keys to `resource.keys.load` where source bytes matter
- use `resource.keys.presentation` where only filename/display changes matter
- consider whether text source hashing belongs in source descriptor or resource
  payload key
- ensure every bounds error uses `ViewerFormatError` or `ViewerStateError`
  consistently

Do not over-optimize TextViewer. It is already close. The risk is making it more
abstract than the problem requires.

### CSV Viewer

CSV is the proof that the canonical model can handle table-specific parsing.

Remaining possible refinements:

- move CSV parse error creation to one helper
- ensure Blob worker failures and sync parse failures map identically
- ensure dialect inference never depends on a `src` name when resource metadata
  has the same information
- decide whether CSV parsed table input is a source or a viewer data prop

CSV has one legitimate special case: parsed table data is not file source data.
Do not force it into `ViewerSource`.

### Image Viewer

Image proves decoded asset lifecycle.

Remaining possible refinements:

- ensure all image load/decode/draw failures become `ViewerFormatError`
- keep `ImageSourceDisposedError` out of user-facing error UI where it is a
  normal teardown path
- audit TIFF worker errors against `ViewerFormatErrorKind`
- decide whether frame export should become a derived download action

Image is the best viewer for testing disposal correctness.

### PDF Viewer

PDF proves library direct URL loading and document/page caches.

Remaining possible refinements:

- confirm every cache uses `resource.keys.load`, not presentation/resource
  identity
- ensure metadata-only changes update toolbar/download without reloading PDF.js
- consider a derived "current page as image" export only if a real product need
  appears
- remove unconditional boundary logging

PDF must keep direct URL loading. Passing bytes for URL PDFs would be a
performance regression because PDF.js can use range loading and worker-managed
fetch behavior.

### PPTX Viewer

PPTX proves renderer lifetime plus canvas bitmap caching.

Remaining possible refinements:

- ensure renderer load failures destroy the underlying viewer
- ensure zero-slide decks are typed format failures
- ensure cache keys are content-based
- remove all references to the deleted `pptx-viewer-error-boundary`

PPTX should remain a pressure test for cache disposal and render cancellation.

### DOCX Viewer

DOCX proves full-file DOM rendering.

Remaining possible refinements:

- move byte cache to a small resource module if it grows further
- ensure render errors are always `ViewerFormatError({ format: "docx" })`
- keep CSS Highlight API absence as normal feature detection, not an error
- ensure source changes cannot leave stale DOM highlights

DOCX does not need a generic loader abstraction. Its renderer is imperative and
DOM-owning.

### XLSX Viewer

XLSX proves worker parsing plus derived export.

Current good state:

- parse happens in worker
- source cache uses resource content key
- current-sheet CSV export uses `ViewerDownloadAction`
- export payload is lazy

Remaining refinements:

- map worker protocol failures to `ViewerFormatError` with `worker_failed` when
  appropriate
- ensure export action id is unique if multiple sheet exports ever appear
- add explicit tests for aborting slow sheet export
- decide if CSV serialization belongs in a shared table export module rather
  than importing from CSV viewer internals

The import:

```ts
import { serializeCsvTable } from "./csv-viewer-download"
```

is pragmatic, but not ideal. A shared table export helper would be cleaner:

```txt
registry/new-york-v4/lib/table-export.ts
```

Do this only if at least CSV and XLSX both use it.

## Naming Standard

The final vocabulary should be ruthlessly consistent.

### Canonical Names

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
src
value
bytes as public source
downloadName
downloadFileName
getDownload
DownloadCapability
cacheKey as a universal key
data when source/resource/payload is meant
file when resource/source is meant
```

Exceptions:

- DOM props may use `src`, `srcDoc`, `href`, and `download` because those are
  browser vocabulary.
- test fixture names may include `src` only when testing DOM behavior.
- low-level image sniff helpers may use `src` temporarily, but `url` is better.

### Method Names

Prefer properties for stable capabilities:

```ts
resource.originalDownload
resource.directUrl
```

Prefer methods for operations:

```ts
resource.readBytes()
resource.readText()
resource.readBlob()
resource.readStream()
resource.readRange()
```

This distinction matters. Capabilities describe what exists. Operations do work.

### Key Names

Use the narrowest key:

```txt
keys.load          parsed/decoded asset cache
keys.presentation  toolbar/display/download metadata reactions
keys.resource      resource object interning
```

Do not use `keys.resource` for expensive parsed assets if metadata-only changes
should not reload the asset.

## Public API Standard

Canonical viewers should expose:

```ts
interface ViewerProps {
  source: ViewerSpecificSource
  className?: string
  toolbar?: boolean
  bare?: boolean
}
```

Then viewer-specific interaction props:

```ts
scale?: number
defaultScale?: number
onScaleChange?: ...
renderPageOverlay?: ...
activeCell?: ...
defaultSheetIndex?: ...
```

They should not expose:

```txt
src
value
bytes
downloadName
downloadFileName
mime
type
```

Use:

```txt
source.fileName
source.mimeType
source.downloadUrl
```

## Perfect Modularization Target

The final modules should be layered like this:

```txt
lib/viewer-source
  normalizes public source metadata

lib/viewer-resource
  turns source into read/download capabilities

lib/viewer-download
  defines download action and payload types

ui/viewer-download
  executes browser download behavior

lib/viewer-errors
  defines error classes and projection

ui/viewer-error
  renders projected errors and catches render failures

format resource modules
  pdf-viewer-resource
  docx-viewer-resource
  pptx-viewer-source
  image-source-cache
  xlsx-workbook

viewer components
  compose resources, format modules, chrome, virtualization, and slots
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

## Implementation Plan

### Phase 1: Resource API Closure

Goal: make the resource surface minimal and linguistic.

Steps:

1. Add properties while keeping methods temporarily:

```ts
resource.originalDownload
resource.directUrl
```

2. Migrate call sites:

```txt
resource.getOriginalDownload() -> resource.originalDownload
resource.getDirectLoad().kind === "url" -> resource.directUrl != null
```

3. Rename operations:

```txt
readArrayBuffer -> readBytes
stream -> readStream
```

4. Audit synchronous payload access:

```txt
getInlineText
getBlob
```

5. Either delete both or replace with one explicit payload property:

```ts
resource.payload
```

6. Remove temporary methods.

Acceptance:

- no `getOriginalDownload(` in registry source
- no `getDirectLoad(` in registry source
- no public `DownloadCapability`
- tests prove metadata-only changes do not reload PDF/XLSX/PPTX assets

### Phase 2: FileViewer Internal Cutover

Goal: eliminate viewer-domain `src`.

Steps:

1. Change FileViewer route props to accept `resource`.
2. Convert text route loaders from `src` to `resource`.
3. Convert markdown route loaders from `src` to `resource`.
4. Convert HTML route loaders from `src` to `resource`.
5. Keep DOM iframe `src`/`srcDoc` only at the DOM boundary.
6. Remove fallback `src` download construction from `DocShell`.
7. Require explicit `downloadAction` or `resource.originalDownload`.

Acceptance:

- `rg "\bsrc\b" registry/new-york-v4/ui/file-viewer*` only finds DOM props or
  tests intentionally asserting iframe behavior
- FileViewer subroutes do not fetch by raw URL except through `ViewerResource`
- FileViewer chrome does not create download actions from a raw URL

### Phase 3: Error Policy Closure

Goal: keep one canonical projection and remove logging policy.

Steps:

1. Add `onCaughtError` to `ViewerErrorBoundary`.
2. Remove unconditional `console.error`.
3. Add tests for boundary logging callback.
4. Decide whether `toViewerErrorInfo()` stays function-based or becomes
   table-assisted.
5. Add download error projection or a parallel `toViewerDownloadErrorInfo()`.
6. Ensure all worker failures use `worker_failed` where appropriate.

Acceptance:

- no viewer-local error boundary classes except FileViewer if it remains a
  route-level adapter
- no boundary stores boolean error state
- no user-facing UI parses `error.message`
- no unconditional console logging in shared components

### Phase 4: Download Closure

Goal: one action model, one execution path, visible enough failure behavior.

Steps:

1. Rename `getOriginalDownload()` to `originalDownload`.
2. Add tests for aborting pending derived downloads.
3. Add `onError` tests for button and menu.
4. Decide whether `isDisabled` is needed.
5. Move shared CSV serialization to `lib/table-export.ts` if CSV and XLSX both
   depend on it.
6. Standardize derived action ids:

```txt
download-original
export-csv
export-current-sheet-csv
export-current-page-png
```

Acceptance:

- no viewer creates object URLs
- no viewer clicks anchors
- no viewer serializes derived export during render
- derived exports have tests for lazy payload creation
- download errors are typed and observable

### Phase 5: Cache Vocabulary Closure

Goal: remove repeated cache lifecycle code where it is truly duplicated.

Steps:

1. Audit caches and classify:

```txt
promise cache
retained asset cache
decoded bitmap cache
worker result cache
text request cache
```

2. Extract only shared helpers that reduce duplication.
3. Standardize rejected promise behavior:

```txt
pending -> reused
fulfilled -> reused until eviction
rejected -> evicted on next lookup or immediately if retry must work
```

4. Standardize disposal:

```ts
disposeViewerAsset(asset)
```

5. Add cache tests for PDF, image, PPTX, DOCX, XLSX.

Acceptance:

- every expensive asset cache has explicit max size or lifecycle reason for no
  max size
- every disposable asset is disposed on eviction/reset
- failed loads can retry same source
- source metadata changes do not reload content caches

### Phase 6: Documentation Cleanup

Goal: remove stale conceptual vocabulary.

Steps:

1. Search all docs and blueprints for:

```txt
downloadFileName
downloadName
getDownload
DownloadCapability
src as public API
cacheKey as universal identity
```

2. Update docs to canonical vocabulary.
3. Mark old component-specific blueprints as historical if they describe
   superseded APIs.
4. Keep this blueprint as the top-level target.

Acceptance:

- new contributor can read docs without encountering conflicting API names
- old compatibility names appear only in migration history sections

## Test Plan

### Unit Tests

Add or preserve tests for:

- `resolveViewerDescriptor`
- `viewerResourceKeys`
- URL resource interning
- Blob resource interning
- text source non-interning
- `readBytes`
- `readText` with byte limits
- `readText` with line limits
- `readRange` URL and Blob behavior
- `originalDownload` for URL, Blob, text
- `toViewerErrorInfo`
- `triggerViewerDownload`
- lazy Blob/text/derived downloads
- download abort
- download error callback

### Viewer Tests

Every canonical viewer should test:

- URL source
- Blob source
- metadata-only change
- source content change
- download action existence
- resource error
- format error
- recovery after source change
- no stale async render after source change

Format-specific additions:

- PDF: direct URL load stays direct
- PDF: Blob load passes bytes
- PDF: document cache keyed by content
- image: bitmap disposal and decode failure classification
- PPTX: renderer disposal and slide render retry
- DOCX: stale render ignored
- XLSX: worker failure classification and sheet export lazy payload
- CSV: parse failure classification and derived export
- text: bounds errors and virtualized line scroll

### Search Tests

Add tests or CI scripts for forbidden strings:

```txt
getOriginalDownload(
getDirectLoad(
downloadFileName
downloadName
DownloadCapability
TextViewerErrorBoundary
PdfErrorBoundary
ImageViewerErrorBoundary
PptxErrorBoundary
DocxErrorBoundary
XlsxErrorBoundary
```

Use allowlists for historical blueprint files only if those files are explicitly
marked historical.

## Performance Principles

The platonic model must preserve speed.

Rules:

1. URL PDFs must stay URL-loaded.
2. Blob/text derived downloads must stay lazy.
3. Worker parsing stays in XLSX and Blob CSV where useful.
4. Image decoded bitmaps stay retained and disposed deliberately.
5. PPTX slide bitmaps stay cached with a cap.
6. Text large files stay virtualized.
7. FileViewer large text routes may keep specialized incremental loading.
8. Metadata-only changes must not reload expensive content.
9. Object URLs must not be created during render.
10. Rejected promises must not poison retry forever.

The resource abstraction should never force a slow common path when a library
has a faster native path.

## Simplicity Principles

Simplicity here does not mean fewer files. It means fewer reasons.

Good:

```txt
resource reads bytes
PDF loader makes PDF document
PDF viewer renders PDF document
download control downloads
error state renders errors
```

Bad:

```txt
PDF viewer infers filename
PDF toolbar creates object URL
PDF error boundary guesses retry policy
PDF resource catches parse errors
PDF loader parses download metadata
```

Each module should own one kind of reason.

## High-Entropy Code Standard

High-entropy code means each line carries real information and little ritual.

The target style:

- names are specific
- control flow is direct
- no duplicated condition ladders
- no comments explaining obvious assignments
- no compatibility aliases
- no generic abstraction without at least two real users
- no "manager" or "handler" names unless the module truly coordinates many
  operations

Examples:

Good:

```ts
const document = React.use(getDocumentResource(resource))
const downloadActions = [resource.originalDownload, currentSheetCsvExport]
```

Weak:

```ts
const file = getFileThing(data)
const capability = resource.getDownload()
```

Good:

```ts
throw new ViewerFormatError({
  format: "xlsx",
  kind: "worker_failed",
  message: "Spreadsheet worker failed.",
  cause: error,
})
```

Weak:

```ts
throw new Error("failed")
```

## Final Target API

The final public viewer API should look like:

```ts
<PdfViewer source={{ kind: "url", url, fileName, mimeType, downloadUrl }} />

<ImageViewer source={{ kind: "blob", blob, identityKey, fileName }} />

<TextViewer source={{ kind: "text", text, fileName: "notes.txt" }} />

<CsvViewer source={{ kind: "url", url, fileName: "data.csv" }} />

<DocxViewer source={{ kind: "blob", blob, identityKey, fileName }} />

<XlsxViewer source={{ kind: "url", url, fileName: "workbook.xlsx" }} />

<PptxViewer source={{ kind: "url", url, fileName: "deck.pptx" }} />
```

No sibling data entrypoints.

No `src`.

No `value`.

No public `downloadFileName`.

No public `downloadName`.

## Final Internal Resource API

Ideal:

```ts
export interface ViewerResource {
  readonly source: ViewerSource
  readonly descriptor: ViewerDescriptor
  readonly kind: ViewerSource["kind"]
  readonly keys: ViewerResourceKeys
  readonly directUrl: string | null
  readonly originalDownload: ViewerDownloadAction

  readBlob(options?: ResourceReadOptions): Promise<Blob>
  readBytes(options?: ResourceReadOptions): Promise<ArrayBuffer>
  readText(options?: TextReadOptions): Promise<string>
  readStream(options?: ResourceReadOptions): Promise<ReadableStream<Uint8Array>>
  readRange(
    range: ByteRange,
    options?: ResourceReadOptions
  ): Promise<ByteRangeResult>
}
```

Possibly acceptable if synchronous payload proves necessary:

```ts
readonly payload:
  | { kind: "url"; url: string }
  | { kind: "blob"; blob: Blob }
  | { kind: "text"; text: string }
```

Do not include payload unless it has clear performance value.

## Final Error API

Ideal:

```ts
throw new ResourceError(...)
throw new ViewerFormatError(...)
throw new ViewerStateError(...)
throw new ViewerUnsupportedError(...)

const info = toViewerErrorInfo(error, {
  format,
  sourceKind: resource.kind,
  canDownload: Boolean(resource.originalDownload),
})
```

Boundary:

```tsx
<ViewerErrorBoundary
  format="pdf"
  sourceKind={resource.kind}
  download={resource.originalDownload}
  resetKey={resource.keys.load}
  onCaughtError={reportError}
>
  ...
</ViewerErrorBoundary>
```

No unconditional logging.

No local viewer boundary classes.

## Final Download API

Ideal:

```tsx
<ViewerDownloadControl
  actions={[resource.originalDownload, currentSheetCsvExport]}
  onError={reportDownloadError}
/>
```

No local object URLs.

No local anchors except the shared `ViewerDownloadButton`.

No eager export serialization.

## Final FileViewer API

Ideal:

```tsx
<FileViewer source={source} />
```

Internal:

```tsx
function FileViewerRoute({ resource, descriptor }: FileViewerRouteProps) {
  switch (descriptor.category) {
    case "pdf":
      return <PdfViewer source={resource.source as PdfDocumentSource} />
    case "html":
      return <HtmlFileRoute resource={resource} descriptor={descriptor} />
  }
}
```

The route may use specialized loaders, but those loaders accept `resource`, not
`src`.

## Done Means

The system reaches the practical platonic ideal when all of these are true:

1. Every canonical viewer has exactly one public data entrypoint: `source`.
2. No canonical viewer public API exposes `src`, `value`, `bytes`,
   `downloadName`, or `downloadFileName`.
3. `ViewerResource` has no transitional methods.
4. Resource keys are used intentionally and tested.
5. FileViewer route internals do not use `src` except DOM boundaries.
6. Original downloads are exposed as `resource.originalDownload`.
7. Derived downloads use `ViewerDownloadAction`.
8. All browser download mechanics live in `ui/viewer-download.tsx`.
9. All viewer errors project through `viewer-errors.ts`.
10. No shared component logs unconditionally.
11. No viewer-local error boundary remains unless it adds real route-level value.
12. Every expensive cache has explicit lifecycle semantics.
13. Metadata-only changes do not reload expensive content.
14. Same-source retry works after failed loads.
15. Tests cover URL and Blob sources for every binary viewer.
16. Tests cover inline text for text-capable viewers.
17. Registry build includes the canonical modules.
18. Documentation uses one vocabulary.
19. Forbidden legacy names are absent from live code.
20. The code reads as if it was designed once, not migrated five times.

## Proposed Execution Order

Do not attack everything at once.

Order:

1. Resource API closure.
2. FileViewer internal `src` removal.
3. Error boundary logging and callback cleanup.
4. Download action naming and failure UX.
5. Cache vocabulary extraction only where duplication remains obvious.
6. Documentation cleanup.
7. Forbidden-name tests.

This order matters because resource naming affects every other phase.

## Risks

### Over-abstracting loaders

Do not create a universal document loader.

PDF, image, DOCX, PPTX, XLSX, CSV, and text have fundamentally different
performance models. The shared layer should stop at resource capabilities and
common lifecycle vocabulary.

### Breaking PDF performance

Do not convert URL PDFs into `ArrayBuffer`s by default. PDF.js direct URL loading
is a feature.

### Making FileViewer worse

FileViewer has legitimate special routes for large text, markdown, and HTML.
The goal is not to force those through `TextViewer`. The goal is to make their
inputs canonical and their names honest.

### Premature cache abstraction

Cache helpers are useful only if they remove real duplication. A generic cache
that hides disposal rules would be worse than local explicit code.

### Chasing naming churn without semantic gain

Rename only when the new name makes misuse less likely.

## Summary

The current viewer system is a strong canonical v1.

The platonic ideal is a smaller, sharper version of the same architecture:

```txt
source
descriptor
resource
format loader
viewer state
download action
error projection
```

The biggest remaining cuts are:

- shrink and rename `ViewerResource`
- remove FileViewer internal `src`
- remove unconditional shared logging
- integrate download failures into shared policy
- standardize cache vocabulary without flattening cache behavior
- delete stale documentation vocabulary

After those cuts, the system can plausibly be called "everything needed,
nothing more."
