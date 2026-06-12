# Viewer Download Blueprint

This document records the canonical download model implemented for the viewer
system.

The rule is:

```txt
ViewerResource downloads the original source.
Viewers may define derived exports.
Shared download UI executes both through one action model.
```

Original download and derived export are intentionally different concepts. They
share browser mechanics, but they do not mean the same thing.

## Implemented Model

The shared action type lives in `registry/new-york-v4/lib/viewer-download.ts`.

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

The shared React/browser implementation lives in
`registry/new-york-v4/ui/viewer-download.tsx`.

```tsx
<ViewerDownloadControl actions={actions} />
```

Behavior:

- zero actions: disabled icon button
- one action: direct download button
- multiple actions: menu of explicit download choices
- original `href` action: rendered as an anchor through the shared button
- original Blob/text action: executed lazily through a button click
- derived/generated action: executed lazily through a button click
- generated object URLs: created and revoked by the shared executor
- async payload failure: contained by the control, while `triggerViewerDownload`
  still throws typed errors for direct callers and tests

## Resource Ownership

`ViewerResource` exposes only the original source download:

```ts
interface ViewerResource {
  getOriginalDownload(): ViewerDownloadAction
}
```

That naming is deliberate. A resource can return the bytes or URL that represent
the original input, not the viewer's current interpreted state.

Implemented source behavior:

- URL source returns an original `href` action.
- Blob source with `downloadUrl` returns an original `href` action.
- Blob source without `downloadUrl` returns an original `blob` action.
- Text source returns an original `text` action.

The old `DownloadCapability`, `getDownload()`, `ViewerDownloadAnchor`, and
`useDownloadHref()` runtime APIs have been removed from the viewer code.

## Derived Export Ownership

Derived exports live in viewer-specific modules. They create
`ViewerDownloadAction` objects but do not click anchors, create object URLs, or
touch browser download mechanics.

CSV implements this in `registry/new-york-v4/ui/csv-viewer-download.ts`:

```ts
export function createCsvExportAction({
  columns,
  sourceRows,
  dialect,
  fileName,
}: {
  columns: string[]
  sourceRows: string[][]
  dialect: CsvDialect
  fileName: string
}): ViewerDownloadAction
```

The CSV export action has `origin: "derived"` and serializes the current parsed
table model lazily inside `getPayload`.

## Viewer Behavior

PDF, image, text, PPTX, DOCX, and XLSX expose one action:

```ts
const actions = [resource.getOriginalDownload()]
```

CSV may expose one or two actions:

```ts
const actions = [
  resource
    ? { ...resource.getOriginalDownload(), label: "Download original" }
    : null,
  createCsvExportAction({
    columns,
    sourceRows,
    dialect,
    fileName: resource?.fileName ?? defaultCsvDownloadName(dialect),
  }),
].filter(Boolean)
```

If CSV has only a parsed table source, it exposes only `Export table`.

If CSV has an original document source, it exposes both:

- `Download original`
- `Export table`

This avoids silently substituting a derived serialization for the original
source bytes.

## File Naming

The naming vocabulary is intentionally narrow:

- source descriptors own the original filename
- `ViewerResource.fileName` is the original download filename
- derived export builders choose filenames from viewer semantics
- canonical viewer props should not add parallel `downloadName` or
  `downloadFileName` APIs

CSV defaults:

- URL source `/report.tsv` downloads original `report.tsv`
- parsed table export with comma dialect defaults to `data.csv`
- parsed table export with tab dialect defaults to `data.tsv`
- source-backed derived export currently reuses the resource filename unless the
  viewer later adds an explicit format-changing export

## Error Model

Download execution has its own error type:

```ts
export type ViewerDownloadErrorKind =
  | "disabled"
  | "aborted"
  | "payload_failed"
  | "unsupported"

export class ViewerDownloadError extends Error {
  kind: ViewerDownloadErrorKind
  actionId: string
}
```

`ResourceError` remains for transport, bounds, and resource-read failures.
`ViewerDownloadError` is for download action execution and derived export
payload preparation.

## Module Boundaries

```txt
registry/new-york-v4/lib/viewer-download.ts
  ViewerDownloadAction
  ViewerDownloadPayload
  ViewerDownloadError
  createHrefDownloadAction
  createTextDownloadAction
  createBlobDownloadAction
  createDisabledDownloadAction

registry/new-york-v4/ui/viewer-download.tsx
  ViewerDownloadButton
  ViewerDownloadMenu
  ViewerDownloadControl
  useViewerDownloadHref
  triggerViewerDownload

registry/new-york-v4/ui/csv-viewer-download.ts
  serializeCsvTable
  defaultCsvDownloadName
  createCsvExportAction
```

The `lib` module is React-free and DOM-free.

The `ui` module owns React state, temporary anchors, object URLs, and browser
download behavior.

Viewer-specific modules own only viewer-specific export semantics.

## Verification Targets

The implementation should keep these invariants covered by tests:

- URL source original action returns `href`.
- Blob source original action creates and revokes an object URL.
- Text source original action downloads text with filename.
- CSV parsed table exposes only derived export.
- CSV document source exposes original and derived actions.
- CSV derived export serializes table data with the active dialect.
- Derived export payloads are not materialized during render.
- Download control renders an anchor for original `href` payloads.
- Failed async payloads do not crash the viewer.
- Generated object URLs are revoked after download execution.

## Final Shape

The abstraction is deliberately small:

- one action object
- one payload union
- one original resource entrypoint
- one shared browser executor
- viewer-owned derived export builders

That is the right boundary. It standardizes download mechanics without erasing
the semantic difference between original files and generated exports.
