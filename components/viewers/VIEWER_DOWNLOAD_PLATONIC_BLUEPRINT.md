# Viewer Download Platonic Blueprint

This blueprint defines the remaining work required to move the viewer download
system from "canonical and good" to "as close as practical to perfect."

The current model is already the correct foundation:

```txt
ViewerResource owns original source download.
Viewers own derived exports.
Shared download UI owns browser download mechanics.
```

The remaining work is not a rewrite. It is closure: remove ambiguity, improve
failure handling, prove the abstraction with one more derived-export viewer, and
delete stale conceptual vocabulary from old docs.

## Standard Of Perfection

The target standard is:

- one way to expose the original file
- one way to expose viewer-generated exports
- one browser execution path
- no component-local anchor clicking
- no component-local object URL management
- no render-time Blob or text serialization for generated downloads
- no silent substitution of derived exports for originals
- no stale public naming such as `downloadName`, `downloadFileName`,
  `getDownload`, or `DownloadCapability`
- errors are structured, testable, and visible enough for users
- every variable name states whether it represents original source bytes,
  derived export bytes, or browser execution state

The system should feel boring. Every viewer should make the same small set of
decisions and delegate everything else.

## Current Canonical Shape

The implemented primitive is:

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

The resource entrypoint is:

```ts
resource.getOriginalDownload()
```

The viewer entrypoint is:

```tsx
<ViewerDownloadControl actions={downloadActions} />
```

The key performance rule is:

```txt
Only true href payloads render as anchors.
Blob, text, and derived payloads materialize only on click.
```

That rule is correct. It avoids render-time object URL churn and avoids
serializing generated exports before the user asks for them.

## Remaining Imperfections

### 1. Failed Download UX Is Too Quiet

`triggerViewerDownload` throws typed `ViewerDownloadError` values. The React
control currently contains failures so a rejected export does not crash the
viewer.

That is mechanically safe but not ideal. A user can click an export, have
payload preparation fail, and receive no visible explanation.

The ideal behavior:

- direct callers still receive `ViewerDownloadError`
- `ViewerDownloadControl` stores the last failed action id and error
- icon-only controls expose failure via tooltip/title or a toast hook
- label controls can render a compact inline message only when the local viewer
  already has error affordance space
- failure state clears on the next attempted download or when actions change

The shared control should not invent a global toast dependency. Instead it
should accept an optional callback:

```ts
onError?: (error: ViewerDownloadError, action: ViewerDownloadAction) => void
```

Default behavior should remain non-crashing and visually quiet. Product surfaces
that already have toast infrastructure can opt in.

### 2. Abort Support Is Not Fully Proven

`ViewerDownloadAction.getPayload` accepts `{ signal }`, but the current control
does not create an `AbortController`.

That is acceptable for small Blob/text exports. It is incomplete for future
large async exports.

Ideal behavior:

- every button/menu-triggered download creates one controller
- clicking a different action aborts the previous pending action
- unmount aborts the pending action
- pending state is per action, not only a boolean
- aborted actions map to `ViewerDownloadErrorKind = "aborted"`
- abort is not shown as a user-facing failure unless the user explicitly
  cancelled something visible

The control should not expose cancellation UI until a real viewer needs it. The
internal lifecycle should still be correct.

### 3. Payload Kinds Are Good, But Metadata Is Thin

The payload union answers "what bytes or URL should be downloaded." It does not
answer whether the payload is expensive, estimated size, or format-changing.

Do not add metadata preemptively. Add only two fields if a second migrated
viewer proves the need:

```ts
isExpensive?: boolean
description?: string
```

`isExpensive` would let menus avoid accidental heavy generation and let product
surfaces add confirmation later. `description` would let multi-action menus
explain ambiguous options without hardcoding copy in viewers.

Until there is a real second use case, keep the action type as-is.

### 4. Derived Export Is Only Proven With CSV

CSV proves one derived export:

```txt
parsed table -> serialized CSV/TSV text
```

That is useful, but it is not enough pressure to declare the abstraction
complete.

The next proof should be a viewer with a different export shape. Good candidates:

