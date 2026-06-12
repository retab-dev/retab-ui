# File Viewer V2 Blueprint

This blueprint describes the next quality pass for
`registry/new-york-v4/ui/file-viewer.tsx`. The current implementation is no
longer obviously broken in the places the first blueprint targeted. V2 is about
making the component boring under stress: large files, rapid prop switches,
network failures, hostile host CSS, and narrow layouts.

## North Star

`FileViewer` should be a thin, predictable shell:

```tsx
<FileViewer
  source={{ kind: "url", url: "/samples/report.pdf", fileName: "report.pdf" }}
/>
```

It should normalize file identity once, route to one specialized viewer, provide
consistent chrome, and make loading/error behavior observable and recoverable.
It should not become a generic document engine.

## Current State

The first hardening pass added:

- shared descriptor resolution for routing, fallback, downloads, and reset keys
- error-boundary reset on meaningful viewer-selection inputs
- mode-aware text caches for streamed text versus full JSON loads
- stale text request guards
- toolbar truncation rules for long filenames and metadata
- focused regression tests for descriptor and text-cache behavior

Remaining gaps are mostly about lifecycle ownership and verification depth:

- in-flight text fetches are ignored when stale, but not aborted
- text cache ownership lives inside the component file and has no explicit
  inspect/reset API
- browser behavior is not yet proven against large real files and rapid switches
- the file mixes router, text loader, text renderer, chrome, fallbacks, and error
  boundary logic
- errors are technically caught but still generic from a user perspective
- performance budgets are not encoded anywhere

## Design Principles

1. Keep `FileViewer` small and public API narrow.
2. Move complexity to private modules only when it creates stronger ownership.
3. Treat file identity as structured data, not repeated string inference.
4. Abort obsolete work instead of only ignoring obsolete results.
5. Make caches bounded, testable, and disposable.
6. Verify with real browser behavior before claiming performance wins.
7. Preserve leaf-viewer ownership of format-specific parsing and layout.

## Target Module Shape

Keep public imports stable, but split internals:

```txt
registry/new-york-v4/ui/file-viewer.tsx
registry/new-york-v4/ui/file-viewer-core.ts
registry/new-york-v4/ui/file-viewer-text-loader.ts
registry/new-york-v4/ui/file-viewer-text-viewer.tsx
registry/new-york-v4/ui/file-viewer-chrome.tsx
```

Responsibilities:

- `file-viewer.tsx`: public component, lazy viewer routing, descriptor wiring
- `file-viewer-core.ts`: category detection, descriptor resolution, reset keys
- `file-viewer-text-loader.ts`: range fetches, cache keys, LRU, abort lifecycle
- `file-viewer-text-viewer.tsx`: virtualized text UI and syntax rendering
- `file-viewer-chrome.tsx`: `DocShell`, fallback, unsupported card, error UI

Do not split until tests cover the behavior being moved.

## Public API

Keep the current prop surface:

```ts
export interface FileViewerProps {
  source: ViewerSource
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}
```

Possible V2 additions must clear a high bar:

- `onError?: (error: Error, descriptor: FileDescriptor) => void`
- `onLoadStateChange?: (state: FileViewerLoadState) => void`

Do not add either unless a real caller needs it. Internal state should not leak
into the public API for test convenience.

## Text Loading

### Abortable Requests

Every range/full text request should be tied to an `AbortController`.

Rules:

- changing `source` or `as` aborts pending text work
- unmounting a text viewer aborts pending text work
- an aborted request must not surface as a user-visible error
- a non-abort fetch failure should clear busy state and render through the error
  boundary or a text-specific error panel

Target helper shape:

```ts
interface TextLoadRequest {
  key: string
  resource: ViewerResource
  mode: TextLoadMode
  signal: AbortSignal
}

function loadFirstTextChunk(request: TextLoadRequest): Promise<TextSnapshot>
function loadNextTextChunk(request: TextLoadRequest): Promise<TextSnapshot>
```

### Cache Ownership

The text loader should own its cache.

```ts
interface TextLoaderCache {
  getSnapshot(key: string): TextSnapshot | null
  loadFirst(request: TextLoadRequest): Promise<TextSnapshot>
  loadNext(request: TextLoadRequest): Promise<TextSnapshot>
  delete(key: string): void
  clear(): void
  size(): number
}
```

Rules:

- cache keys include `resource.cacheKey` and `TextLoadMode`
- first-chunk promise and streaming loader state are evicted together
- failed first-chunk requests are removed from cache so retry can work
- aborted requests are removed only if they did not produce a usable snapshot
- cache max stays small and explicit

## Error Model

Errors should be more useful without becoming chatty.

Error states:

- unsupported format: stable fallback with download
- lazy viewer load failure: retry on descriptor change and show download
- fetch failure: show status when known and keep download available
- parse/render failure: show format-specific fallback where possible
- aborted text request: no visible error

The error boundary should receive a descriptor, not just `className`, so the
fallback can show a consistent filename and download link.

## Chrome

`DocShell` should be the only shared toolbar implementation.

