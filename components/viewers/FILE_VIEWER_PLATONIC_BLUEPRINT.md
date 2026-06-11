# File Viewer Platonic Blueprint

This is the perfection blueprint for `FileViewer`. It is intentionally stricter
than the V2 hardening plan. The target is not “works well”; the target is a
component with no surplus surface area, no ambiguous ownership, no accidental
names, no unverified claims, and no code that needs a comment to excuse itself.

## Definition Of Perfect

`FileViewer` is perfect when every line earns its place.

It should be:

- complete: every required behavior exists
- minimal: no public or internal API exists only for convenience
- obvious: a reader can predict where any behavior lives
- stable: rapid prop changes, failures, and large files do not create edge cases
- verified: every important claim has a test or browser measurement
- consistent: names describe one concept each, everywhere
- dense: code carries information, not ceremony

## Public Contract

The public module should expose only what consumers need:

```ts
export type FileCategory = ...
export interface FileViewerProps { ... }
export function FileViewer(props: FileViewerProps): JSX.Element
```

Everything else is private to the implementation unless there is a real external
caller.

Allowed public props:

```ts
interface FileViewerProps {
  src: string
  fileName?: string
  mimeType?: string
  as?: FileCategory
  className?: string
  bare?: boolean
  isolateStyles?: boolean
}
```

Rules:

- Do not export loader caches.
- Do not export test helpers.
- Do not export descriptor internals.
- Do not export delimiter helpers.
- Do not add callbacks until a product caller needs them.
- Tests should import private modules directly only when the module is truly an
  internal unit with its own contract.

## Ideal Module Shape

The router file should be small enough to read in one screen.

```txt
registry/new-york-v4/ui/file-viewer.tsx
registry/new-york-v4/ui/file-viewer-core.ts
registry/new-york-v4/ui/file-viewer-chrome.tsx
registry/new-york-v4/ui/file-viewer-resource-cache.ts
registry/new-york-v4/ui/file-viewer-text-loader.ts
registry/new-york-v4/ui/file-viewer-text-viewer.tsx
registry/new-york-v4/ui/file-viewer-markdown-viewer.tsx
registry/new-york-v4/ui/file-viewer-html-viewer.tsx
registry/new-york-v4/ui/file-viewer-csv-viewer.tsx
```

Responsibilities:

- `file-viewer.tsx`: public export, descriptor creation, lazy routing only
- `file-viewer-core.ts`: type detection, descriptor normalization, identity keys
- `file-viewer-chrome.tsx`: shell, toolbar, skeletons, unsupported and error UI
- `file-viewer-resource-cache.ts`: tiny shared LRU primitive
- `file-viewer-text-loader.ts`: text range/full loading and cache ownership
- `file-viewer-text-viewer.tsx`: text/log/JSON rendering only
- `file-viewer-markdown-viewer.tsx`: markdown fetch, parse, sanitize, render
- `file-viewer-html-viewer.tsx`: HTML fetch and sandboxed iframe render
- `file-viewer-csv-viewer.tsx`: CSV/TSV adapter around `CsvViewer`

No file should know more than one layer above or below itself.

## Naming Standard

One concept, one name.

Use these names:

| Concept                               | Name               |
| ------------------------------------- | ------------------ |
| Normalized input                      | `descriptor`       |
| Descriptor identity for remount/reset | `descriptorKey`    |
| Text loader identity                  | `textKey`          |
| Rendered text viewer identity         | `textViewKey`      |
| Abort signal owned by `FileViewer`    | `descriptorSignal` |
| User-visible name                     | `displayName`      |
| Download filename                     | `downloadName`     |
| File route category                   | `category`         |
| Text load behavior                    | `textMode`         |

Rules:

- Do not use both `requestKey` and `cacheKey` for the same text identity.
- Do not use `fileName` when the value is actually `downloadName`.
- Do not use `src` as a proxy for file identity when `descriptor` is available.
- A variable named `signal` must be local to a fetch call; wider scopes must say
  what owns the signal.
- Tests should use the same names as production code.

## Descriptor Model

The descriptor is the single source of truth:

