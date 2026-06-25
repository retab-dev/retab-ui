# Code Viewer Pierre Virtualization Blueprint

## Verdict

The code viewer can adopt some Pierre-style tricks, but it should not become a
Pierre-style mixed-content virtualizer.

The important finding is that the current Retab `CodeViewer` has already
absorbed the core performance shape:

- React owns the frame and controls.
- An imperative projector owns the row DOM.
- Fixed line-height math owns the vertical model.
- Scroll work is scheduled through `requestAnimationFrame`.
- Repeated projections are cheap no-ops when the visible window is unchanged.
- Detached row DOM is recycled.
- Syntax highlighting is deferred for large files and patched in later.

The next real gains are therefore not in replacing the virtualizer. They are in
moving syntax work out of the main scroll path, tightening measurement around
overscan and allocation, and adding a paged scroll scaffold only if product
limits move beyond the current 10,000-line default.

## Implementation Status

Implemented in this pass:

- lazy Prism grammar loading through `code-viewer-syntax-prism.ts`
- worker-backed line tokenization through `code-viewer-syntax.worker.ts`
- a main-thread fallback path when worker creation or worker tokenization fails
- stale generation protection for worker responses
- syntax request coalescing by raw line text
- the shared syntax worker protocol in `code-viewer-syntax-protocol.ts`
- optional projector metrics through `createCodeProjectionMetrics()`
- registry packaging for all new code viewer syntax files
- focused unit tests for lazy syntax, worker syntax, stale worker responses, and
  projector metrics

Implemented in the follow-up Pierre transfer pass:

- Pierre-style centered pixel windows through `CODE_VIEWER_OVERSCAN_PX` and
  `getCodeVirtualPixelWindow()`
- a larger `1000px` overscan buffer instead of first-visible-line anchored
  line-count overscan
- huge-scroll rebasing through a capped physical scroll container and logical
  scroll offset mapping
- logical scroll anchoring for zoom, highlight scrolling, and imperative
  `scrollToLineRange()` calls
- overlap-aware projector patching that trims only leaving edge rows and keeps
  overlapped row DOM stable
- inverse sticky rendered-window shell: a full-height scroll spacer contains a
  normal-flow rendered-range offset followed by a sticky rendered range whose
  negative top/bottom offsets keep the last mounted content pinned to the
  viewport edge if JavaScript projection lags
- DOM validity checks that fall back to a full visible-window rebuild only when
  mounted rows are corrupt or the logical scroll page changes
- scroll interaction polish: row-layer pointer-event suppression during scroll,
  viewport `overflow-anchor: none`, and targeted mobile Safari horizontal
  overflow mitigation
- focused tests for pixel windows, huge-scroll rebasing, overlap preservation,
  corrupt-DOM fallback, inverse sticky geometry, public imperative scrolling,
  and scroll interaction polish

Implemented in the final Pierre completion pass:

- fixed-line sparse position checkpoints through
  `CODE_VIEWER_LINE_CHECKPOINT_INTERVAL`, `getCodeLineCheckpoint()`,
  `getCodeLineIndexAtOffset()`, and `getCodeLineIndexAfterOffset()`
- parsed string detachment for bounded line slices from large source strings in
  `text-viewer-resource.ts`
- bounded long-line rendering through `code-viewer-long-lines.ts`: extremely
  long rows render as head/tail previews, skip syntax tokenization, avoid full
  text DOM duplication, and preserve full-line copy from `textLines`
- global Prism token LRU sharing through `CODE_GLOBAL_TOKEN_CACHE_LIMIT`, so
  repeated line text across syntax instances reuses token leaves
- a shared syntax worker pool keyed by worker factory, with request
  deduplication, bounded workers for the default worker factory, subscriber
  release on syntax destroy, and global cache fill from worker responses
- code-viewer shell pooling for inline text source changes: the viewport and
  row-host shell stay mounted while the projector clears and repaints rows by
  `contentIdentity`
- URL and Blob source changes remain content-keyed so stale previously rendered
  text is not left visible while a new remote payload is pending

Intentionally not implemented:

- Pierre-style variable-height measurement, because the Retab code viewer keeps
  fixed line height and `whitespace-pre`. The fixed-line equivalent is the
  checkpoint mapper above; there are no runtime measured deltas to maintain.
