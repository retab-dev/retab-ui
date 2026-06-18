# Code Viewer Performance Blueprint

## Current State

The code viewer already has the right core shape for large files:

- `CodeViewer` routes through `PlainTextViewerFrame` and renders a client skeleton before the interactive surface mounts.
- `CodeViewerContent` reads the text resource, splits it into source lines, owns zoom/highlight state, and passes all visible rendering work to the projector.
- `createCodeProjector` renders imperatively into a single `<pre>` host instead of creating one React component per line.
- Virtualization is fixed-height and line-based, so scroll math is cheap and stable.
- Syntax highlighting is line-scoped through Prism, with a per-viewer token cache keyed by raw line text.
- Scroll projection is scheduled through `requestAnimationFrame`.

The important existing guarantees:

- large files do not mount every line
- stable projections avoid DOM rewrites
- content changes clear stale rows
- URL text loads are shared across rerenders
- fallback content replaces stale handles while a new URL source is pending
- source-line highlighting remains exact

The remaining performance work should preserve this architecture. The goal is to remove unnecessary work from the hot paths, not to replace the viewer with a generic editor or virtualizer.

## Goal

Make the code viewer faster in three observable ways:

- initial mount should spend less time deriving resource identity and line metadata
- scroll should avoid projector work when the visible line window has not changed
- large jumps should reuse row DOM and syntax work where possible

Target behavior:

- scrolling by less than one line should not patch or reorder rows
- repeated projection with identical content, layout, syntax, highlight, and visible range should be a no-op
- large inline text should not be embedded into cache keys
- text should be split and line-counted once per content identity and bounds
- large jump scrollbench should allocate fewer row nodes
- syntax highlighting should never block first readable text longer than necessary

## Non-Goals

- Do not replace the projector with React row rendering.
- Do not introduce Monaco, CodeMirror, or a heavyweight editor dependency.
- Do not weaken line-number, highlight, or scroll-to-line correctness.
- Do not keep stale source content visible while a replacement URL source is pending.
- Do not remove the shared resource layer.
- Do not raise default file size limits as part of this work.
- Do not start a dev server from the implementation workflow unless explicitly requested.

## Phase 0: Baseline And Budget

### Problem

There is a scrollbench target for the code viewer, but no dedicated code-viewer performance budget comparable to the JSON table budget.

### Design

Use the existing scrollbench route with `viewer=text` as the browser-level baseline:

```txt
/scrollbench?viewer=text
```

Record at least:

- small-jump FPS
- large-jump FPS
- p95 frame time
- max frame time
- initial time from mount to first visible rows
- row node allocation count during a large-jump run

Add a small code-viewer-specific profiler script only after the target numbers are clear. It should drive the existing `window.__scrollbench` API instead of creating a second benchmark path.

### Verification

- baseline JSON artifact committed only if it becomes an enforced budget
- repeat each browser run at least 3 times
- record viewport size and browser channel with each run

## Phase 1: No-Op Same-Window Scroll Projection

### Problem

`useCodeProjectionScheduler` correctly batches scroll events into one animation-frame projection. The projector still walks every visible virtual row on each scheduled projection, even when the scroll offset remains inside the same visible line window.

For fixed-height rows, moving from `scrollTop = 100` to `scrollTop = 108` usually does not change the virtual range. The browser scrolls the content naturally; the row DOM does not need new transforms, text, layout, or ordering.

### Design

Teach `createCodeProjector` to return early when the full projection key is unchanged:

```ts
type LastProjection = {
  contentIdentity: string
  layoutIdentity: string
  syntaxIdentity: string
  highlightIdentity: string
  totalHeight: string
  visibleStart: number
  visibleEnd: number
}
```

On each projection:

1. compute total height
2. compute the visible range
3. build the projection key
4. if it matches the previous projection key, return before `removeRowsOutsideVisibleRange` and `syncVisibleRowOrder`
5. otherwise continue with the current patch path

Highlight identity must be explicit, for example:

```ts
const highlightIdentity = input.highlightRange
  ? `${input.highlightRange.start}:${input.highlightRange.end}`
  : ""
```

The early return must not skip:

- content changes
- syntax changes
- zoom/layout changes
- gutter width changes
- highlight changes
- row host changes

### Verification

- existing code viewer tests pass
- add a projector test proving same-window scroll performs no `insertBefore`, `replaceChildren`, or text updates
- add a projector test proving crossing a line boundary still reorders/patches rows
- scrollbench small-jump p95 frame time improves or stays stable

## Phase 2: Compact Inline Text Identity

### Problem

Inline text currently enters resource cache keys as the full text payload. For generated or large inline sources, this makes resource creation and cache lookup scale with the entire file before the viewer can render anything.

The slow path is:

- `payloadCacheKey(source)` returns `textPayloadIdentityKey(source.text)`
- `textPayloadIdentityKey(text)` returns `text:${text}`
- resource registries store keys containing the whole text

`viewerContentRenderKey` already has a compact `textPayloadKey(text)` shape using length plus hash. The load key should use a compact identity too.

### Design

Make inline text load identity compact and explicit:

```ts
function payloadCacheKey(source: ViewerSource) {
  if (source.kind === "url") return ""
  if (source.kind === "blob") return blobObjectKey(source.blob)
  if (source.identityKey) return ""
  return textPayloadKey(source.text)
}
```

Keep the contract strict:

- if a caller supplies `identityKey`, it owns content identity
- if the text changes without changing `identityKey`, the cache may return the old resource
- generated benchmark sources should provide stable versioned identity keys
- sources without explicit identity use the compact content key

Use the same compact identity in `defaultIdentityKey` for text sources unless a test depends on exact text exposure for user-visible metadata. Cache keys should not contain unbounded payloads.