```ts
interface FileDescriptor {
  src: string
  displayName: string
  downloadName: string
  mimeType?: string
  category: FileCategory
}
```

Rules:

- Routing uses `descriptor.category`.
- Fallbacks use `descriptor.category` and `descriptor.downloadName`.
- Error UI uses `descriptor`.
- Downloads use `descriptor.downloadName`.
- Reset/remount uses `descriptorKey`.
- Leaf viewers receive only the fields they need.

`descriptorKey` includes every input that can change the mounted viewer:

```ts
descriptorKey = [src, displayName, mimeType ?? "", category].join("\0")
```

## Text Loader Ideal

The text loader should model ownership, not just cache bytes.

Target shape:

```ts
interface TextKey {
  src: string
  mode: "stream" | "full"
}

interface TextSubscription {
  textKey: string
  signal: AbortSignal
}

interface TextLoader {
  snapshot(textKey: string): TextSnapshot | null
  first(sub: TextSubscription): Promise<TextSnapshot>
  next(sub: TextSubscription): Promise<TextSnapshot>
  release(textKey: string): void
  clear(): void
}
```

Rules:

- One shared fetch may serve identical active subscribers only if abort semantics
  remain correct for every subscriber.
- Aborting one subscriber must not abort another subscriber that still needs the
  same text key.
- Failed first loads are retryable.
- Aborted first loads are not cached as failures.
- Loader state and first-load promises evict together.
- Whole-file JSON mode never shares loader state with streamed text mode.
- Text decoding preserves multibyte characters across range boundaries.

## Loading Semantics

Every viewer must have one of these states:

```ts
type ViewerState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "unsupported" }
  | { kind: "error"; error: FileViewerError }
```

Rules:

- Suspense is acceptable for lazy component loading.
- Fetching/parsing state should be explicit inside leaf viewers.
- Abort is not an error.
- Stale results never update rendered state.
- Switching descriptor resets loading, errors, token caches, and scroll-specific
  state where appropriate.
- Error UI always preserves download access.

## Error Model

Errors should be structured internally:

```ts
type FileViewerErrorKind =
  | "fetch"
  | "parse"
  | "render"
  | "unsupported"
  | "lazy-load"
```

Rules:

- User copy stays short.
- Developer detail stays available in the error object or console only when
  useful.
- Fetch errors include HTTP status when known.
- Corrupt parse errors identify the format.
- Lazy-load errors recover on `descriptorKey` change.
- Error UI is chrome-consistent with loading and ready states.

## Chrome Ideal

There is one toolbar implementation.

Rules:

- Filename truncates predictably.
- Metadata yields before actions.
- Download remains visible at 320 px when any action is visible.
- Zoom buttons have stable square dimensions.
- Skeleton, error, unsupported, and ready states have the same toolbar height.
- Focus order is stable.
- `bare` changes framing only, not behavior.

No viewer should hand-roll a toolbar.

## Leaf Viewer Boundaries

`FileViewer` routes. Leaves render.

Router-owned:

- descriptor creation
- lazy route selection
- reset key and abort-controller ownership
- top-level error boundary

Leaf-owned:

- fetch and parse semantics
- local loading state
- format-specific controls
- virtualizer configuration
- sandboxing details
- syntax highlighting
- dense-grid style isolation

Adapters are leaves too. Markdown, HTML, and CSV should not live in
`file-viewer.tsx`.

## Code Texture

The code should be information-dense:

- fewer exports
- fewer comments
- fewer wrapper names
- fewer cross-file imports
- fewer “just for tests” escape hatches
- no names that differ only by habit
- no dead fallback path that tests cannot reach

Comments are allowed only when they prevent a real misunderstanding:

- browser behavior that is counterintuitive
- security boundary rationale
- performance rationale backed by measurement
- non-obvious cache or abort semantics

Delete comments that merely restate code.

## Tests

Tests should prove contracts, not implementation trivia.

### Public Tests

Against `FileViewer`:

- unsupported format shows download fallback
- long filename keeps download reachable
- descriptor change recovers from an error
- rapid text file switch never shows stale content
- same URL as JSON and text does not share incompatible state

### Private Unit Tests

Against internal modules:

- category detection and MIME fallback
- descriptor normalization and descriptor key
- CSV/TSV delimiter selection
- text key construction
- paired LRU eviction
- failed first-load retry
- abort does not cache failure
- multi-subscriber abort semantics
- multibyte range decoding

### Browser Tests

Required before claiming perfection:

- every supported format renders in the demo page
- bad URLs preserve download access
- corrupt DOCX/PPTX/XLSX/CSV inputs fail gracefully
- 320 px toolbar remains usable
- 200 MB text/log sample paints incrementally
- rapid source switching leaves no stale content
- `isolateStyles` changes performance characteristics but not pixels
- console has no unexpected errors

## Performance Budgets

Perfection needs budgets:

- first text paint starts after the first range response, not after full file
- 200 MB log initial render under 500 ms after first response on local dev
- next chunk append does not block a frame on normal development hardware
- JSON pretty-print is bounded by file size and clearly uses full mode
- cache memory is bounded by documented entry count
- no route change leaks active fetches

Every budget needs a measurement note in the final implementation report.

## Registry Contract

The registry package must be self-contained.

Rules:

- Every private module imported by `file-viewer.tsx` is listed in `registry.json`.
- `public/r/file-viewer.json` contains the same file set.
- Generated registry output is not hand-edited.
- Registry metadata changes are minimal and scoped to file-viewer.

## Deletion List

Remove or privatize:

- `createTextLoaderCache` from the public `file-viewer` export
- `defaultTextLoaderCache` from the public `file-viewer` export
- `loadFirstTextChunk` and `loadNextTextChunk` from the public export
- `isCurrentTextRequest` from the public export
- `isAbortError` from the public export
- `textCacheKey` from the public export
- `formatBytes` from the public export
- `csvDelimiterForFile` from the public export
- Markdown/HTML/CSV adapter implementations from `file-viewer.tsx`

Tests may import private modules directly by path.

## Implementation Phases

### Phase 1: Public Surface Purge

1. Move tests off public re-exports and onto private modules where needed.
2. Remove every non-consumer export from `file-viewer.tsx`.
3. Keep only `FileViewer`, `FileViewerProps`, and `FileCategory` public.
4. Run focused tests and touched-file TypeScript checks.

### Phase 2: Adapter Extraction

1. Move Markdown viewer into `file-viewer-markdown-viewer.tsx`.
2. Move HTML viewer into `file-viewer-html-viewer.tsx`.
3. Move CSV adapter into `file-viewer-csv-viewer.tsx`.
4. Ensure `file-viewer.tsx` contains only routing and lazy imports.
5. Update `registry.json` and regenerate registry output.

### Phase 3: Naming Pass

1. Rename reset/cache/view/request concepts to the standard names.
2. Remove synonyms.
3. Make test naming match production naming.
4. Reject any name that requires a second sentence to explain.

### Phase 4: Text Loader Semantics

1. Introduce subscriber-aware text loading.
2. Preserve retry and abort behavior.
3. Add multi-subscriber abort tests.
4. Add multibyte range decoding tests.
5. Keep JSON full mode isolated from streamed mode.

### Phase 5: Error And State Model

1. Introduce internal structured error kinds.
2. Keep user copy concise.
3. Preserve download fallback in every error state.
4. Test descriptor-change recovery for every route class that can fail.

### Phase 6: Browser Proof

1. Add or run browser verification for all supported formats.
2. Capture toolbar behavior at 320 px and normal desktop width.
3. Measure large text/log initial paint and scroll append.
4. Verify console cleanliness.
5. Document results in the implementation report.

## Acceptance Criteria

The Platonic pass is done only when:

- public exports contain no internals
- `file-viewer.tsx` is a router, not an adapter host
- every module has one reason to exist
- every identity concept has exactly one name
- text loader abort semantics are correct with multiple subscribers
- every failure path keeps download access
- registry packaging is complete
- focused unit and React tests pass
- touched-file TypeScript diagnostics are clean
- browser verification covers every supported format
- performance budgets have measured evidence
- the final diff has no unrelated formatting churn

If any item is missing, the component may still be good. It is not perfect.
