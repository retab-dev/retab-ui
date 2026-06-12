# Viewer Error Canonical Blueprint

This blueprint defines the canonical error model for the viewer system.

The source/resource abstraction is now strong enough to expose the next weak
boundary: errors are technically structured in some loaders, but rendered and
retried inconsistently across viewers.

The goal is not to invent one generic failure for every format. The goal is one
shared error vocabulary, one normalization boundary, and one UI projection layer,
while still letting PDF, image, text, CSV, DOCX, XLSX, and PPTX keep their real
format-specific failures.

## Current Audit

The implementation already has the right foundation.

`registry/new-york-v4/lib/viewer-resource.ts` defines:

```ts
export class ResourceError extends Error
export class ViewerFormatError extends Error
```

Current good behavior:

- PDF preserves `ResourceError` and wraps PDF.js parse failures as
  `ViewerFormatError({ format: "pdf", kind: "parse_failed" })`.
- XLSX preserves `ResourceError` and wraps workbook parse failures as
  `ViewerFormatError({ format: "xlsx", kind: "parse_failed" })`.
- Image errors subclass `ViewerFormatError` through `ImageLoadError`,
  `ImageDecodeError`, `ImageSourceDisposedError`, and `ImageFrameIndexError`.
- Text bounds errors subclass `ViewerFormatError`.
- PPTX renderer errors subclass `ViewerFormatError`.
- CSV maps some `ResourceError`s into a local state union.

Current weak behavior:

- Several error boundaries store only `boolean`, so structured errors are thrown
  away before UI rendering.
- User-facing messages are repeated and inconsistent.
- Retry policy is decided locally and sometimes from loose assumptions.
- Download access on errors is implemented per viewer.
- CSV owns a local `CsvViewerError` model instead of using the shared error
  vocabulary.
- FileViewer legacy text, markdown, and HTML routes throw plain `Error`
  instances for fetch failures.
- Some format loaders wrap errors correctly, while some renderers or workers
  still produce plain `Error` values that lose typed cause information.

## North Star

Every viewer failure should pass through one of four domains:

```ts
export type ViewerErrorDomain =
  | "resource"
  | "format"
  | "state"
  | "unsupported"
  | "unknown"
```

The domains mean:

| Domain        | Owner          | Examples                                                        |
| ------------- | -------------- | --------------------------------------------------------------- |
| `resource`    | source layer   | fetch failed, HTTP status, abort, size limits, unsupported read |
| `format`      | format loader  | PDF parse failed, image decode failed, PPTX render failed       |
| `state`       | viewer logic   | invalid bounds, invalid page/frame/sheet/cell request           |
| `unsupported` | router/viewer  | no viewer for this category or source kind                      |
| `unknown`     | boundary guard | unexpected thrown value after all typed handling failed         |

Rules:

1. Transport, access, abort, resource bounds, and missing resource capabilities
   are `ResourceError`s.
2. Decode, parse, render, worker-protocol, and library failures are
   `ViewerFormatError`s or subclasses.
3. Invalid viewer parameters and impossible UI requests are `ViewerStateError`s.
4. Unsupported format/source combinations are `ViewerUnsupportedError`s.
5. Error boundaries store actual `unknown` or typed errors, not booleans.
6. UI components never parse `Error.message` to decide behavior.
7. Retry policy is derived from typed error plus source context.
8. Download availability is derived from `ViewerDownloadAction`, not reimplemented
   per boundary.
9. Abort is not a user-facing error unless the caller explicitly chooses to show
   cancellation.
10. Format-specific errors remain format-specific. They are not flattened into a
    generic parse error if useful metadata exists.

## Canonical Module

Create:

```txt
registry/new-york-v4/lib/viewer-errors.ts
```

This module owns error classes, guards, and UI projection.

`viewer-resource.ts` should temporarily re-export the public error classes for
backward compatibility during migration, but the canonical home becomes
`viewer-errors.ts`.

## Canonical Types