- `IntersectionObserver` visibility, because fixed scroll math is cheaper and
  deterministic.
- fit-perfectly large-jump rendering, because existing tests do not show large
  jump work as the current limiting factor.
- Shiki full-file AST highlighting. The adopted transfer is the equivalent
  cache/pool architecture around the existing Prism line-token highlighter.
- true horizontal virtualization. Pierre also does not do horizontal
  virtualization; the adopted mitigation is bounded preview rendering plus
  full-copy reconstruction for extremely long lines.
- Pierre's shared options object with getters for thousands of file/diff
  instances. Retab has one code viewer instance boundary, so adding an options
  indirection would create API surface without reducing work.

Verification history:

```sh
./node_modules/.bin/vitest run tests/code-viewer.test.tsx
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run tests/code-viewer.test.tsx tests/code-viewer-edge-cases.test.tsx tests/code-viewer-bug-hunt.test.tsx
node scripts/expand-registry-closures.mjs --check
node scripts/verify-registry-file-paths.mjs
```

Follow-up Pierre transfer verification:

```sh
./node_modules/.bin/vitest run tests/code-viewer.test.tsx
```

The follow-up global `tsc --noEmit` run is blocked before code viewer checking by
an unrelated parse error in `registry/new-york-v4/ui/text-viewer-layout.ts`.

## Source Inventory

### Retab Code Viewer

- `registry/new-york-v4/ui/code-viewer.tsx`
- `registry/new-york-v4/ui/code-viewer-content.tsx`
- `registry/new-york-v4/ui/code-viewer-viewport.tsx`
- `registry/new-york-v4/ui/code-viewer-projector.ts`
- `registry/new-york-v4/ui/code-viewer-virtualization.ts`
- `registry/new-york-v4/ui/code-viewer-projection-scheduler.ts`
- `registry/new-york-v4/ui/code-viewer-syntax.ts`
- `registry/new-york-v4/ui/text-viewer-resource.ts`
- `tests/code-viewer.test.tsx`
- `scripts/verify-text-viewer-performance.mjs`

### Existing Retab Notes

- `components/ui/CODE_VIEWER_PERFORMANCE_BLUEPRINT.md`
- `design/code-viewer-dom-ownership-platonic-blueprint.md`
- `design/code-viewer-single-owner-platonic-blueprint.md`
- `design/code-viewer-terminal-platonic-blueprint.md`
- `design/code-viewer-modular-language-support-blueprint.md`

### Pierre Reference

Inspected clone:

```txt
/tmp/pierre-inspect
commit 8b7956b755b25912a6dafd846c8f4f56d3eba284
```

Primary files:

- `packages/diffs/src/components/CodeView.ts`
- `packages/diffs/src/components/Virtualizer.ts`
- `packages/diffs/src/components/VirtualizedFile.ts`
- `packages/diffs/src/components/VirtualizedFileDiff.ts`
- `packages/diffs/src/worker/WorkerPoolManager.ts`
- `packages/diffs/src/utils/createWindowFromScrollPosition.ts`
- `packages/diffs/src/utils/renderFileWithHighlighter.ts`
- `packages/diffs/test/sparseLayoutCheckpoints.test.ts`

## Current Retab Architecture

### Entry And Resource Loading

`CodeViewer` is a thin shell around `PlainTextViewerFrame`. The client content
is `CodeViewerContent`, which:

- resolves text bounds with `resolvedTextViewerBounds`
- reads a prepared document through `readTextDocument`
- keeps `textDocument.lines` as the source line array
- owns font scale, highlight range, viewport refs, and row host refs
- creates one `createCodeProjector()` instance for the mounted viewer
- passes projection inputs to the projector from a stable callback

The important point: line splitting and bounds checking already live in the
resource layer, not in the hot projector. `PreparedTextDocument` in
`text-viewer-resource.ts` stores:

```ts
{
  text: string
  lines: readonly string[]
  lineCount: number
}
```

That means the older "split once" phase in
`components/ui/CODE_VIEWER_PERFORMANCE_BLUEPRINT.md` is already implemented.

### Viewport

`CodeViewerViewport` renders:

- a fixed full-height gutter rail behind the scroller
- a `ScrollArea`
- a relative font-mono canvas with `height = totalHeight`
- an empty `<pre>` with a `ref`

The `<pre>` is intentionally empty from React's perspective. The projector owns
its children. This resolves the mixed React/projector ownership problem called
out in the older DOM ownership blueprints.

### Virtualization Math

`getCodeVirtualLines` is deliberately simple:

- sanitize `lineCount`, `lineHeight`, `scrollTop`, `viewportHeight`
- compute first visible line with fixed-height division
- expand by fixed overscan
- return absolute row starts

Total height is:

```txt
paddingStart + lineCount * lineHeight + paddingEnd
```

This is much simpler than Pierre's variable item geometry because our code
viewer does not wrap source lines and does not render variable-height inline
annotations.

### Projector

`createCodeProjector` is the performance center.

It keeps:

- the current row host
- the current content/layout/syntax identity
- the last projection key
- an array indexed by source line for mounted row caches
- the previous visible range
- a bounded detached row pool

Projection does this:

1. clear rows if the host changed
2. clear rows if the content identity changed
3. compute total height
4. compute visible virtual lines
5. build a projection key from content, layout, syntax, highlight, height, and
   visible range
6. return early if that key is unchanged
7. set host height
8. recycle rows outside the next visible range
9. prepare visible rows
10. insert rows in source order

Rows are patched with separate identities:

- layout identity: line number, gutter width, line height, highlight state
- content identity: source text plus syntax identity

That separation matters. Highlight and zoom changes do not rebuild token spans
unless syntax or line text changed.

### Syntax Highlighting

`code-viewer-syntax.ts` uses Prism:

- a curated eager import list of common grammars
- language detection by extension or MIME
- per-viewer cache keyed by raw line text
- `CODE_LINE_TOKENIZE_MAX = 2000`
- deferred tokenization for viewers over 500 lines
- idle or timeout batches of 12 lines with a 6 ms budget

Large files first render plain text. Visible lines request tokens, queued lines
are tokenized later, and `onTokensChanged` increments `syntaxVersion`, which
causes a projection pass that patches highlighted rows.

This is a good "plain first, decorate later" shape, but it still performs Prism
tokenization on the main thread and eagerly includes all imported grammars in
the client bundle.

### Existing Tests

`tests/code-viewer.test.tsx` already covers the critical projector behaviors:

- visible rows only
- repeated projection does not duplicate rows
- content identity changes clear stale rows
- same-window scroll does no row work
- cross-window scroll still patches
- detached rows are reused
- highlight/layout changes do not rebuild token content
- syntax identity changes rebuild token content

This gives us a good safety net for incremental performance work.

## Pierre Techniques

Pierre has two relevant surfaces:

1. `CodeView`, a high-level mixed file/diff scroller.
2. `Virtualizer`, a lower-level simple virtualization primitive for connected
   file or diff instances.

The high-level `CodeView` is the more relevant reference because it owns the
fastest, most integrated path.

### Imperative Container Ownership

Pierre's React wrappers create long-lived class instances. The class instance
owns the DOM lifecycle, scroll state, layout state, and render scheduling.

For `CodeView`, the class owns:

- root scroll listener
- container height
- sticky container
- per-item wrappers
- item layout
- element pool
- scroll targets
- scroll anchoring
- worker manager integration

Retab already applies the same principle at the row level. The difference is
scope: Pierre owns a whole mixed-content scroll world, while Retab owns only the
rows inside a code `<pre>`.

### Window Projection

Pierre computes a logical virtual window with
`createWindowFromScrollPosition`. Inputs:

- `scrollTop`
- viewport height
- full scroll height
- overscroll size
- optional "fit perfectly" mode for large jumps

The returned `{ top, bottom }` range drives which files/diffs are mounted.

Retab computes line windows directly. Because every line has the same height,
the Retab window is cheaper and more exact for the code-only case.

### Rebased Paged Scroll Scaffold

Pierre protects against browser scroll-height limits by separating logical
scroll position from the physical scroll container.

In `CodeView.ts`:

- full logical `scrollHeight` can exceed the browser-friendly range
- `getPagedScrollHeight()` caps the physical container height
- `scrollPageOffset` maps physical `root.scrollTop` back to logical `scrollTop`
- the page is rebased when the physical scroll position approaches thresholds

This is a useful trick when content height can grow into tens of millions of
pixels.

Retab now has this scaffold even though default limits remain modest. The
projector uses a capped physical scroll size and maps `viewport.scrollTop`
through a logical `scrollPageOffset`. With default limits:

```txt
10,000 lines * 20 px + 16 px padding = 200,016 px
```

That is far below the range where paged rebasing is needed. At maximum zoom:

```txt
10,000 lines * 100 px + 16 px padding = 1,000,016 px
```

Still acceptable. The scaffold is therefore mostly defensive today, but it is
already in place if `maxLines` grows or callers push the code viewer into
100,000+ line documents.

### Measured Layout Correction

Pierre supports wrapping, annotations, collapsed hunks, diff headers, file
headers, sticky headers, and arbitrary user slots. It therefore cannot rely on
pure fixed math.

Pierre uses:

- estimated metrics up front
- measured row or annotation heights after render
- dirty layout indexes
- scroll anchors before layout mutation
- post-render anchor correction
- sparse checkpoints every 5,000 lines

The sparse checkpoint pattern lets deep lookups resume near the target instead
of replaying variable-height layout from the top of the file.

Retab intentionally avoids the variable-height part of this complexity in
`CodeViewer` by using:

- `whitespace-pre`
- fixed line height
- no wrapping
- no inline annotations
- no per-line measured height

That constraint is valuable. It makes scroll-to-line and visible-window math
constant time. The adopted checkpoint helper is a fixed-line equivalent: it
stores sparse arithmetic anchors for deep offset-to-line lookup without adding
measured row state or dirty layout propagation.

### Element Pooling

Pierre pools `diffs-container` shell elements. That pool has:

- generation tracking
- pending elements for container-managed React cleanup
- a size limit derived from viewport and header height
- invalidation when themes or shared options change

Retab's rows are simpler and already pooled through `MAX_RECYCLED_CODE_ROWS`.
The code viewer now also keeps the viewport/render-window/row-host shell mounted
for inline source changes, letting the projector clear and repaint rows by
`contentIdentity`. It does not copy Pierre's Shadow DOM/custom-element shell
pool because there is no expensive custom element lifecycle to amortize.

### Worker-Backed Highlighting

Pierre's worker path is materially different from Retab's Prism path.

`WorkerPoolManager`:

- initializes a pool of workers
- resolves Shiki themes and languages
- caches rendered AST results in LRU maps
- coalesces tasks by highlight key
- keeps active and queued requests per renderer instance
- primes highlight caches for pending scroll targets
- invalidates caches on render option changes

This is the most transferable Pierre trick. Retab keeps Prism instead of Shiki,
but now applies the same architecture shape: plain text first, worker-backed
tokenization when available, fallback main-thread tokenization, request
deduplication, a shared worker pool, and a bounded global token LRU.

### Partial Rendering And Buffers

Pierre render ranges include:

- `startingLine`
- `totalLines`
- `bufferBefore`
- `bufferAfter`

This is important because Pierre often renders a slice of a file or diff inside
an item wrapper while preserving the item's full virtual height.

Retab now uses a rendered-window shell rather than per-file buffer spacers. The
full scroll spacer owns total height, a normal-flow offset element places the
sticky region at the active pixel range, and the sticky render window owns only
the rendered range height. Rows are positioned relative to that render window,
so overlapped rows remain stable and entering rows are only prepended/appended
at the edges.

### IntersectionObserver Visibility

Pierre's simple `Virtualizer` can connect file/diff instances and use
`IntersectionObserver` with large margins to decide visibility.

Retab should not copy this into `CodeViewer`. Direct fixed-line math is cheaper,
deterministic, and easier to test.

## Applicability Matrix