- image: export current frame as PNG or original image
- PDF: export selected page or visible page as an image
- XLSX: export current sheet as CSV

The best next candidate is XLSX current-sheet CSV export because:

- it is derived, not original
- it is table-like but not the CSV viewer itself
- it tests file naming rules across format conversion
- it may be async if workbook data needs extraction
- it can share CSV serialization without putting export mechanics in the XLSX
  viewer chrome

Do not declare the download abstraction complete until one of these is migrated
through `ViewerDownloadAction`.

### 5. Naming Is Almost Right, But Needs A Final Audit

The ideal vocabulary:

- `downloadAction`: one action
- `downloadActions`: action list
- `originalDownloadAction`: resource-derived original file action, when a
  viewer also has derived actions
- `exportAction`: viewer-derived action
- `exportFileName`: filename for a derived artifact
- `fileName`: original file name from the resource/source descriptor
- `payload`: browser download payload

Avoid:

- `downloadName`
- `downloadFileName`
- `download`
- `src`
- `href` as a generic source name
- `data` as a viewer input source

`href` is only allowed for an actual browser URL payload. It should not mean
"file input" or "load source."

### 6. Historical Blueprints Still Contain Legacy Concepts

Runtime code and tests no longer use old download APIs, but older blueprint docs
still reference:

- `DownloadCapability`
- `getDownload()`
- `ViewerDownloadAnchor`
- `useDownloadHref`

Those references are historically understandable, but not perfect. The docs
should either be updated or marked as superseded.

Ideal documentation state:

- `VIEWER_DOWNLOAD_BLUEPRINT.md` records the implemented canonical system
- this file records the closure plan
- older source/error/direct-load blueprints contain a short note:

```md
Superseded note: download behavior now uses `ViewerDownloadAction` and
`ViewerResource.getOriginalDownload()`.
```

That avoids rewriting old design history while preventing future confusion.

## Target API After Closure

The likely final API is intentionally close to the current one:

```ts
export interface ViewerDownloadAction {
  id: string
  label: string
  fileName: string
  origin: "original" | "derived"
  isDisabled?: boolean
  getPayload: (options?: {
    signal?: AbortSignal
  }) => ViewerDownloadPayload | Promise<ViewerDownloadPayload>
}
```

No extra abstraction should be added unless the second derived-export migration
forces it.

The control may grow operational props:

```ts
export interface ViewerDownloadControlProps {
  actions: Array<ViewerDownloadAction | null | undefined>
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  showLabel?: boolean
  onError?: (error: ViewerDownloadError, action: ViewerDownloadAction) => void
}
```

Do not add:

- global download registry
- action factories for every viewer-specific export
- a class-based download manager
- retry queues
- progress UI before a real long-running export exists
- a generic "file operation" abstraction that mixes preview loading, original
  download, and derived export

Those would make the system more impressive and less correct.

## Ideal Internal Execution Model

The shared UI should behave like this:

```txt
render:
  filter null actions
  if 0 actions -> disabled button
  if 1 action -> button or href anchor
  if many actions -> menu trigger

href action:
  render anchor
  no object URL
  no pending state

button action:
  create AbortController
  mark action pending
  call triggerViewerDownload(action, { signal })
  map errors to ViewerDownloadError
  call onError if provided
  clear pending action
  abort on unmount

triggerViewerDownload:
  get payload
  if href -> temporary anchor click
  if blob/text -> create object URL
  temporary anchor click
  revoke object URL in finally
```

The executor remains DOM-specific and stays in the UI module. The action types
and factories remain DOM-free and React-free.

## Viewer Migration Rules

Every viewer should follow these rules:

### Single-Action Viewers

Use:

```ts
const downloadAction = resource.getOriginalDownload()
```

Then:

```tsx
<ViewerDownloadControl actions={[downloadAction]} />
```

PDF, image, text, PPTX, DOCX, and XLSX currently fit this pattern.

### Multi-Action Viewers

Use explicit naming:

```ts
const originalDownloadAction = {
  ...resource.getOriginalDownload(),
  label: "Download original",
}

const exportAction = createViewerSpecificExportAction(...)

const downloadActions = [originalDownloadAction, exportAction]
```