```ts
export type ViewerFormat =
  | "pdf"
  | "image"
  | "text"
  | "csv"
  | "docx"
  | "xlsx"
  | "pptx"
  | "file"

export type ViewerErrorDomain =
  | "resource"
  | "format"
  | "state"
  | "unsupported"
  | "unknown"

export type ResourceErrorKind =
  | "fetch_failed"
  | "http_error"
  | "aborted"
  | "too_large"
  | "unsupported_capability"
  | "unknown"

export type ViewerFormatErrorKind =
  | "bounds"
  | "decode_failed"
  | "disposed"
  | "index_out_of_range"
  | "load_failed"
  | "parse_failed"
  | "render_failed"
  | "worker_failed"
  | "unknown"

export type ViewerStateErrorKind =
  | "invalid_bounds"
  | "invalid_target"
  | "out_of_range"
  | "stale_resource"
  | "unknown"

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

## Canonical Classes

### `ResourceError`

`ResourceError` remains the only source-layer error.

```ts
export class ResourceError extends Error {
  readonly domain = "resource"
  readonly kind: ResourceErrorKind
  readonly status?: number
  readonly tooLargeReason?: "bytes" | "lines"
  override readonly cause?: unknown
}
```

Rules:

- `fetch_failed`: network or fetch rejection before an HTTP response.
- `http_error`: response status is not usable.
- `aborted`: operation was cancelled.
- `too_large`: resource read exceeded declared limits.
- `unsupported_capability`: caller requested stream/range/object URL behavior
  that this source cannot provide.
- `unknown`: only for source-layer failures that cannot be classified.

### `ViewerFormatError`

`ViewerFormatError` remains the base for format/library failures.

```ts
export class ViewerFormatError extends Error {
  readonly domain = "format"
  readonly format: ViewerFormat
  readonly kind: ViewerFormatErrorKind
  override readonly cause?: unknown
}
```

Rules:

- Format loaders must not convert `ResourceError` into `ViewerFormatError`.
- Parse/decode/render/worker failures must become `ViewerFormatError`.
- Format-specific subclasses are encouraged when they add real meaning.

Examples:

```ts
new ViewerFormatError({
  format: "pdf",
  kind: "parse_failed",
  message: "Failed to parse PDF.",
  cause: error,
})

new ViewerFormatError({
  format: "csv",
  kind: "worker_failed",
  message: "CSV worker failed.",
  cause: error,
})
```

### `ViewerStateError`

Add a state-domain error for invalid viewer inputs and imperative requests.

```ts
export class ViewerStateError extends Error {
  readonly domain = "state"
  readonly format?: ViewerFormat
  readonly kind: ViewerStateErrorKind
  override readonly cause?: unknown
}
```

Use it for:

- invalid text bounds
- invalid PDF page target
- invalid image frame index when the caller caused it
- invalid XLSX sheet/cell target
- stale resource usage after disposal if it is caused by viewer lifecycle

Do not use it for corrupt files.

### `ViewerUnsupportedError`

Add an unsupported-domain error for route failures.

```ts
export class ViewerUnsupportedError extends Error {
  readonly domain = "unsupported"
  readonly format?: ViewerFormat
  readonly sourceKind?: string
}
```

Use it for:

- no viewer for descriptor category
- source kind cannot be consumed by the requested viewer
- feature not implemented for this format

Unsupported state may still render through `UnsupportedCard`; the point is that
imperative paths and boundaries have a typed value available.

## Type Guards

`viewer-errors.ts` should export:

```ts
export function isAbortError(error: unknown): boolean
export function isResourceError(error: unknown): error is ResourceError
export function isViewerFormatError(error: unknown): error is ViewerFormatError
export function isViewerStateError(error: unknown): error is ViewerStateError
export function isViewerUnsupportedError(
  error: unknown
): error is ViewerUnsupportedError
```

Rules:

- Existing local abort helpers should be replaced or re-export the canonical
  helper.
- `DOMException("AbortError")` and `Error` values with `name === "AbortError"`
  count as abort errors.
- Type guards should not depend on `instanceof` alone if registry bundling can
  duplicate module instances. Use structural fallback checks for `name`,
  `domain`, and `kind`.

## Error Projection

Add:

```ts
export interface ViewerErrorContext {
  format?: ViewerFormat
  sourceKind?: "url" | "blob" | "text"
  canDownload?: boolean
  retry?: "auto" | "always" | "never"
}