| Pierre technique | Retab status | Recommendation |
| --- | --- | --- |
| React shell plus imperative DOM renderer | Already applied | Keep. Do not reintroduce React rows. |
| Fixed metric window math | Already applied | Keep for code viewer. |
| RAF scroll scheduling | Already applied | Keep. |
| Same-window projection no-op | Already applied | Keep tests as invariants. |
| Row/element pooling | Applied at row level and inline shell level | Keep current row pool and code-viewer inline shell pooling. Do not copy Shadow DOM generation pooling. |
| Plain first, syntax later | Already applied | Keep. |
| Worker-backed syntax | Applied | Keep behind the existing syntax contract with main-thread fallback. |
| AST/LRU highlight cache | Applied as global Prism line-token LRU | Keep bounded global token cache; do not switch to Shiki unless semantic highlighting becomes a requirement. |
| Lazy language/theme loading | Applied | Keep dynamic grammar loading and plain-first rendering. |
| Paged scroll rebasing | Applied | Keep capped physical scroll plus logical offset mapping. |
| Sparse layout checkpoints | Applied as fixed-line checkpoints | Keep arithmetic checkpoint helpers; reject measured checkpoint state unless wrapping or annotations are added. |
| Measured layout reconciliation | Fixed-line invariant | Reject for current fixed-line viewer. |
| Buffer before/after slices | Applied as rendered-window shell | Use the sticky rendered window instead of per-row buffer DOM. |
| IntersectionObserver visibility | Not needed | Reject for code-only fixed rows. |
| Fit-perfectly large jump mode | Applied via inverse sticky | Browser blank-frame verification remains pending. |
| Scroll anchor after arbitrary layout mutation | Applied for fixed-line code | Expand only if variable heights appear. |

## Recommended Architecture

The best target shape is:

```txt
CodeViewerContent
  owns resource, scale, highlight, refs
  creates projector and syntax provider
  schedules projection on RAF

CodeViewerViewport
  owns scroll surface and empty row host
  never renders rows

CodeProjector
  owns visible row DOM
  applies fixed-line virtualization
  patches layout and content separately
  remains synchronous and small

CodeSyntaxProvider
  returns plain text immediately
  resolves tokens asynchronously
  optionally delegates tokenization to a worker
  exposes versioned identities for projector invalidation
```

Do not make the projector asynchronous. Keep async work behind the syntax
provider, then notify the content component with `onTokensChanged`.

## Phase 1: Performance Baseline

### Problem

The code viewer has unit coverage for projector behavior, but there is no
dedicated browser-level code viewer budget. The existing performance script is
named for text viewer scenarios and expects a running server at
`http://localhost:3100`.

### Design

Add or extend a browser profile route only if it already exists in the viewer
profile system. The measurement should capture:

- initial mount duration
- long task count
- max long task duration
- mounted row count
- total DOM node count
- small scroll p95 frame time
- large jump p95 frame time
- row allocations during jump scrolling
- syntax tokenization work count
- syntax tokenization duration

Do not start the dev server from the verification script. The repository policy
requires the user to start needed dev servers.

### Scenarios

Use at least:

- 200-line TypeScript file
- 2,000-line JSON file
- 10,000-line log/plain text file
- 10,000-line TypeScript-like file with repeated lines
- one file with very long lines over `CODE_LINE_TOKENIZE_MAX`

### Acceptance

No implementation phase should land without one of:

- unit tests proving less work on the hot path
- browser metrics showing no regression
- a clear reason the phase is preparatory only

## Phase 2: Lazy Grammar Loading

### Problem

`code-viewer-syntax.ts` eagerly imports every curated Prism grammar. That means
a code viewer for JSON pays for Python, YAML, Bash, SQL, Go, Rust, Java, and
Markdown grammar modules.

This is not a scroll virtualization bug, but it affects initial interactive
cost and client bundle weight.

### Design

Split language detection from grammar loading.

Keep synchronous plain rendering:

```ts
type CodeSyntax = {
  identity: string
  destroy?: () => void
  getLineTokens(line: string): readonly CodeTokenLeaf[] | null
}
```

Add an internal async grammar readiness layer:

- detect `languageId` synchronously
- return plain tokens until the grammar is loaded
- dynamically import the grammar for the detected language
- call `onTokensChanged` after the grammar becomes available
- keep `"plain"` for unknown languages

The projector API does not change.

### Constraints

- Preserve server/client boundaries. This file is client-only through
  `CodeViewerContent`, but dynamic imports must still be compatible with the
  Next.js/Bun toolchain.