Never label both actions "Download."

### Derived-Only Viewers

If there is no original resource, expose only the export:

```ts
const downloadActions = [exportAction]
```

The label should state the actual operation:

- `Export table`
- `Export sheet`
- `Export page`
- `Export image`

Do not call derived-only actions "Download original."

## File Naming Rules

Perfect naming rules:

- original download uses `resource.fileName`
- derived export uses `exportFileName`
- same-format lossless export may reuse the original filename
- format-changing export should change the extension
- partial export should add a suffix only when ambiguity matters

Examples:

```txt
report.csv original -> report.csv
report.csv table export -> report.csv
report.xlsx current sheet CSV export -> report.csv or report.sheet.csv
deck.pptx selected slide PNG export -> deck.slide-3.png
document.pdf page image export -> document.page-4.png
image.tiff current frame PNG export -> image.frame-2.png
```

The naming helper should stay viewer-local until two viewers duplicate the same
logic. Shared filename helpers are allowed only after real duplication appears.

## Error Policy

The ideal error split:

```txt
ResourceError:
  fetch, HTTP status, range, bounds, unsupported source capability

ViewerFormatError:
  parse/render/format-specific preview failure

ViewerDownloadError:
  disabled download, aborted export, failed payload preparation,
  unsupported download action
```

Do not map viewer render failures into `ViewerDownloadError`.

Do not map CSV serialization failures into `ResourceError`.

Do not parse error messages to decide user-facing behavior.

## Test Plan

Required tests after closure:

- href action renders as an anchor
- href action does not call `URL.createObjectURL`
- Blob action does not call `URL.createObjectURL` during render
- text action does not call `URL.createObjectURL` during render
- Blob action creates and revokes object URL after click
- text action creates and revokes object URL after click
- derived action does not call `getPayload` during render
- derived action calls `getPayload` exactly once on click
- failed derived action calls `onError`
- failed derived action clears pending state
- action failure does not crash viewer
- pending action aborts on unmount
- multi-action menu disables actions while one action is pending
- CSV source exposes `Download original` and `Export table`
- CSV table source exposes only `Export table`
- second derived-export viewer exposes original plus derived export
- registry build includes the shared download modules

The most important missing test is the second derived-export viewer.

## Implementation Plan

1. Add `onError` to `ViewerDownloadControl`, `ViewerDownloadButton`, and
   `ViewerDownloadMenu`.
2. Store `lastError` internally only if needed for accessibility attributes or
   future tooltip behavior.
3. Add internal `AbortController` handling for button/menu-triggered downloads.
4. Abort pending action on unmount.
5. Pass `{ signal }` into `triggerViewerDownload`.
6. Add tests for `onError`, pending cleanup, and abort.
7. Pick one non-CSV derived export migration.
8. Prefer XLSX current-sheet CSV export as the proof case.
9. Implement the viewer-specific export builder in the XLSX viewer module.
10. Wire XLSX toolbar to `Download original` plus `Export sheet`.
11. Add focused XLSX tests proving original vs derived behavior.
12. Add superseded notes to older blueprint docs that mention legacy download
    vocabulary.
13. Run type-check, focused viewer tests, registry build, and diff checks.

## Explicit Non-Goals

Do not build:

- a generic file operation framework
- a download queue
- progress bars without a real long-running export
- global toast coupling
- a shared export registry
- eager object URL generation for Blob/text payloads
- hidden derived export substitution when original download is unavailable

These would add structure without proven value.

## Definition Of Done

The download system reaches practical perfection when:

- all runtime code uses `ViewerDownloadAction`
- all resource-backed viewers use `getOriginalDownload()`
- at least two viewers expose derived exports through the same action model
- Blob/text/derived payloads are lazy
- `href` payloads remain anchor-native
- failures are typed and optionally user-visible
- pending async actions are abort-safe
- old docs are clearly marked as superseded where they mention legacy APIs
- tests prove original, derived, href, Blob, text, failure, abort, and menu
  behavior

At that point the abstraction is not merely good. It is small enough, fast
enough, and proven enough to be considered the canonical download model for the
viewer system.