Rules:

- title always truncates before actions disappear
- metadata truncates before title when space is scarce
- download remains accessible in narrow containers
- zoom/action buttons keep fixed square dimensions
- fallback and final viewer share toolbar height
- keyboard focus order is title-independent and stable

Add visual regression scenarios for:

- 320 px container
- long filename with no spaces
- long filename plus long metadata
- `bare` and non-`bare`

## Verification Matrix

Use the viewer demo and representative files:

| Format     | Small | Large  | Failure        | Notes                                |
| ---------- | ----- | ------ | -------------- | ------------------------------------ |
| PDF        | yes   | yes    | bad URL        | pages and zoom stable                |
| Image/TIFF | yes   | yes    | bad URL        | multi-frame TIFF still navigable     |
| DOCX       | yes   | yes    | corrupt file   | lazy chunk and parser errors recover |
| PPTX       | yes   | yes    | corrupt file   | slide navigation stable              |
| XLSX       | yes   | yes    | corrupt file   | virtualization unaffected by chrome  |
| CSV/TSV    | yes   | yes    | bad range      | dense table remains scrollable       |
| Markdown   | yes   | large  | unsafe HTML    | sanitizer still applies              |
| HTML       | yes   | large  | unsafe script  | iframe sandbox holds                 |
| JSON       | yes   | large  | invalid JSON   | invalid JSON renders as text         |
| Log/Text   | yes   | 200 MB | aborted switch | no stale lines, no stuck spinner     |

## Performance Budgets

Set practical budgets before optimizing:

- initial text/log paint under 500 ms for a 200 MB local sample after network
  response starts
- rapid switch between two text files leaves no stale content visible
- scroll near the end of a loaded chunk does not block the main thread over one
  frame budget in normal Chrome dev hardware
- mounted viewer does not retain more than the bounded cache permits after route
  changes
- `isolateStyles` improves dense-grid scroll under broad `:has()` host CSS and
  does not visibly change output

Use browser measurements for these; jsdom tests are not enough.

## Test Plan

### Unit Tests

Add or preserve coverage for:

- `detectCategory`
- descriptor resolution and reset key generation
- text cache keys
- LRU eviction of paired text entries
- failed first-chunk retry behavior
- abort handling does not cache a permanent failure

### React Tests

Cover:

- switching text source while first chunk is pending
- switching text source while next chunk is pending
- same URL rendered as JSON and streamed text without cache poisoning
- error boundary recovery when `source` or `as` changes
- long filename toolbar keeps download reachable
- unsupported fallback keeps download reachable

### Browser Tests

Add Playwright or in-app browser verification for:

- every supported format renders from the demo page
- rapid source switching in the text viewer
- narrow toolbar layout
- bad URL/error fallback with download
- console remains free of unexpected errors

## Implementation Phases

### Phase 1: Lifecycle Safety

1. Introduce `AbortController` ownership in `TextDocViewer`.
2. Pass `AbortSignal` into full and range text fetches.
3. Treat abort errors as silent cancellations.
4. Remove failed first-chunk promises from cache so retry works.
5. Add React tests for pending first-chunk and pending next-chunk switches.

### Phase 2: Cache Module

1. Move text cache and range fetch code into `file-viewer-text-loader.ts`.
2. Export only production-safe helpers.
3. Add cache unit tests for mode separation, eviction, retry, and abort.
4. Keep public `FileViewer` imports compatible.

### Phase 3: Chrome And Error UX

1. Move shared chrome to `file-viewer-chrome.tsx`.
2. Give `FileErrorBoundary` enough descriptor data to render download fallback.
3. Improve fetch/parser error copy without adding noisy instructions.
4. Add narrow container visual/browser checks.

### Phase 4: Text Viewer Split

1. Move text virtualization and syntax highlighting into
   `file-viewer-text-viewer.tsx`.
2. Keep JSON-as-text behavior unchanged.
3. Preserve style isolation behavior.
4. Browser-test large log, JSON, and syntax-highlighted code samples.

### Phase 5: Full Verification

1. Run focused unit/React tests.
2. Run TypeScript checks for touched modules.
3. Run the viewer demo in a browser across the verification matrix.
4. Regenerate `public/r/file-viewer.json`.
5. Document any repo-wide typecheck failures that are unrelated.

## Non-Goals

- Do not redesign visual styling.
- Do not add new supported file formats.
- Do not replace leaf viewers.
- Do not add a plugin architecture.
- Do not fetch large text files all at once except JSON mode.
- Do not make `isolateStyles` default without measured evidence.
- Do not add public cache controls unless a product caller needs them.

## Acceptance Criteria

V2 is done when:

- rapid file switching cannot show stale text content
- obsolete text requests are aborted, not only ignored
- text cache behavior is directly unit-tested
- failed text loads can retry without a reload
- fallback/error UI always preserves download access
- narrow toolbars keep primary actions reachable
- the file viewer source is split along real ownership boundaries
- registry output is regenerated
- focused tests pass
- browser verification covers all supported formats and large text behavior