- Preserve tests that assert unknown extensions stay plain.
- Preserve `CODE_LINE_TOKENIZE_MAX`.
- Preserve line-token cache semantics.

### Implementation

Implemented by moving Prism-specific loading and token flattening to
`code-viewer-syntax-prism.ts`.

`code-viewer-syntax.ts` now:

- detects the language synchronously
- keeps the public `CodeSyntax` contract plain-first
- exposes `preload()` for tests and forced main-thread readiness
- dynamically imports only the selected grammar
- keeps unknown languages as `"plain"`
- preserves `CODE_LINE_TOKENIZE_MAX` through the shared syntax protocol

### Verification

- Added tests that detected languages initially return plain while grammar
  loading is pending.
- Added tests that known grammars tokenize after `preload()`.
- Existing unknown-extension tests remain intact.

## Phase 3: Worker Syntax Provider

### Problem

Deferred Prism tokenization reduces blocking, but tokenization still happens on
the main thread. On large files, scrolling can request many visible lines, and
the idle batches still compete with input, layout, paint, and React.

Pierre's most useful transferable trick is not Shiki itself. It is the
separation of expensive highlighting from the visible DOM projector.

### Design

Introduce a syntax provider that can run in two modes:

```ts
type CodeSyntaxMode = "auto" | "main-thread" | "worker"
```

The public `CodeSyntax` contract can stay the same. Internally:

- `getLineTokens(line)` returns cached tokens or `null`
- cache misses enqueue work
- queued work is coalesced by `languageId + line`
- a worker receives batches
- worker responses populate the cache
- one `onTokensChanged` notification is scheduled per response frame
- `destroy()` cancels or ignores stale generation results

Keep the first implementation line-based. Do not jump straight to Shiki
full-file AST unless syntax quality requirements justify it.

### Worker Message Shape

Use generation ids to avoid stale responses:

```ts
type CodeSyntaxWorkerRequest = {
  generation: number
  languageId: string
  lines: string[]
}

type CodeSyntaxWorkerResponse = {
  generation: number
  languageId: string
  results: Array<{
    line: string
    tokens: CodeTokenLeaf[] | null
  }>
}
```

### Queue Rules

- Use a `Set<string>` for pending line text per language.
- Limit batch size.
- Prefer visible lines first if the projector later reports demand priority.
- Deduplicate repeated lines.
- Drop lines above `CODE_LINE_TOKENIZE_MAX`.
- Do not send a request if grammar is unavailable.

### Cache Rules

Start with per-viewer cache parity:

```txt
Map<rawLine, tokens>
```

Then consider an optional module-level LRU:

```txt
languageId + "\0" + rawLine -> tokens
```

A global cache should be bounded. Pierre uses AST LRU caches because full-file
results are larger and more expensive. Retab line tokens are smaller, but log
files can still contain many unique lines.

### Failure Mode

Worker failure must degrade to plain text or the existing main-thread provider.
It must not blank the code viewer.

Preferred fallback:

1. keep returning `null` for not-yet-tokenized lines
2. emit one warning in development
3. optionally switch to main-thread deferred tokenization for the mounted viewer

### Verification

- Unit test request coalescing.
- Unit test stale generation responses are ignored.
- Unit test destroy cancels notifications.
- Unit test worker failure falls back to main-thread tokenization.
- Existing projector tests remain unchanged.
- Browser profile is still pending because repository policy requires a
  user-started dev server.

## Phase 4: Projection Metrics

### Problem

The projector is fast, but currently opaque. We can prove behavior through
tests, but runtime tuning still needs counters.

### Design

Add optional development-only or test-only projection metrics.

Counters:

- projection calls
- no-op projections
- rows created
- rows reused
- rows removed
- content patches
- layout patches
- token span rebuilds
- visible start/end

Keep this out of production public API unless there is a clear diagnostic
surface. A narrow test hook is enough.

Possible shape:

```ts
type CodeProjectionMetrics = {
  projections: number
  noops: number
  rowsCreated: number
  rowsReused: number
  rowsRemoved: number
  contentPatches: number
  layoutPatches: number
}
```

Actual implemented shape:

```ts
type CodeProjectionMetrics = {
  contentPatches: number
  layoutPatches: number
  noops: number
  projections: number
  rowsCreated: number
  rowsRemoved: number
  rowsReused: number
  tokenSpanRebuilds: number
  visibleEnd: number
  visibleStart: number
}
```

### Verification

- Tests assert same-window scroll increments `noops`, not row mutation counters.
- Metrics are opt-in through `createCodeProjector({ metrics })`, so the
  production projector path does not allocate metrics by default.

## Phase 5: Overscan Calibration

### Problem

`CODE_VIEWER_OVERSCAN = 24` is plausible, but not evidence-based. Too little
overscan can show blanking during fast wheel or trackpad scroll. Too much
overscan increases DOM and token work.

Pierre uses much larger pixel overscan because it virtualizes mixed item
wrappers and accounts for Safari blanking. Retab should not copy that number.
Retab's overscan should be tuned in lines.

### Design

Measure with:

- 720 px desktop viewport
- 900 px desktop viewport
- compact mobile viewport
- fast wheel-like scroll
- large programmatic jumps

Try:

```txt
12, 18, 24, 36, 48
```

Capture:

- blank frame detection if available
- p95 frame time
- row count
- token work
- DOM node count

### Acceptance

Keep 24 unless metrics show a clear improvement. The default should be boring
and robust.

## Phase 6: Optional Fit-Perfectly Large Jump Mode

### Problem

Pierre uses a "fit perfectly" path for very large jumps: render the bare
minimum quickly, then schedule another render to fill overscan. This reduces
the first-paint cost of huge jumps.

Retab large jumps currently compute the destination window with full overscan.
That may be fine because rows are cheap. But syntax span rebuilding during a
large highlighted jump could still be expensive.

### Design

Only implement after metrics prove large jumps are a problem.

Possible approach:

- scheduler detects a scroll delta larger than `viewportHeight + overscanPx * 2`
- projector receives a temporary `overscan = 0` or smaller overscan
- next RAF restores normal overscan

This must not affect imperative `scrollToLineRange` correctness.

### Verification

- Large jump should show first rows sooner.
- Next frame should fill normal overscan.
- No blanking during manual scroll.
- No regression in same-window no-op behavior.

## Phase 7: Conditional Paged Scroll Rebase

### Problem

Browsers have practical limits for huge scrollable element heights. Pierre's
paged scroll scaffold solves this by keeping a bounded physical scroll range
and mapping it to a larger logical scroll range.

Retab does not need this under current defaults. But if `maxLines` is raised to
100,000+ or users pass high custom limits, `height = lineCount * lineHeight`
can become fragile.

### Trigger

Do not implement until at least one of these becomes true:

- default `DEFAULT_MAX_LINES` is raised substantially
- product requires opening 100,000+ line code/log files
- browser verification shows scroll precision or maximum-height failures
- max zoom plus custom `maxLines` creates scroll surfaces over roughly
  8,000,000 px

### Design

Add a physical scroll mapper below `CodeViewerViewport`.

Logical values:

```txt
logicalScrollTop
logicalTotalHeight
```

Physical values:

```txt
physicalScrollTop
physicalTotalHeight = min(logicalTotalHeight, cap)
scrollPageOffset
```

Projection should use logical scroll top:

```txt
logicalScrollTop = physicalScrollTop + scrollPageOffset
```

Row transforms should use physical-relative starts:

```txt
physicalRowTop = logicalRowTop - scrollPageOffset
```

The scroll page rebase must preserve the visible line anchor:

1. capture current first visible line and intra-line offset
2. update `scrollPageOffset`
3. set physical `scrollTop`
4. project with unchanged logical scroll top

### Risks

- Sticky gutter rail must remain aligned.
- Horizontal scrolling must remain independent.
- Programmatic `scrollToLineRange` must target logical positions.
- Browser selection/copy behavior must still work for visible rows.

### Verification

- Unit tests for logical-to-physical mapping.
- Unit tests for `scrollToLineRange` past the physical cap.
- Browser test with a synthetic 200,000-line source.
- Verify no jump when rebasing near top or bottom thresholds.

## Rejected For Current Viewer

### Variable Height Measurement