export function toViewerErrorInfo(
  error: unknown,
  context?: ViewerErrorContext
): ViewerErrorInfo
```

This is the single place where raw errors become UI decisions.

### Resource Projection

| Error                                     | User message                               | Retry                         | Download |
| ----------------------------------------- | ------------------------------------------ | ----------------------------- | -------- |
| `ResourceError("fetch_failed")`           | `Couldn't load this file.`                 | yes for URL, no for Blob/Text | yes      |
| `ResourceError("http_error", 404)`        | `Failed to load file: 404.`                | yes for URL                   | yes      |
| `ResourceError("aborted")`                | `Loading was cancelled.`                   | no by default                 | yes      |
| `ResourceError("too_large", "bytes")`     | `This file is too large to preview.`       | no                            | yes      |
| `ResourceError("too_large", "lines")`     | `This file has too many lines to preview.` | no                            | yes      |
| `ResourceError("unsupported_capability")` | `This source cannot be previewed here.`    | no                            | yes      |

Abort projection should usually be suppressed before rendering. If it reaches
UI, it should be non-retryable unless the caller explicitly chooses otherwise.

### Format Projection

| Format | Kind                 | User message                       | Retry                                    |
| ------ | -------------------- | ---------------------------------- | ---------------------------------------- |
| PDF    | `parse_failed`       | `Couldn't load this PDF.`          | yes for URL                              |
| Image  | `decode_failed`      | `Couldn't decode this image.`      | yes for URL                              |
| Image  | `index_out_of_range` | `This image page is out of range.` | no                                       |
| Text   | `bounds`             | bounds-specific message            | no                                       |
| CSV    | `parse_failed`       | `Couldn't parse this table.`       | yes for URL/Blob if reload is meaningful |
| CSV    | `worker_failed`      | `Couldn't parse this table.`       | fallback first, then no                  |
| DOCX   | `render_failed`      | `Couldn't render this document.`   | yes for URL                              |
| XLSX   | `parse_failed`       | `Couldn't parse this spreadsheet.` | yes for URL                              |
| PPTX   | `load_failed`        | `Couldn't load this presentation.` | yes for URL                              |
| PPTX   | `render_failed`      | `Couldn't render this slide.`      | maybe, local slide retry                 |

### State Projection

| Kind             | User message                            | Retry |
| ---------------- | --------------------------------------- | ----- |
| `invalid_bounds` | `Viewer bounds are invalid.`            | no    |
| `invalid_target` | `The requested target is invalid.`      | no    |
| `out_of_range`   | `The requested item is out of range.`   | no    |
| `stale_resource` | `This viewer state is no longer valid.` | no    |

### Unknown Projection

Unknown thrown values become:

```ts
{
  domain: "unknown",
  kind: "unknown",
  userMessage: "Couldn't load this file.",
  isRetryable: context.sourceKind === "url",
}
```

The original value remains in `cause`.

## Shared React UI

Create:

```txt
registry/new-york-v4/ui/viewer-error.tsx
```

Exports:

```tsx
export function ViewerErrorState(props: ViewerErrorStateProps): JSX.Element
export class ViewerErrorBoundary extends React.Component<...>
```

### `ViewerErrorState`

```ts
export interface ViewerErrorStateProps {
  error: unknown
  format?: ViewerFormat
  sourceKind?: "url" | "blob" | "text"
  download?: ViewerDownloadAction
  className?: string
  bare?: boolean
  variant?: "card" | "document" | "inline"
  onRetry?: () => void
}
```

Responsibilities:

- call `toViewerErrorInfo`
- render `info.userMessage`
- render Retry only when `info.isRetryable && onRetry`
- render Download only when `download && info.isDownloadUseful`
- expose test/debug attributes:
  - `data-error-domain`
  - `data-error-kind`
  - `data-error-format`
  - `data-error-message`
- keep copy short
- never print stack traces

### `ViewerErrorBoundary`

```ts
export interface ViewerErrorBoundaryProps {
  children: React.ReactNode
  resetKey?: unknown
  format?: ViewerFormat
  sourceKind?: "url" | "blob" | "text"
  download?: ViewerDownloadAction
  className?: string
  bare?: boolean
  variant?: "card" | "document" | "inline"
  onRetry?: () => void
}
```

Rules:

- State stores `error: unknown | null`.
- `getDerivedStateFromError(error)` returns `{ error }`.
- `componentDidUpdate` clears error when `resetKey` changes.
- `componentDidCatch` may log in development, but production UI must use
  structured projection.
- Retry clears error and calls `onRetry` if provided.

## Format Loader Rules

Every loader follows this pattern:

```ts
async function loadFormat(resource: ViewerResource) {
  try {
    const bytes = await resource.readArrayBuffer()
    return parse(bytes)
  } catch (error) {
    if (isResourceError(error)) throw error
    throw new ViewerFormatError({
      format: "format",
      kind: "parse_failed",
      message: "Failed to parse format.",
      cause: error,
    })
  }
}
```

Rules:

- Do not catch `ResourceError` unless rethrowing it unchanged.
- Do not throw plain `Error` from loaders when a typed domain is known.
- Worker messages with typed error codes should become `ViewerFormatError` or
  `ViewerStateError` with the code preserved.
- A worker being unavailable is not always an error if a fallback exists.
- Disposed resources should throw typed errors only if a caller tries to use them.

## Viewer-Specific Migration Plan

### CSV

Current:

- Owns local `CsvViewerError`.
- Maps some `ResourceError`s.
- Renders local status node.

Target:

- Delete `CsvViewerError`.
- Store `error: unknown`.
- Wrap parser and worker failures:

```ts
new ViewerFormatError({
  format: "csv",
  kind: "parse_failed",
  message: "Failed to parse CSV.",
  cause: error,
})
```

- Use `ViewerErrorState` as the grid status node.
- Keep partial rows if useful, but error object is canonical.

### PDF

Current:

- Loader wraps parse failures correctly.
- Boundary stores only `boolean`.

Target:

- Replace `PdfErrorBoundary` with `ViewerErrorBoundary`.
- Pass `format="pdf"`, source kind, and download capability.
- Keep retry key behavior, but make retry policy derive from `ViewerErrorInfo`.
- Preserve PDF.js errors as `cause`.

### Image

Current:

- Strong typed format errors.
- Boundary stores `Error` but renders generic message.

Target:

- Keep image-specific subclasses.
- Boundary renders `ViewerErrorState`.
- `ImageFrameIndexError` should project to out-of-range copy, not generic load
  failure.
- TIFF worker failures become `ViewerFormatError({ format: "image", kind:
"decode_failed" | "worker_failed" })`.

### Text

Current:

- Bounds errors are typed.
- Boundary has custom message and retry logic.

Target:

- Keep `TextViewerTooLargeError` and `TextViewerInvalidBoundsError`, or replace
  invalid bounds with `ViewerStateError`.
- Replace `textViewerErrorMessage` with `toViewerErrorInfo`.
- Retryable only for URL resource failures, not bounds or inline text.

### PPTX

Current:

- `PptxRendererError` subclasses `ViewerFormatError`.
- Boundary stores only `boolean`.

Target:

- Boundary stores actual error.
- Render through `ViewerErrorState`.
- Preserve download access.
- Slide render failures may become local slide errors instead of whole-viewer
  errors when feasible, but they still use the canonical error class.

### DOCX

Current:

- Resource read is canonical.
- docx-preview render failures fall into boolean boundary.

Target:

- Wrap docx-preview failures as:

```ts
new ViewerFormatError({
  format: "docx",
  kind: "render_failed",
  message: "Failed to render DOCX.",
  cause: error,
})
```

- Use shared boundary.
- Preserve download action.

### XLSX

Current:

- Resource read and parse wrapping are mostly canonical.
- Worker codes exist: `parse_failed`, `range_too_large`, `too_many_cells`,
  `text_too_large`.
- Boundary stores only `boolean`.

Target:

- Worker should throw `XlsxWorkerError` with code.
- `range_too_large`, `too_many_cells`, and `text_too_large` map to bounds/state
  projection, not generic unknown parse failure.
- Boundary renders `ViewerErrorState`.

### FileViewer Legacy Routes

Current:

- Markdown, HTML, and text route helpers still throw plain `Error` for HTTP
  failures.
- `FileErrorBoundary` renders `UnsupportedCard`.

Target:

- Legacy routes either migrate to `ViewerResource` or throw `ResourceError`.
- `FileErrorBoundary` stores actual error.
- Unsupported state remains explicit and does not masquerade as load failure.

## Retry Policy

Retry is a projection, not a property on the raw error class.

Inputs:

- error domain/kind
- source kind
- whether the viewer can reset the underlying cache
- whether retry would repeat identical deterministic work

Default rules:

| Condition                           | Retry                                   |
| ----------------------------------- | --------------------------------------- |
| URL fetch failure                   | yes                                     |
| URL HTTP error                      | yes                                     |
| URL parse failure                   | yes, if cache eviction/retry key exists |
| Blob parse failure                  | usually no                              |
| Text inline bounds failure          | no                                      |
| Invalid viewer props                | no                                      |
| Abort                               | no                                      |
| Worker unavailable with fallback    | no user-visible error                   |
| Worker unavailable without fallback | maybe, but usually no                   |

Viewers may override with `retry: "always" | "never"` in the projection
context, but the override must be rare and documented.

## Download Policy

Error UI should preserve download access when it helps the user recover.

Rules:

- Resource fetch errors still show download for URL sources because opening the
  original URL may work outside the viewer.
- Parse/decode/render failures show download because the source file may still be
  useful.
- Bounds failures show download because the viewer intentionally refused preview.
- Unsupported source/format shows download if a download capability exists.
- Abort does not need download UI unless it is rendered as an error.
- Derived exports, such as CSV table serialization, remain viewer-specific but
  should still flow through the same error UI button placement.

## Test Plan

### Unit Tests For `viewer-errors.ts`

Cover:

- every `ResourceErrorKind`
- every shared `ViewerFormatErrorKind`
- unknown thrown value
- DOM abort errors
- structural guards when `instanceof` fails
- retry policy for URL, Blob, and text source kinds
- download usefulness policy
- user message strings

### Component Tests

For each migrated viewer:

- boundary stores and renders actual error info
- `data-error-domain` and `data-error-kind` are present
- reset key clears the error
- retry button appears only when expected
- download button remains available when expected
- resource errors are not wrapped as format errors
- format errors preserve `cause`

### Regression Tests

Specific tests:

- PDF failed fetch renders resource/http error, not parse error.
- PDF corrupt bytes render `format=parse_failed`.
- Image decode failure renders `format=decode_failed`.
- Text too-large renders `format=bounds` or canonical bounds info.
- CSV worker parse failure renders `format=parse_failed`.
- DOCX render failure renders `format=render_failed`.
- XLSX worker `too_many_cells` renders bounds/too-large copy.
- FileViewer unsupported source renders unsupported, not generic load failed.

## Migration Sequence

1. Add `viewer-errors.ts`.
2. Re-export errors from `viewer-resource.ts`.
3. Add `viewer-error.tsx`.
4. Migrate CSV first because it has explicit state and local error union.
5. Migrate PDF boundary.
6. Migrate Image boundary.
7. Migrate PPTX boundary.
8. Migrate Text boundary.
9. Migrate DOCX and XLSX boundaries.
10. Migrate FileViewer legacy text/markdown/HTML route errors.
11. Delete local message functions that duplicate `toViewerErrorInfo`.
12. Delete local error unions that no longer carry extra information.

## Non-Negotiables

1. `ResourceError` never becomes a parse/render error.
2. Format-specific failures never become generic transport errors.
3. UI never branches on raw message text.
4. Error boundaries never store only `boolean`.
5. Abort does not poison caches.
6. Retrying a failed URL load must be possible where existing behavior already
   supports retry.
7. Error UI must preserve download access when useful.
8. Test-visible error domain/kind attributes must exist.
9. The source layer remains ignorant of format names.
10. The projection layer is the only place that maps typed errors to user copy.

## Final Shape

The ideal call chain is:

```txt
ViewerSource
  -> ViewerResource
  -> format loader
  -> ResourceError | ViewerFormatError | ViewerStateError
  -> toViewerErrorInfo
  -> ViewerErrorState
```

This keeps the abstraction honest:

- one source vocabulary
- one resource capability boundary
- format-specific loading and parsing
- one canonical error vocabulary
- one UI projection layer

That is the minimum structure needed for consistent, debuggable, user-friendly
viewer errors without flattening real format differences.