### Verification

- update tests that assert exact private key behavior
- add a regression test with a large inline source proving `resource.content.key.length` remains bounded
- add a source-change test proving text without explicit `identityKey` still invalidates when content changes
- add a source-change test documenting explicit `identityKey` authority

## Phase 3: Prepared Text Document Cache

### Problem

The text path does repeated full-string work:

- inline text bounds check encodes the full string for bytes
- inline text line limit splits the full string
- `CodeViewerContent` splits the same text again for rendering
- streamed URL text counts line breaks while reading, then does a final split-based line assertion, then the viewer splits again

For the current default limits this is manageable, but it is still unnecessary work on the initial mount path.

### Design

Introduce a prepared text document at the viewer resource layer:

```ts
type PreparedTextDocument = {
  text: string
  lines: readonly string[]
  lineCount: number
}
```

Create one preparation function:

```ts
function prepareTextDocument(
  text: string,
  bounds: Required<TextViewerBounds>,
  byteLength?: number
): PreparedTextDocument
```

Rules:

- URL and blob callers pass known transferred byte length when available
- inline text computes UTF-8 byte length once
- line splitting happens once
- the prepared document is cached by content key, retry version, and bounds
- `CodeViewerContent` consumes `document.lines` instead of calling `splitTextLines(text)`

Keep `readTextResource` available if other viewers need only a string, but make the code viewer use the prepared path.

### Verification

- existing line splitting tests still pass
- add a test proving inline text preparation calls the splitter once per content identity
- add a test proving URL line-limit enforcement still rejects early while streaming
- code viewer mount time for the 30k-line scrollbench sample improves

## Phase 4: Recycle Detached Row Nodes

### Problem

Large jumps discard rows outside the visible range and create new rows for the destination range. That is correct visually, but it allocates row DOM repeatedly during fast large-jump scrolling.

### Design

Add a tiny detached row pool inside `createCodeProjector`:

```ts
let recycledRows: CodeRowCache[] = []
```

When a row leaves the visible range:

1. remove it from the DOM
2. clear its index slot in `rows`
3. push the cache object into `recycledRows`

When a new row is needed:

1. pop from `recycledRows` if available
2. otherwise call `createCodeRow()`
3. reset `contentIdentity` and `layoutIdentity` before reuse

The pool should be bounded to roughly the maximum visible row count plus overscan. Detached row reuse must never keep stale text visible because reused rows are patched before insertion.

### Verification

- existing stale-row tests pass
- add a large-jump projector test proving row node creation is bounded
- add a test proving reused rows update line number, highlight, text, and token spans
- scrollbench large-jump allocation count drops

## Phase 5: Syntax Work Deferral

### Problem

`code-viewer-syntax.ts` eagerly imports every supported Prism grammar. For plain text and log files, that bundle work does not help first readable paint. For highlighted files, tokenization still happens synchronously when visible rows are patched.

### Design

Split syntax into immediate plain rendering and deferred highlighting:

1. detect the language from file name and MIME type synchronously
2. render visible lines as plain text immediately
3. lazy-load the required Prism grammar
4. schedule syntax patching after the grammar is ready
5. keep the current per-line token cache

If lazy grammar loading is too invasive for the registry package, start with a smaller change:

- keep existing eager imports
- move tokenization for newly visible rows into an idle task where possible
- render plain text first for rows whose tokens are not ready
- patch token spans later only if the row still represents the same line text and syntax identity

### Verification

- JSON syntax tests still pass after grammar readiness settles
- plain `.log` files do not pay grammar loading beyond the shared code path chosen by the phase
- first visible text appears before syntax work for highlighted files
- no highlighted row receives tokens from stale text after scrolling

## Phase 6: Overscan Calibration

### Problem

`CODE_VIEWER_OVERSCAN` is fixed at 24 lines. That is conservative and simple, but it increases per-projection row work. The right value depends on viewport height, line height, scroll velocity, and whether syntax is enabled.

### Design

After Phases 1 through 5, tune overscan with data:

- compare 8, 12, 16, and 24 line overscan in scrollbench
- measure blank-frame risk during wheel and trackpad scrolling
- keep a single constant if one value is clearly sufficient
- otherwise use a small adaptive policy:
  - lower overscan while projection is CPU-bound
  - restore normal overscan after idle

Do not add adaptive overscan before the no-op projection and row recycling work. It is easier to tune once wasted work is gone.

### Verification

- no blank rows during manual fast scroll
- scrollbench large-jump p95 improves or stays stable
- tests that assert initial row count are updated to match the chosen policy

## Test Plan

Run focused tests after each phase:

```bash
pnpm vitest run tests/code-viewer.test.tsx tests/code-viewer-edge-cases.test.tsx tests/code-viewer-bug-hunt.test.tsx
```

Run architecture tests when changing module boundaries:

```bash
pnpm vitest run tests/viewer-architecture.test.ts tests/markdown-text-viewer-contract.test.tsx
```

Run scrollbench manually with the dev server already running:

```txt
/scrollbench?viewer=text
```

Do not start or restart the dev server from the implementation workflow unless explicitly requested.

## Expected Order

Recommended implementation order:

1. Phase 0 baseline
2. Phase 1 same-window no-op projection
3. Phase 4 row recycling
4. Phase 2 compact inline text identity
5. Phase 3 prepared text document cache
6. Phase 5 syntax deferral
7. Phase 6 overscan calibration

Phase 1 and Phase 4 are the safest scroll wins. Phase 2 and Phase 3 improve mount cost and memory behavior. Phase 5 has the largest bundle and first-paint upside, but it touches the syntax contract and should come after the low-risk projector work.