Do not add measured row heights to the code viewer while the product accepts
`whitespace-pre` and fixed line heights.

Adding measurement would:

- make scroll-to-line slower
- require anchor correction after every measurement change
- require checkpoints or binary indexed geometry
- make row recycling more stateful
- invite wrap-specific bugs

The current fixed-height constraint is a feature.

### Variable Sparse Checkpoints

Variable sparse checkpoints are excellent for Pierre because a deep line
position may depend on thousands of earlier measured rows. Retab line position
is:

```txt
paddingStart + lineIndex * lineHeight
```

The code viewer now has fixed-line checkpoint helpers for parity with the
Pierre pattern, but it does not keep measured checkpoint state. There is no
variable geometry for a checkpoint tree to reconcile.

### IntersectionObserver Visibility

Do not use `IntersectionObserver` for visible code rows. The visible range is
already known from scrollTop and lineHeight. Observer callbacks would be later,
less deterministic, and harder to test.

### Per-File Buffer Spacers

Pierre's `bufferBefore` and `bufferAfter` are useful when rendering slices
inside a larger item wrapper. Retab rows are already absolute-positioned in the
full document coordinate system. Spacers would be redundant.

### Full Pierre `CodeView`

Do not port Pierre's `CodeView` class. It solves a different problem:

- mixed file and diff items
- sticky file headers
- collapsed hunks
- line wrapping
- annotations
- smooth scroll targets across moving layout
- worker-rendered Shiki AST
- custom element shells

Retab's `CodeViewer` should remain a focused code surface.

## Implementation Order

Completed order:

1. Lazy-load syntax grammars.
2. Add worker-backed line tokenization behind the existing `CodeSyntax`
   contract.
3. Add projection metrics.
4. Register the new syntax files in the shadcn registry item.
5. Expand tests around lazy syntax, worker syntax, stale worker responses, and
   projection metrics.
6. Add centered pixel windows, inverse sticky rendered-region shell, huge-scroll
   rebasing, and overlap-aware partial row patching.
7. Add parsed line detachment, fixed-line checkpoints, long-line preview/copy
   mitigation, global Prism token LRU, shared worker pooling, and inline
   code-viewer shell pooling.

Remaining conditional order:

1. Calibrate overscan with browser metrics.
2. Consider true variable-height measurement only if wrapping, inline
   annotations, or comments are introduced.
3. Consider Shiki only if semantic multi-line grammar fidelity becomes more
   important than the current Prism line-token cost/profile.

## Test Plan

### Unit Tests

Keep existing projector tests and add:

- grammar pending -> plain rows -> tokens after load
- syntax destroy before async completion
- worker request coalescing
- stale worker generation ignored
- worker failure keeps plain rendering
- optional metrics counters
- overscan behavior if it becomes configurable
- logical scroll mapper if paged rebasing is added

### Browser Verification

Use a user-started dev server only. The script should fail clearly if the
server is not running.

Scenarios:

- initial mount of large code file
- small scroll
- fast large jump
- zoom in and out
- highlighted range scroll
- syntax token update during idle
- horizontal scroll with sticky gutter

Metrics:

- p95 frame time
- max frame time
- long task count
- max long task duration
- mounted row count
- token worker queue size
- token worker response latency
- row allocation count

### Regression Areas

- highlighted lines must stay exact
- gutters must remain non-copy content
- stale URL content must not remain visible while a new URL is pending
- empty files and trailing blank lines must preserve behavior
- CRLF, CR, LF, U+2028, and U+2029 splitting must stay stable
- long lines above the tokenization cap must remain plain
- unknown languages must remain plain

## Final Shape

The ideal final code viewer is:

- fixed-height and line-based
- React-free in the row hot path
- synchronous for layout and DOM projection
- asynchronous for syntax decoration
- plain-readable before highlighting completes
- measured in browser-level scroll scenarios
- bounded by default file limits
- prepared for huge scroll ranges through logical/physical scroll rebasing

The Pierre lesson is not "build a bigger virtualizer." The lesson is "put the
right work in the right loop." Retab now does that for row projection, scroll
geometry, syntax decoration, source line preparation, and pathological long
lines while preserving the simpler fixed-line model that makes this viewer
faster than a general mixed-content diff virtualizer.
